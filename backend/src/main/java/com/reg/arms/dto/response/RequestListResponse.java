package com.reg.arms.dto.response;

import com.reg.arms.entity.Request;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import com.reg.arms.util.SlaUtils;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class RequestListResponse {

    private Long id;
    private String requestCode;
    private String title;
    private RequestStatus status;
    private PriorityLevel finalPriority;
    private PriorityLevel aiPriority;
    private BigDecimal aiConfidence;
    private String province;
    private String district;
    private String customerName;
    private String categoryName;
    private String technicianName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ── SLA fields ──────────────────────────────────────────────────────────────
    private LocalDateTime slaDeadline;
    /** OK | AT_RISK | BREACHED */
    private String slaStatus;
    /** True when the scheduler auto-escalated this request to Critical due to SLA breach */
    private boolean autoEscalated;

    /**
     * True when this request was submitted while the customer already had another
     * open request in the same category.  Shown as a "Possible Duplicate" badge
     * for Staff and Admin only.
     */
    private boolean possibleDuplicate;

    public static RequestListResponse from(Request r) {
        PriorityLevel priority = r.getFinalPriority();
        LocalDateTime deadline = r.getCreatedAt() != null
                ? SlaUtils.deadline(r.getCreatedAt(), priority) : null;
        String slaStatus = r.getCreatedAt() != null
                ? SlaUtils.status(r.getCreatedAt(), priority, r.getResolvedAt()).name() : null;

        return RequestListResponse.builder()
                .id(r.getId())
                .requestCode(r.getRequestCode())
                .title(r.getTitle())
                .status(r.getStatus())
                .finalPriority(priority)
                .aiPriority(r.getAiPriority())
                .aiConfidence(r.getAiConfidence())
                .province(r.getProvince())
                .district(r.getDistrict())
                .customerName(r.getCustomer().getFullName())
                .categoryName(r.getCategory().getName())
                .technicianName(r.getAssignedTechnician() != null ? r.getAssignedTechnician().getFullName() : null)
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .slaDeadline(deadline)
                .slaStatus(slaStatus)
                .autoEscalated(r.getSlaEscalatedAt() != null)
                .possibleDuplicate(r.isPossibleDuplicate())
                .build();
    }
}
