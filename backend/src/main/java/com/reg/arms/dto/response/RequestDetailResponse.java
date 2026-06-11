package com.reg.arms.dto.response;

import com.reg.arms.entity.Request;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import com.reg.arms.util.SlaUtils;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Builder
public class RequestDetailResponse {

    private Long id;
    private String requestCode;
    private String title;
    private String description;
    private RequestStatus status;
    private PriorityLevel finalPriority;
    private PriorityLevel aiPriority;
    private BigDecimal aiConfidence;
    private PriorityLevel manualPriority;
    private Map<String, Object> aiKeywordsDetected;
    private String province;
    private String district;
    private String sector;
    private String cell;
    private String village;
    private String phone;
    private String resolutionNotes;
    private LocalDateTime resolvedAt;
    private LocalDateTime closedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    private Long categoryId;
    private String categoryName;

    private Long technicianId;
    private String technicianName;
    private String technicianEmail;

    private List<CommentResponse> comments;
    private List<AttachmentResponse> attachments;

    // ── SLA fields ──────────────────────────────────────────────────────────────
    private LocalDateTime slaDeadline;
    /** OK | AT_RISK | BREACHED */
    private String slaStatus;
    /** True when the scheduler auto-escalated this request to Critical due to SLA breach */
    private boolean autoEscalated;
    private LocalDateTime slaEscalatedAt;

    // ── AI-assisted resolution estimate ────────────────────────────────────────
    /** Average hours to resolve requests of this priority+category (null = not enough data) */
    private Double estimatedResolutionHours;

    // ── Customer satisfaction rating ────────────────────────────────────────────
    /** 1–5 star rating left by the customer after resolution.  Null until rated. */
    private Integer satisfactionRating;
    private String customerFeedback;

    /**
     * True when this request was submitted while the customer already had another
     * open request in the same category.  Surfaced as a "Possible Duplicate" badge
     * for Staff and Admin only — never exposed to the customer in the UI.
     */
    private boolean possibleDuplicate;

    public static RequestDetailResponse from(Request r,
                                             List<CommentResponse> comments,
                                             List<AttachmentResponse> attachments,
                                             Double estimatedResolutionHours) {
        PriorityLevel priority = r.getFinalPriority();
        LocalDateTime deadline = r.getCreatedAt() != null
                ? SlaUtils.deadline(r.getCreatedAt(), priority) : null;
        String slaStatus = r.getCreatedAt() != null
                ? SlaUtils.status(r.getCreatedAt(), priority, r.getResolvedAt()).name() : null;

        return RequestDetailResponse.builder()
                .id(r.getId())
                .requestCode(r.getRequestCode())
                .title(r.getTitle())
                .description(r.getDescription())
                .status(r.getStatus())
                .finalPriority(priority)
                .aiPriority(r.getAiPriority())
                .aiConfidence(r.getAiConfidence())
                .manualPriority(r.getManualPriority())
                .aiKeywordsDetected(r.getAiKeywordsDetected())
                .province(r.getProvince())
                .district(r.getDistrict())
                .sector(r.getSector())
                .cell(r.getCell())
                .village(r.getVillage())
                .phone(r.getPhone())
                .resolutionNotes(r.getResolutionNotes())
                .resolvedAt(r.getResolvedAt())
                .closedAt(r.getClosedAt())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .customerId(r.getCustomer().getId())
                .customerName(r.getCustomer().getFullName())
                .customerEmail(r.getCustomer().getEmail())
                .customerPhone(r.getCustomer().getPhone())
                .categoryId(r.getCategory().getId())
                .categoryName(r.getCategory().getName())
                .technicianId(r.getAssignedTechnician() != null ? r.getAssignedTechnician().getId() : null)
                .technicianName(r.getAssignedTechnician() != null ? r.getAssignedTechnician().getFullName() : null)
                .technicianEmail(r.getAssignedTechnician() != null ? r.getAssignedTechnician().getEmail() : null)
                .comments(comments)
                .attachments(attachments)
                .slaDeadline(deadline)
                .slaStatus(slaStatus)
                .autoEscalated(r.getSlaEscalatedAt() != null)
                .slaEscalatedAt(r.getSlaEscalatedAt())
                .estimatedResolutionHours(estimatedResolutionHours)
                .satisfactionRating(r.getSatisfactionRating())
                .customerFeedback(r.getCustomerFeedback())
                .possibleDuplicate(r.isPossibleDuplicate())
                .build();
    }
}
