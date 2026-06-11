package com.reg.arms.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * AI-powered category suggestions returned when a customer types their
 * request title and description before selecting a category.
 */
@Getter
@Builder
public class CategorySuggestionResponse {

    private List<Suggestion> suggestions;

    @Getter
    @Builder
    public static class Suggestion {
        private Long categoryId;
        private String categoryName;
        /** 0.0 – 1.0 confidence / relevance score */
        private double score;
        /** Short human-readable reason for the suggestion */
        private String reason;
    }
}
