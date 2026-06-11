package com.reg.arms.dto.request;

import com.reg.arms.entity.enums.PriorityLevel;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SetPriorityRequest {

    @NotNull(message = "Priority is required")
    private PriorityLevel priority;
}
