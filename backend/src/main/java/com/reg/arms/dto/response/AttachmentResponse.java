package com.reg.arms.dto.response;

import com.reg.arms.entity.RequestAttachment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AttachmentResponse {

    private Long id;
    private String fileName;
    private String filePath;
    private Integer fileSize;
    private String fileType;
    private LocalDateTime createdAt;

    public static AttachmentResponse from(RequestAttachment a) {
        return AttachmentResponse.builder()
                .id(a.getId())
                .fileName(a.getFileName())
                .filePath(a.getFilePath())
                .fileSize(a.getFileSize())
                .fileType(a.getFileType())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
