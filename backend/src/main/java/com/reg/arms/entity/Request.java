package com.reg.arms.entity;

import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Request extends BaseEntity {

    @Column(name = "request_code", nullable = false, unique = true, length = 30)
    private String requestCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 100)
    private String province;

    @Column(nullable = false, length = 100)
    private String district;

    @Column(length = 100)
    private String sector;

    @Column(length = 100)
    private String cell;

    @Column(length = 100)
    private String village;

    @Column(nullable = false, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_priority", columnDefinition = "priority_level")
    private PriorityLevel aiPriority;

    @Column(name = "ai_confidence", precision = 5, scale = 4)
    private BigDecimal aiConfidence;

    @Column(name = "ai_model_used", length = 100)
    private String aiModelUsed;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_keywords_detected", columnDefinition = "jsonb")
    private Map<String, Object> aiKeywordsDetected;

    @Enumerated(EnumType.STRING)
    @Column(name = "manual_priority", columnDefinition = "priority_level")
    private PriorityLevel manualPriority;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    private User assignedStaff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_tech_id")
    private User assignedTechnician;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "request_status")
    private RequestStatus status;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    /** Set by the SLA breach scheduler once the first breach notification is sent. */
    @Column(name = "sla_breach_notified_at")
    private LocalDateTime slaBreachNotifiedAt;

    /** Set when the scheduler auto-escalates this request's priority to Critical. */
    @Column(name = "sla_escalated_at")
    private LocalDateTime slaEscalatedAt;

    /**
     * Soft-archive timestamp.  When non-null the request is archived and excluded
     * from all active list/stats views.  The row is never physically deleted.
     */
    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    /** Customer satisfaction rating (1–5) after resolution. Null until the customer rates. */
    @Column(name = "satisfaction_rating")
    private Integer satisfactionRating;

    /** Optional text feedback accompanying the satisfaction rating. */
    @Column(name = "customer_feedback", columnDefinition = "TEXT")
    private String customerFeedback;

    /**
     * Flagged {@code true} at creation time when the submitting customer already
     * has another open request in the same category.
     * Customers are blocked from submitting a duplicate at the form level;
     * this flag is surfaced as a "Possible Duplicate" badge for Staff and Admin.
     */
    @Column(name = "possible_duplicate", nullable = false)
    @Builder.Default
    private boolean possibleDuplicate = false;

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RequestAttachment> attachments = new ArrayList<>();

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Comment> comments = new ArrayList<>();

    @Transient
    public PriorityLevel getFinalPriority() {
        if (manualPriority != null) return manualPriority;
        if (aiPriority != null) return aiPriority;
        return PriorityLevel.Medium;
    }
}
