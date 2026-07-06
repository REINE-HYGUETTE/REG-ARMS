package com.reg.arms.service;

import com.reg.arms.dto.response.HotspotResponse;
import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.repository.AiPredictionRepository;
import com.reg.arms.repository.RequestRepository;
import com.reg.arms.repository.UserRepository;
import com.reg.arms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final RequestRepository requestRepository;
    private final AiPredictionRepository aiPredictionRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> monthlyVolume(int months) {
        LocalDateTime since = LocalDateTime.now().minusMonths(months);
        return requestRepository.monthlyVolume(since).stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("month", row[0]);
                    m.put("total", row[1]);
                    m.put("resolved", row[2]);
                    return m;
                }).toList();
    }

    // ── Customer-scoped status counts ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Long> customerStats(Long customerId) {
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("pending", 0L);
        stats.put("inProgress", 0L);
        stats.put("resolved", 0L);
        stats.put("closed", 0L);
        requestRepository.countByStatusForCustomer(customerId).forEach(row -> {
            String status = row[0].toString();
            long count = ((Number) row[1]).longValue();
            switch (status) {
                case "Pending"     -> stats.put("pending",    count);
                case "In_Progress" -> stats.put("inProgress", count);
                case "Resolved"    -> stats.put("resolved",   count);
                case "Closed"      -> stats.put("closed",     count);
            }
        });
        stats.put("total", stats.values().stream().mapToLong(Long::longValue).sum());
        return stats;
    }

    // ── Real AI report data ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> aiSummary() {
        long totalPredictions = aiPredictionRepository.count();
        long manualOverrides  = requestRepository.countManualOverrides();

        List<Object[]> accuracy = aiPredictionRepository.accuracyByPriority();
        long totalConfirmed = 0, totalCorrect = 0;
        for (Object[] row : accuracy) {
            totalConfirmed += ((Number) row[1]).longValue();
            totalCorrect   += ((Number) row[2]).longValue();
        }
        double overallAccuracy = totalConfirmed > 0
                ? (double) totalCorrect / totalConfirmed * 100 : 0;
        double overrideRate = totalPredictions > 0
                ? (double) manualOverrides / totalPredictions * 100 : 0;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalPredictions",  totalPredictions);
        m.put("manualOverrides",   manualOverrides);
        m.put("overrideRate",      overrideRate);
        m.put("overallAccuracy",   overallAccuracy);
        m.put("totalConfirmed",    totalConfirmed);
        m.put("totalCorrect",      totalCorrect);
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> aiConfusionMatrix() {
        return aiPredictionRepository.confusionMatrix().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("predicted", row[0]);
                    m.put("actual",    row[1]);
                    m.put("count",     row[2]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> aiConfidenceDistribution() {
        return aiPredictionRepository.confidenceDistribution().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("range", row[0]);
                    m.put("count", row[1]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> byPriority() {
        return requestRepository.countByFinalPriority().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("priority", row[0]);
                    m.put("count", row[1]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> byCategory() {
        return requestRepository.countByCategory().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("category", row[0]);
                    m.put("count", row[1]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> byProvince() {
        return requestRepository.countByProvince().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("province", row[0]);
                    m.put("count", row[1]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> bySector() {
        return requestRepository.countBySector().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sector", row[0]);
                    m.put("count", row[1]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> technicianPerformance() {
        return requestRepository.technicianPerformance().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("technicianId", row[0]);
                    m.put("firstName", row[1]);
                    m.put("lastName", row[2]);
                    m.put("totalAssigned", row[3]);
                    m.put("totalResolved", row[4]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> aiAccuracy() {
        return aiPredictionRepository.accuracyByPriority().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("predictedPriority", row[0]);
                    m.put("total", row[1]);
                    m.put("correct", row[2]);
                    m.put("avgConfidence", row[3]);
                    return m;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> byStatus() {
        return requestRepository.countByStatusGrouped().stream()
                .map(row -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("status", row[0]);
                    m.put("count", row[1]);
                    return m;
                }).toList();
    }

    // ── SLA metrics ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> slaMetrics() {
        // Native query always returns List<Object[]> — one row, four columns
        List<Object[]> rows = requestRepository.slaMetrics();
        Object[] row = (rows != null && !rows.isEmpty()) ? rows.get(0) : new Object[]{0L, 0L, 0L, 0L};
        long breached          = row[0] != null ? ((Number) row[0]).longValue() : 0L;
        long atRisk            = row[1] != null ? ((Number) row[1]).longValue() : 0L;
        long resolvedWithinSla = row[2] != null ? ((Number) row[2]).longValue() : 0L;
        long totalResolved     = row[3] != null ? ((Number) row[3]).longValue() : 0L;

        double withinSlaRate = totalResolved > 0
                ? (double) resolvedWithinSla / totalResolved * 100 : 0;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("breached",          breached);
        m.put("atRisk",            atRisk);
        m.put("resolvedWithinSla", resolvedWithinSla);
        m.put("totalResolved",     totalResolved);
        m.put("withinSlaRate",     withinSlaRate);
        return m;
    }

    // ── Feature 4: hotspot detection ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HotspotResponse> hotspots(int hours, int minCount, UserPrincipal principal) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);

        // STAFF only see hotspots within their own district (matches the
        // district-scoped request list and dashboard stats). ADMIN sees all.
        List<Object[]> rows;
        if (principal != null && principal.getRole() == UserRole.STAFF) {
            User staff = userRepository.findById(principal.getId()).orElseThrow();
            String district = staff.getDistrict();
            if (district == null || district.isBlank()) {
                return List.of();
            }
            rows = requestRepository.findHotspotsByDistrict(since, minCount, district);
        } else {
            rows = requestRepository.findHotspots(since, minCount);
        }

        return rows.stream()
                .map(row -> {
                    long total = ((Number) row[3]).longValue();
                    long crit  = ((Number) row[4]).longValue();
                    long high  = ((Number) row[5]).longValue();
                    String severity = crit >= 2 ? "CRITICAL" : (crit >= 1 ? "HIGH" : "MODERATE");

                    LocalDateTime latest = toLocalDateTime(row[6]);

                    return HotspotResponse.builder()
                            .sector((String) row[0])
                            .district((String) row[1])
                            .province((String) row[2])
                            .requestCount(total)
                            .criticalCount(crit)
                            .highCount(high)
                            .latestRequestAt(latest)
                            .severity(severity)
                            .build();
                }).toList();
    }

    /**
     * Safely converts a JDBC timestamp column value to {@link LocalDateTime},
     * handling both {@link java.sql.Timestamp} (returned by some JDBC drivers)
     * and {@link LocalDateTime} (returned by others / Hibernate).
     */
    private static LocalDateTime toLocalDateTime(Object value) {
        if (value == null) return LocalDateTime.now();
        if (value instanceof LocalDateTime ldt) return ldt;
        if (value instanceof Timestamp ts)        return ts.toLocalDateTime();
        // Last resort: Instant-based conversion for OffsetDateTime / ZonedDateTime
        if (value instanceof java.time.temporal.Temporal t) {
            return LocalDateTime.from(t);
        }
        throw new IllegalArgumentException("Cannot convert " + value.getClass().getName() + " to LocalDateTime");
    }
}
