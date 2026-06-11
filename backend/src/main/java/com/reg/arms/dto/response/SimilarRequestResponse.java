package com.reg.arms.dto.response;

import com.reg.arms.entity.Request;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.entity.enums.RequestStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * A request that is potentially a duplicate of or closely related to another.
 */
@Getter
@Builder
public class SimilarRequestResponse {

    private Long id;
    private String requestCode;
    private String title;
    private RequestStatus status;
    private PriorityLevel finalPriority;
    private String categoryName;
    private String province;
    private String district;
    private String technicianName;
    private LocalDateTime createdAt;

    public static SimilarRequestResponse from(Request r) {
        return SimilarRequestResponse.builder()
                .id(r.getId())
                .requestCode(r.getRequestCode())
                .title(r.getTitle())
                .status(r.getStatus())
                .finalPriority(r.getFinalPriority())
                .categoryName(r.getCategory().getName())
                .province(r.getProvince())
                .district(r.getDistrict())
                .technicianName(r.getAssignedTechnician() != null
                        ? r.getAssignedTechnician().getFullName() : null)
                .createdAt(r.getCreatedAt())
                .build();
    }
}
