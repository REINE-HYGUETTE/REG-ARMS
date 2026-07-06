package com.reg.arms.dto.response;

import com.reg.arms.entity.enums.UserRole;
import lombok.Builder;
import lombok.Getter;

/** Returned when the accept-invite page validates a token, so it can greet the invitee. */
@Getter
@Builder
public class InvitationInfoResponse {
    private String email;
    private UserRole role;
}
