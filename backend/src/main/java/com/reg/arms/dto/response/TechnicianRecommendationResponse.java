package com.reg.arms.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * A technician ranked against a specific request by the smart-matching
 * algorithm.  Staff still makes the final assignment decision.
 */
@Getter
@Builder
public class TechnicianRecommendationResponse {

    /** Technician entity primary key */
    private Long id;

    /** Associated user ID — this is what the assign endpoint expects */
    private Long userId;

    private String fullName;
    private String email;
    private String employeeId;
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

    /** 0 – 100 composite match score */
    private int matchScore;

    /** Human-readable reasons explaining the score */
    private List<String> matchReasons;

    /**
     * True if the technician is currently pursuing another request.
     * Staff can use this to understand current availability context.
     */
    private boolean isPursuing;
}
