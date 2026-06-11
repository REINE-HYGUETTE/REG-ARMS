package com.reg.arms.service;

import com.reg.arms.dto.request.ScheduleEntryRequest;
import com.reg.arms.dto.request.UpdateTechnicianProfileRequest;
import com.reg.arms.dto.response.RequestListResponse;
import com.reg.arms.dto.response.ScheduleEntryResponse;
import com.reg.arms.dto.response.TechnicianResponse;
import com.reg.arms.entity.Technician;
import com.reg.arms.entity.TechnicianSchedule;
import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.RequestStatus;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.RequestRepository;
import com.reg.arms.repository.TechnicianRepository;
import com.reg.arms.repository.TechnicianScheduleRepository;
import com.reg.arms.repository.UserRepository;
import com.reg.arms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TechnicianService {

    private final TechnicianRepository technicianRepository;
    private final TechnicianScheduleRepository scheduleRepository;
    private final RequestRepository requestRepository;
    private final UserRepository userRepository;

    /**
     * Returns technicians visible to the calling principal.
     * <ul>
     *   <li>ADMIN — sees all technicians across all districts.</li>
     *   <li>STAFF — sees only technicians in their own district (scoped by user.district).
     *       If the staff member has no district set, falls back to all technicians.</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public List<TechnicianResponse> listAll(UserPrincipal principal) {
        if (principal.getRole() == UserRole.STAFF) {
            User staffUser = userRepository.findById(principal.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", principal.getId()));
            String district = staffUser.getDistrict();
            if (district != null && !district.isBlank()) {
                return technicianRepository.findByUser_DistrictIgnoreCase(district)
                        .stream().map(TechnicianResponse::from).toList();
            }
        }
        return technicianRepository.findAll()
                .stream().map(TechnicianResponse::from).toList();
    }

    /**
     * Returns available technicians visible to the calling principal (district-scoped for STAFF).
     */
    @Transactional(readOnly = true)
    public List<TechnicianResponse> listAvailable(UserPrincipal principal) {
        if (principal.getRole() == UserRole.STAFF) {
            User staffUser = userRepository.findById(principal.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", principal.getId()));
            String district = staffUser.getDistrict();
            if (district != null && !district.isBlank()) {
                return technicianRepository
                        .findByUser_DistrictIgnoreCaseAndIsAvailableTrue(district)
                        .stream().map(TechnicianResponse::from).toList();
            }
        }
        return technicianRepository.findByIsAvailableTrueOrderByCurrentWorkloadAsc()
                .stream().map(TechnicianResponse::from).toList();
    }

    @Transactional
    public void incrementWorkload(Long userId) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));
        tech.setCurrentWorkload(tech.getCurrentWorkload() + 1);
        if (tech.getCurrentWorkload() >= tech.getMaxWorkload()) {
            tech.setIsAvailable(false);
        }
        technicianRepository.save(tech);
    }

    @Transactional
    public List<ScheduleEntryResponse> getSchedule(Long userId) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
                    Technician t = Technician.builder()
                            .user(user).employeeId(nextEmployeeId())
                            .isAvailable(true).currentWorkload(0)
                            .maxWorkload(5).totalResolved(0).build();
                    return technicianRepository.save(t);
                });
        return scheduleRepository.findByTechnicianIdOrderByDayOfWeek(tech.getId())
                .stream().map(ScheduleEntryResponse::from).toList();
    }

    @Transactional
    public List<ScheduleEntryResponse> updateSchedule(Long userId, List<ScheduleEntryRequest> entries) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));

        scheduleRepository.deleteByTechnicianId(tech.getId());
        scheduleRepository.flush();

        List<TechnicianSchedule> saved = entries.stream().map(e -> TechnicianSchedule.builder()
                .technician(tech)
                .dayOfWeek(e.getDayOfWeek().toUpperCase())
                .startTime(LocalTime.parse(e.getStartTime()))
                .endTime(LocalTime.parse(e.getEndTime()))
                .isWorking(e.getIsWorking())
                .build()
        ).toList();

        return scheduleRepository.saveAll(saved)
                .stream().map(ScheduleEntryResponse::from).toList();
    }

    @Transactional
    public TechnicianResponse getByUserId(Long userId) {
        return TechnicianResponse.from(
                technicianRepository.findByUserId(userId)
                        .orElseGet(() -> {
                            User user = userRepository.findById(userId)
                                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
                            Technician tech = Technician.builder()
                                    .user(user).employeeId(nextEmployeeId())
                                    .isAvailable(true).currentWorkload(0)
                                    .maxWorkload(5).totalResolved(0).build();
                            return technicianRepository.save(tech);
                        }));
    }

    @Transactional
    public void toggleAvailability(Long userId) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
                    Technician t = Technician.builder()
                            .user(user).employeeId(nextEmployeeId())
                            .isAvailable(true).currentWorkload(0)
                            .maxWorkload(5).totalResolved(0).build();
                    return technicianRepository.save(t);
                });
        tech.setIsAvailable(!tech.getIsAvailable());
        technicianRepository.save(tech);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTechnicianRequests(Long technicianId) {
        Technician tech = technicianRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "id", technicianId));
        Long userId = tech.getUser().getId();

        List<RequestListResponse> active = requestRepository
                .findByAssignedTechnicianIdAndStatusInOrderByCreatedAtDesc(
                        userId, List.of(RequestStatus.Pending, RequestStatus.In_Progress))
                .stream().map(RequestListResponse::from).toList();

        List<RequestListResponse> history = requestRepository
                .findByAssignedTechnicianIdAndStatusInOrderByCreatedAtDesc(
                        userId, List.of(RequestStatus.Resolved, RequestStatus.Closed))
                .stream().map(RequestListResponse::from).toList();

        return Map.of("active", active, "history", history);
    }

    @Transactional
    public void decrementWorkload(Long userId) {
        recordResolution(userId, null);
    }

    /**
     * Called when a request is marked Resolved.
     * Decrements active workload, increments total resolved, and updates the
     * per-category resolved count map (Item 2 — category-specific history).
     *
     * @param userId       technician's user ID
     * @param categoryName the category of the resolved request (may be null for legacy calls)
     */
    @Transactional
    public void recordResolution(Long userId, String categoryName) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));
        tech.setCurrentWorkload(Math.max(0, tech.getCurrentWorkload() - 1));
        tech.setTotalResolved(tech.getTotalResolved() + 1);
        if (tech.getCurrentWorkload() < tech.getMaxWorkload()) {
            tech.setIsAvailable(true);
        }

        // Item 2: track per-category resolution count
        if (categoryName != null && !categoryName.isBlank()) {
            Map<String, Integer> counts = new HashMap<>(
                    tech.getCategoryResolvedCounts() != null
                    ? tech.getCategoryResolvedCounts() : Map.of());
            counts.merge(categoryName, 1, Integer::sum);
            tech.setCategoryResolvedCounts(counts);
        }

        technicianRepository.save(tech);
    }

    /**
     * Staff / Admin update — restricted to capacity management only.
     * Specialisation, tags, and coverage areas are the technician's own responsibility
     * and can only be updated via the technician self-service endpoint.
     */
    @Transactional
    public TechnicianResponse updateProfile(Long techId, UpdateTechnicianProfileRequest req) {
        Technician tech = technicianRepository.findById(techId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "id", techId));
        // Only maxWorkload is editable by staff — all other fields are technician-owned
        if (req.getMaxWorkload() != null && req.getMaxWorkload() > 0)
            tech.setMaxWorkload(req.getMaxWorkload());
        return TechnicianResponse.from(technicianRepository.save(tech));
    }

    /**
     * Technician self-service update of their own profile fields.
     * Identical to {@link #updateProfile} but intentionally excludes
     * {@code maxWorkload} — capacity limits are a staff/admin decision.
     */
    @Transactional
    public TechnicianResponse updateMyProfile(Long userId, UpdateTechnicianProfileRequest req) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
                    Technician t = Technician.builder()
                            .user(user).employeeId(nextEmployeeId())
                            .isAvailable(true).currentWorkload(0)
                            .maxWorkload(5).totalResolved(0).build();
                    return technicianRepository.save(t);
                });
        if (req.getSpecialization()     != null) tech.setSpecialization(req.getSpecialization());
        if (req.getSpecializationTags() != null) tech.setSpecializationTags(req.getSpecializationTags());
        if (req.getProvinceCoverage()   != null) tech.setProvinceCoverage(req.getProvinceCoverage());
        if (req.getDistrictCoverage()   != null) tech.setDistrictCoverage(req.getDistrictCoverage());
        // maxWorkload intentionally excluded — staff-only capacity setting
        return TechnicianResponse.from(technicianRepository.save(tech));
    }

    /**
     * Releases the workload slot when a request is REASSIGNED (not resolved).
     * Unlike decrementWorkload, does NOT increment totalResolved.
     */
    @Transactional
    public void releaseWorkload(Long userId) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));
        tech.setCurrentWorkload(Math.max(0, tech.getCurrentWorkload() - 1));
        if (tech.getCurrentWorkload() < tech.getMaxWorkload()) {
            tech.setIsAvailable(true);
        }
        technicianRepository.save(tech);
    }

    // ── Pursue-flow helpers ───────────────────────────────────────────────────

    /**
     * Marks a technician as "Pursuing" the given request.
     * Called when the technician clicks the Pursue button.
     *
     * @param userId    the technician's user ID
     * @param request   the request being pursued
     */
    @Transactional
    public void setPursuing(Long userId, com.reg.arms.entity.Request request) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));
        tech.setPursuingRequest(request);
        technicianRepository.save(tech);
    }

    /**
     * Clears the pursuing flag for a technician.
     * Called automatically when their pursued request is Resolved, Closed, or Cancelled,
     * or when they click "Cannot Pursue."
     *
     * @param userId  the technician's user ID
     */
    @Transactional
    public void clearPursuing(Long userId) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));
        tech.setPursuingRequest(null);
        technicianRepository.save(tech);
    }

    /**
     * Updates the technician's running average rating.
     * Called after a customer submits a satisfaction score.
     *
     * @param userId     the technician's user ID
     * @param newRating  1.0 – 5.0
     */
    /**
     * Generates the next sequential employee ID in the format EMP001, EMP002, …
     * Based on the current count of technician rows so it always stays unique.
     */
    private String nextEmployeeId() {
        return String.format("EMP%03d", technicianRepository.count() + 1);
    }

    @Transactional
    public void updateRating(Long userId, double newRating) {
        Technician tech = technicianRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Technician", "userId", userId));
        if (tech.getRating() == null) {
            tech.setRating(java.math.BigDecimal.valueOf(newRating).setScale(2, java.math.RoundingMode.HALF_UP));
        } else {
            // Running average: weight existing rating by totalResolved count
            int n = Math.max(1, tech.getTotalResolved());
            double updated = (tech.getRating().doubleValue() * n + newRating) / (n + 1);
            tech.setRating(java.math.BigDecimal.valueOf(updated).setScale(2, java.math.RoundingMode.HALF_UP));
        }
        technicianRepository.save(tech);
    }
}
