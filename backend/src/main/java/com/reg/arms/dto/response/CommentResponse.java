package com.reg.arms.dto.response;

import com.reg.arms.entity.Comment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommentResponse {

    private Long id;
    private String body;
    private Boolean isInternal;
    private Long authorId;
    private String authorName;
    private String authorRole;
    private LocalDateTime createdAt;

    public static CommentResponse from(Comment c) {
        return CommentResponse.builder()
                .id(c.getId())
                .body(c.getBody())
                .isInternal(c.getIsInternal())
                .authorId(c.getUser().getId())
                .authorName(c.getUser().getFullName())
                .authorRole(c.getUser().getRole().name())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
