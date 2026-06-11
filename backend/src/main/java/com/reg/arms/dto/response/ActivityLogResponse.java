package com.reg.arms.dto.response;

import com.reg.arms.entity.ActivityLog;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ActivityLogResponse {

    private Long id;
    private String action;
    private String description;
    private String oldValue;
    private String newValue;
    private String actorName;
    private String actorRole;
    private LocalDateTime createdAt;

    public static ActivityLogResponse from(ActivityLog log) {
        String actorName = "System";
        String actorRole = "SYSTEM";
        if (log.getUser() != null) {
            actorName = log.getUser().getFullName();
            actorRole = log.getUser().getRole().name();
        }
        return ActivityLogResponse.builder()
                .id(log.getId())
                .action(log.getAction())
                .description(log.getDescription())
                .oldValue(log.getOldValue())
                .newValue(log.getNewValue())
                .actorName(actorName)
                .actorRole(actorRole)
                .createdAt(log.getCreatedAt())
                .build();
    }
}
