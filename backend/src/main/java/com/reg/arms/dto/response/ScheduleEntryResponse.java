package com.reg.arms.dto.response;

import com.reg.arms.entity.TechnicianSchedule;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ScheduleEntryResponse {

    private String dayOfWeek;
    private String startTime;
    private String endTime;
    private Boolean isWorking;

    public static ScheduleEntryResponse from(TechnicianSchedule s) {
        return ScheduleEntryResponse.builder()
                .dayOfWeek(s.getDayOfWeek())
                .startTime(s.getStartTime().toString())   // "HH:mm"
                .endTime(s.getEndTime().toString())
                .isWorking(s.getIsWorking())
                .build();
    }
}
