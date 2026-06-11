package com.reg.arms.dto.response;

import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.service.AiPredictionService.AiResult;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PredictResponseDto {

    private PriorityLevel priority;
    private double        confidence;
    private List<String>  keywords;
    private List<String>  topFeatures;
    private boolean       isUncertain;
    private String        suggestedTechnician;

    public static PredictResponseDto from(AiResult result) {
        return PredictResponseDto.builder()
                .priority(result.priority())
                .confidence(result.confidence().doubleValue())
                .keywords(result.keywords()    != null ? result.keywords()    : List.of())
                .topFeatures(result.topFeatures() != null ? result.topFeatures() : List.of())
                .isUncertain(result.isUncertain())
                .suggestedTechnician(null)
                .build();
    }
}
