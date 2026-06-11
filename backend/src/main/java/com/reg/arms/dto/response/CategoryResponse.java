package com.reg.arms.dto.response;

import com.reg.arms.entity.Category;
import com.reg.arms.entity.enums.PriorityLevel;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CategoryResponse {

    private Long id;
    private String name;
    private String description;
    private PriorityLevel defaultPriority;
    private Boolean isActive;

    public static CategoryResponse from(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .defaultPriority(category.getDefaultPriority())
                .isActive(category.getIsActive())
                .build();
    }
}
