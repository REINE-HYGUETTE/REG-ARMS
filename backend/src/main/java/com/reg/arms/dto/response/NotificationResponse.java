package com.reg.arms.dto.response;

import com.reg.arms.entity.Notification;
import com.reg.arms.entity.enums.NotificationType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationResponse {

    private Long id;
    private NotificationType type;
    private String title;
    private String message;
    private Boolean isRead;
    private Long requestId;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .isRead(n.getIsRead())
                .requestId(n.getRequest() != null ? n.getRequest().getId() : null)
                .createdAt(n.getCreatedAt())
                .build();
    }
}
