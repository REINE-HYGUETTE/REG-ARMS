package com.reg.arms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class EditCommentRequest {

    @NotBlank(message = "Comment body must not be blank")
    @Size(max = 5000, message = "Comment must not exceed 5000 characters")
    private String body;
}
