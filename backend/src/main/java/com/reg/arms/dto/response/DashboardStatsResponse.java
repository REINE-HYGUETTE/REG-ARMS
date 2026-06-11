package com.reg.arms.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DashboardStatsResponse {

    private long total;
    private long pending;
    private long inProgress;
    private long resolved;
    private long closed;
    private long critical;
    private long high;
    private long thisWeek;
    private Double avgResolutionHours;
}
