package com.reg.arms.service;

import com.reg.arms.dto.response.TechnicianRecommendationResponse;
import com.reg.arms.entity.Request;
import com.reg.arms.entity.Technician;
import com.reg.arms.entity.TechnicianSchedule;
import com.reg.arms.entity.enums.NotificationType;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.RequestRepository;
import com.reg.arms.repository.TechnicianRepository;
import com.reg.arms.repository.TechnicianScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Scores and ranks available technicians for a given request.
 *
 * ── Scoring breakdown (max 100 pts, weights shift by priority) ──────────────
 *
 *   Priority   Specialization  Location  Workload  History   Total
 *   ─────────  ─────────────── ────────  ────────  ───────   ─────
 *   Critical        25           25        35        15       100
 *   High            30           25        30        15       100
 *   Medium          35           30        20        15       100
 *   Low             40           30        15        15       100
 *
 * For Critical requests the algorithm prioritises a free technician over the
 * best-matched one, because speed of response matters more than specialisation.
 *
 * ── Enhancements over v1 ────────────────────────────────────────────────────
 *   Item 1 — District-level location bonus within province score
 *   Item 2 — Category-specific history beats generic resolved count
 *   Item 3 — Priority-aware weight shifting (see table above)
 *   Item 5 — Schedule-aware availability (off-shift techs score 40% lower)
 *   Item 6 — Structured specialisation tags beat free-text keyword guessing
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TechnicianMatchService {

    private final TechnicianRepository         technicianRepository;
    private final RequestRepository            requestRepository;
    private final TechnicianScheduleRepository scheduleRepository;
    private final NotificationService          notificationService;

    // ── Priority-aware ceilings: [specialization, location, workload, history] ─
    private static final Map<PriorityLevel, int[]> CEILINGS = Map.of(
        PriorityLevel.Critical, new int[]{ 25, 25, 35, 15 },
        PriorityLevel.High,     new int[]{ 30, 25, 30, 15 },
        PriorityLevel.Medium,   new int[]{ 35, 30, 20, 15 },
        PriorityLevel.Low,      new int[]{ 40, 30, 15, 15 }
    );

    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TechnicianRecommendationResponse> recommend(Long requestId) {

        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Request", "id", requestId));

        // ── Step 1: build candidate pool scoped to request's district ─────────
        //
        // New pursue-aware priority order:
        //   1. Free techs in district (not pursuing any request)
        //   2. Pursuing techs in district (occupied but remain eligible)
        //   3. Legacy techs with null district (backward compat)
        //   4. All techs (absolute last resort)
        //
        // District is non-negotiable — never mix districts unless no coverage exists.
        List<Technician> candidates;
        boolean hasDistrictCoverage = false;

        if (request.getDistrict() != null && !request.getDistrict().isBlank()) {
            String reqDist = request.getDistrict();

            // Priority 1: free techs in the correct district
            candidates = technicianRepository.findByUser_DistrictIgnoreCaseAndPursuingRequestIsNull(reqDist);

            if (candidates.isEmpty()) {
                // Priority 2: pursuing techs in the correct district (still eligible)
                candidates = technicianRepository.findByUser_DistrictIgnoreCaseAndPursuingRequestIsNotNull(reqDist);
            }

            hasDistrictCoverage = !candidates.isEmpty();

            if (candidates.isEmpty()) {
                // Fallback: legacy technicians with null district
                candidates = technicianRepository.findByIsAvailableTrueOrderByCurrentWorkloadAsc()
                        .stream()
                        .filter(t -> t.getUser().getDistrict() == null
                                     || t.getUser().getDistrict().isBlank())
                        .collect(Collectors.toList());
            }
            if (candidates.isEmpty()) {
                candidates = technicianRepository.findAll();
            }
        } else {
            // No district on request — use availability-ordered fallback
            candidates = technicianRepository.findByIsAvailableTrueOrderByCurrentWorkloadAsc();
            if (candidates.isEmpty()) {
                candidates = technicianRepository.findAll();
            }
        }

        // ── Critical + no coverage: alert Staff and Admin immediately ──────────
        boolean isCritical = PriorityLevel.Critical.equals(
                request.getFinalPriority() != null ? request.getFinalPriority() : PriorityLevel.Medium);
        if (isCritical && !hasDistrictCoverage && request.getDistrict() != null) {
            try {
                notificationService.notifyStaffAndAdmins(request, NotificationType.URGENT_ALERT,
                        "🚨 No Technician Available — Critical Request Unassigned",
                        "Critical request " + request.getRequestCode()
                        + " (" + request.getTitle() + ") has no available technician in "
                        + request.getDistrict() + " district. Manual assignment required.");
                log.warn("Critical request {} has no technician in district '{}' — staff alerted",
                        request.getRequestCode(), request.getDistrict());
            } catch (Exception e) {
                log.error("Failed to alert staff for critical request {}: {}",
                        request.getRequestCode(), e.getMessage());
            }
        }

        String        categoryLower  = request.getCategory().getName().toLowerCase();
        String        categoryRaw    = request.getCategory().getName();
        String        reqProvince    = request.getProvince();
        String        reqDistrict    = request.getDistrict();
        PriorityLevel priority       = request.getFinalPriority() != null
                                       ? request.getFinalPriority() : PriorityLevel.Medium;
        int[]         ceilings       = CEILINGS.getOrDefault(priority, CEILINGS.get(PriorityLevel.Medium));

        // ── Item 5: load today's working schedules in a single query ──────────
        String        today          = DayOfWeek.from(LocalDate.now()).toString(); // e.g. "MONDAY"
        LocalTime     now            = LocalTime.now();
        List<Long>    techIds        = candidates.stream().map(Technician::getId).toList();

        // Single DB query — reuse result for both workingNow and hasScheduleToday
        var todaySchedules = scheduleRepository.findByTechnicianIdInAndDayOfWeekIgnoreCase(techIds, today);

        Set<Long> workingNow = todaySchedules.stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsWorking())
                          && !now.isBefore(s.getStartTime())
                          && !now.isAfter(s.getEndTime()))
                .map(s -> s.getTechnician().getId())
                .collect(Collectors.toSet());

        // Techs that have NO schedule entry today are treated as always working
        Set<Long> hasScheduleToday = todaySchedules.stream()
                .map(s -> s.getTechnician().getId())
                .collect(Collectors.toSet());

        // For Critical requests, pursuing techs don't receive the pursue penalty —
        // speed of response matters more than whether the technician is already occupied.
        boolean applyPursuePenalty = !isCritical;

        List<TechnicianRecommendationResponse> ranked = candidates.stream()
                .map(t -> score(t, categoryLower, categoryRaw, reqProvince, reqDistrict,
                               ceilings, workingNow, hasScheduleToday, applyPursuePenalty))
                .sorted(Comparator.comparingInt(TechnicianRecommendationResponse::getMatchScore).reversed())
                .limit(5)
                .toList();

        log.info("Technician recommendations for request {} (priority={}): top score={}",
                requestId, priority, ranked.isEmpty() ? 0 : ranked.get(0).getMatchScore());

        return ranked;
    }

    // ── Composite scorer ──────────────────────────────────────────────────────

    private TechnicianRecommendationResponse score(Technician tech,
                                                    String categoryLower,
                                                    String categoryRaw,
                                                    String reqProvince,
                                                    String reqDistrict,
                                                    int[]  ceilings,
                                                    Set<Long> workingNow,
                                                    Set<Long> hasScheduleToday,
                                                    boolean applyPursuePenalty) {
        List<String> reasons = new ArrayList<>();
        int total = 0;

        // 1 ── Specialisation match (0 – ceilings[0]) ─────────────────────────
        int specScore = specializationScore(
                tech.getSpecializationTags(), tech.getSpecialization(),
                categoryLower, categoryRaw, ceilings[0]);
        total += specScore;
        if (specScore >= (int)(ceilings[0] * 0.75))
            reasons.add("Specialisation matches request category");
        else if (specScore >= (int)(ceilings[0] * 0.37))
            reasons.add("Partial specialisation overlap");

        // 2 ── Province + district coverage (0 – ceilings[1]) ─────────────────
        // Primary: use the canonical district/province stored on user account.
        // Fallback: old districtCoverage / provinceCoverage JSONB lists (legacy).
        int locScore = locationScore(
                tech.getProvinceCoverage(), tech.getDistrictCoverage(),
                tech.getUser().getProvince(), tech.getUser().getDistrict(),
                reqProvince, reqDistrict, ceilings[1]);
        total += locScore;
        if (locScore == ceilings[1])
            reasons.add("Covers district & province (" + reqDistrict + ", " + reqProvince + ")");
        else if (locScore >= (int)(ceilings[1] * 0.65))
            reasons.add("Covers request province (" + reqProvince + ")");
        else if (locScore > 0)
            reasons.add("Broad national coverage");

        // 3 ── Workload capacity with schedule awareness (0 – ceilings[2]) ────
        boolean hasSchedule = hasScheduleToday.contains(tech.getId());
        boolean onShift     = workingNow.contains(tech.getId());
        int workScore = workloadScore(
                tech.getCurrentWorkload(), tech.getMaxWorkload(),
                hasSchedule, onShift, ceilings[2]);
        total += workScore;
        int workPct = tech.getMaxWorkload() > 0
                ? (int)((double) tech.getCurrentWorkload() / tech.getMaxWorkload() * 100) : 0;
        if (workScore >= (int)(ceilings[2] * 0.75)) {
            reasons.add("Low workload (" + workPct + "% full" + (onShift ? ", on-shift now" : "") + ")");
        } else if (workScore >= (int)(ceilings[2] * 0.38)) {
            reasons.add("Moderate workload (" + workPct + "% full)");
        } else {
            reasons.add("High workload — " + tech.getCurrentWorkload()
                    + "/" + tech.getMaxWorkload() + " active tasks");
        }
        if (hasSchedule && !onShift)
            reasons.add("Currently off-shift (score reduced)");

        // 4 ── Historical performance (0 – ceilings[3]) ───────────────────────
        int histScore = historyScore(
                tech.getTotalResolved(), tech.getRating(),
                tech.getCategoryResolvedCounts(), categoryRaw, ceilings[3]);
        total += histScore;
        int catCount = categoryCount(tech.getCategoryResolvedCounts(), categoryRaw);
        if (histScore >= (int)(ceilings[3] * 0.80)) {
            String catNote = catCount > 0
                    ? catCount + " resolved in this category"
                    : tech.getTotalResolved() + " total resolved";
            reasons.add("Strong track record (" + catNote
                    + (tech.getRating() != null ? ", " + tech.getRating() + "★" : "") + ")");
        } else if (histScore >= (int)(ceilings[3] * 0.40)) {
            reasons.add("Good experience (" + tech.getTotalResolved() + " resolved)");
        }

        // 5 ── Pursue-status penalty (non-Critical only) ───────────────────────
        // A technician who is already actively pursuing a request is ranked lower
        // to prefer free technicians, but remains fully eligible.
        boolean isPursuing = tech.getPursuingRequest() != null;
        if (isPursuing && applyPursuePenalty) {
            total = (int)(total * 0.75); // 25 % deduction — still competitive but lower priority
            reasons.add("Currently pursuing another request (ranked lower)");
        }

        return TechnicianRecommendationResponse.builder()
                .id(tech.getId())
                .userId(tech.getUser().getId())
                .fullName(tech.getUser().getFullName())
                .email(tech.getUser().getEmail())
                .employeeId(tech.getEmployeeId())
                .specialization(tech.getSpecialization())
                .specializationTags(tech.getSpecializationTags())
                .provinceCoverage(tech.getProvinceCoverage())
                .districtCoverage(tech.getDistrictCoverage())
                .categoryResolvedCounts(tech.getCategoryResolvedCounts())
                .isAvailable(tech.getIsAvailable())
                .currentWorkload(tech.getCurrentWorkload())
                .maxWorkload(tech.getMaxWorkload())
                .rating(tech.getRating())
                .totalResolved(tech.getTotalResolved())
                .matchScore(Math.min(total, 100))
                .matchReasons(reasons)
                .isPursuing(isPursuing)
                .build();
    }

    // ── Scoring sub-methods ───────────────────────────────────────────────────

    /**
     * Item 6 — Tags beat free-text; item 3 ceiling applied.
     */
    private int specializationScore(List<String> tags, String specText,
                                    String categoryLower, String categoryRaw, int ceiling) {
        // Structured tags (exact or close match)
        if (tags != null && !tags.isEmpty()) {
            for (String tag : tags) {
                if (tag.equalsIgnoreCase(categoryRaw))               return ceiling;
                if (tag.toLowerCase().contains(categoryLower)
                 || categoryLower.contains(tag.toLowerCase()))       return (int)(ceiling * 0.75);
            }
        }

        // Free-text fallback
        if (specText == null || specText.isBlank()) return 0;
        String spec = specText.toLowerCase();
        if (spec.contains(categoryLower))                            return ceiling;

        Set<String> sw = tokenize(spec);
        Set<String> cw = tokenize(categoryLower);
        long shared = sw.stream().filter(cw::contains).count();
        if (shared >= 2) return (int)(ceiling * 0.75);
        if (shared == 1) return (int)(ceiling * 0.38);
        return 0;
    }

    /**
     * District + province match score.
     *
     * Priority order:
     * <ol>
     *   <li>Canonical user.district / user.province (new hierarchy) — exact match = ceiling.</li>
     *   <li>Legacy districtCoverage / provinceCoverage lists (backward compatibility).</li>
     * </ol>
     *
     * With the new hierarchy:
     *   Same district  →  ceiling (100 %)
     *   Wrong district →  0 (technicians are strictly district-scoped)
     *
     * With legacy coverage lists (user.district is null):
     *   Province + District →  ceiling
     *   Province only       →  ~67 % of ceiling
     *   National coverage   →  ~33 % of ceiling
     */
    private int locationScore(List<String> provinceCoverage, List<String> districtCoverage,
                               String techProvince, String techDistrict,
                               String reqProvince, String reqDistrict, int ceiling) {

        // ── New hierarchy: use canonical user district ────────────────────────
        if (techDistrict != null && !techDistrict.isBlank()) {
            if (reqDistrict != null && normalise(reqDistrict).equals(normalise(techDistrict))) {
                return ceiling; // perfect district match
            }
            return 0; // wrong district — technician is scoped to a different district
        }

        // ── Legacy fallback: use coverage lists ───────────────────────────────
        if (provinceCoverage == null || provinceCoverage.isEmpty() || reqProvince == null) return 0;

        String rp = normalise(reqProvince);
        boolean provMatch = provinceCoverage.stream()
                .anyMatch(p -> p != null && normalise(p).equals(rp));

        if (provMatch) {
            if (reqDistrict != null && districtCoverage != null && !districtCoverage.isEmpty()) {
                String rd = normalise(reqDistrict);
                boolean distMatch = districtCoverage.stream()
                        .anyMatch(d -> d != null && normalise(d).equals(rd));
                if (distMatch) return ceiling;
            }
            return (int)(ceiling * 0.67);
        }

        return provinceCoverage.size() >= 5 ? (int)(ceiling * 0.33) : 0;
    }

    /**
     * Item 3 (ceiling) + Item 5 (schedule penalty).
     * Off-shift techs receive 60 % of the base workload score.
     * Techs with no schedule data are assumed always available.
     */
    private int workloadScore(int current, int max, boolean hasSchedule,
                               boolean onShift, int ceiling) {
        if (max <= 0) return ceiling / 2;
        double load = (double) current / max;
        int base;
        if      (load <= 0.25) base = ceiling;
        else if (load <= 0.50) base = (int)(ceiling * 0.75);
        else if (load <= 0.75) base = (int)(ceiling * 0.40);
        else                   base = (int)(ceiling * 0.10);

        // Item 5: penalise off-shift without blocking entirely
        if (hasSchedule && !onShift) base = (int)(base * 0.60);
        return base;
    }

    /**
     * Item 2 — Category-specific resolved count is weighted higher than total.
     * Item 3 — ceiling applied.
     */
    private int historyScore(int totalResolved, BigDecimal rating,
                              Map<String, Integer> categoryMap, String categoryRaw, int ceiling) {
        int half  = ceiling / 2;           // category half
        int other = ceiling - half;        // rating half
        int score = 0;

        // Category-specific history (Item 2)
        int catCount = categoryCount(categoryMap, categoryRaw);
        if      (catCount >= 20) score += half;
        else if (catCount >= 5)  score += (int)(half * 0.60);
        else if (catCount >= 1)  score += (int)(half * 0.20);
        else {
            // Fall back to total resolved (lower weight — not category-specific)
            if      (totalResolved >= 50) score += (int)(half * 0.70);
            else if (totalResolved >= 20) score += (int)(half * 0.40);
            else if (totalResolved >= 5)  score += (int)(half * 0.20);
        }

        // Rating
        if (rating != null) {
            double r = rating.doubleValue();
            if      (r >= 4.5) score += other;
            else if (r >= 3.5) score += (int)(other * 0.60);
            else if (r >= 2.5) score += (int)(other * 0.20);
        }
        return score;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int categoryCount(Map<String, Integer> map, String categoryRaw) {
        if (map == null || map.isEmpty()) return 0;
        return map.entrySet().stream()
                .filter(e -> e.getKey().equalsIgnoreCase(categoryRaw))
                .mapToInt(Map.Entry::getValue)
                .sum();
    }

    /** Strip common suffixes so "Kigali City" and "Kigali" both → "kigali". */
    private String normalise(String raw) {
        return raw.toLowerCase()
                  .replaceAll("\\s+(province|city|region|district)$", "")
                  .trim();
    }

    /** Tokenise text into meaningful words (length > 2, split on common delimiters). */
    private Set<String> tokenize(String text) {
        Set<String> words = new HashSet<>();
        for (String w : text.split("[\\s/,&\\-]+")) {
            if (w.length() > 2) words.add(w.toLowerCase());
        }
        return words;
    }
}
