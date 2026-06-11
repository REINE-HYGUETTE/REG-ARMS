package com.reg.arms.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * A geographic cluster of high-priority requests detected by the
 * hotspot algorithm (3+ Critical/High requests in the same sector
 * within the last 24 hours).
 */
@Getter
@Builder
public class HotspotResponse {

    private String sector;
    private String district;
    private String province;
    private long requestCount;
    private long criticalCount;
    private long highCount;
    private LocalDateTime latestRequestAt;

    /** Severity label derived from counts: CRITICAL | HIGH | MODERATE */
    private String severity;
}
