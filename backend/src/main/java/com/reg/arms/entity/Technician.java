package com.reg.arms.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "technicians")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Technician extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "employee_id", unique = true, length = 50)
    private String employeeId;

    @Column(length = 200)
    private String specialization;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "province_coverage", columnDefinition = "jsonb")
    private List<String> provinceCoverage;

    @Column(name = "is_available", nullable = false)
    @Builder.Default
    private Boolean isAvailable = true;

    @Column(name = "current_workload", nullable = false)
    @Builder.Default
    private Integer currentWorkload = 0;

    @Column(name = "max_workload", nullable = false)
    @Builder.Default
    private Integer maxWorkload = 5;

    @Column(precision = 3, scale = 2)
    private BigDecimal rating;

    @Column(name = "total_resolved", nullable = false)
    @Builder.Default
    private Integer totalResolved = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> certifications;

    // ── Smart-matching enhancements (V13) ─────────────────────────────────────

    /** District-level service areas (e.g. ["Gasabo", "Kicukiro"]) */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "district_coverage", columnDefinition = "jsonb")
    private List<String> districtCoverage;

    /**
     * Number of requests resolved per category name.
     * Example: {"Power Outage": 12, "Meter Issues": 4}
     * Populated automatically by TechnicianService.recordResolution().
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "category_resolved_counts", columnDefinition = "jsonb")
    private Map<String, Integer> categoryResolvedCounts;

    /**
     * Structured specialization tags — exact category names staff assigned
     * to this technician (e.g. ["Power Outage", "Safety Hazard"]).
     * Used for precise matching instead of keyword tokenization.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "specialization_tags", columnDefinition = "jsonb")
    private List<String> specializationTags;

    // ── Pursue-flow tracking (V21) ────────────────────────────────────────────

    /**
     * The request this technician is currently pursuing (status = In_Progress).
     * Non-null  → technician is "Pursuing" — occupied but can still receive new assignments.
     * Null      → technician is "Free" — given priority by the routing algorithm.
     *
     * Set automatically when the technician clicks "Pursue".
     * Cleared automatically when the request is Resolved, Closed, or Cancelled.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pursuing_request_id")
    private com.reg.arms.entity.Request pursuingRequest;
}
