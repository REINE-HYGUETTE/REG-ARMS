package com.reg.arms.dto.response;

import com.reg.arms.entity.Technician;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Builder
public class TechnicianResponse {

    private Long id;
    private Long userId;
    private String fullName;
    private String email;
    private String employeeId;
    /** Canonical province — taken from the technician's user account (set at creation time). */
    private String province;
    /** Canonical district — taken from the technician's user account (set at creation time). */
    private String district;
    private String specialization;
    private List<String> specializationTags;
    private List<String> provinceCoverage;
    private List<String> districtCoverage;
    private Map<String, Integer> categoryResolvedCounts;
    private Boolean isAvailable;
    private Integer currentWorkload;
    private Integer maxWorkload;
    private BigDecimal rating;
    private Integer totalResolved;

    /**
     * True when this technician is actively pursuing a request (clicked Pursue and
     * not yet resolved). Used by Staff/Admin to see a live Free vs Pursuing state.
     */
    private boolean isPursuing;

    /** The ID of the request currently being pursued, if any. */
    private Long pursuingRequestId;

    public static TechnicianResponse from(Technician t) {
        return TechnicianResponse.builder()
                .id(t.getId())
                .userId(t.getUser().getId())
                .fullName(t.getUser().getFullName())
                .email(t.getUser().getEmail())
                .employeeId(t.getEmployeeId())
                .province(t.getUser().getProvince())
                .district(t.getUser().getDistrict())
                .specialization(t.getSpecialization())
                .specializationTags(t.getSpecializationTags())
                .provinceCoverage(t.getProvinceCoverage())
                .districtCoverage(t.getDistrictCoverage())
                .categoryResolvedCounts(t.getCategoryResolvedCounts())
                .isAvailable(t.getIsAvailable())
                .currentWorkload(t.getCurrentWorkload())
                .maxWorkload(t.getMaxWorkload())
                .rating(t.getRating())
                .totalResolved(t.getTotalResolved())
                .isPursuing(t.getPursuingRequest() != null)
                .pursuingRequestId(t.getPursuingRequest() != null ? t.getPursuingRequest().getId() : null)
                .build();
    }
}
