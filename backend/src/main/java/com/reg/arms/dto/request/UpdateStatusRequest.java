package com.reg.arms.dto.request;

import com.reg.arms.entity.enums.RequestStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateStatusRequest {

    @NotNull(message = "Status is required")
    private RequestStatus status;

    private String comment;

    /** Written when status is set to Resolved; saved to request.resolutionNotes. */
    private String resolutionNotes;
}
