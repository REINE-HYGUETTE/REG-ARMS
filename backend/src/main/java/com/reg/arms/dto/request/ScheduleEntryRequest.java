package com.reg.arms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ScheduleEntryRequest {

    @NotBlank
    private String dayOfWeek;

    @NotBlank
    private String startTime;   // "HH:mm"

    @NotBlank
    private String endTime;     // "HH:mm"

    @NotNull
    private Boolean isWorking;
}
