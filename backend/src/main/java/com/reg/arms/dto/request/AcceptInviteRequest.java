package com.reg.arms.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** Payload sent when an invited user completes their account setup. */
@Getter
@Setter
public class AcceptInviteRequest {

    @NotBlank(message = "Invitation token is required")
    private String token;

    @NotBlank(message = "First name is required")
    @Size(max = 100)
    private String firstName;

    @NotBlank(message = "Last name is required")
    @Size(max = 100)
    private String lastName;

    @Size(max = 20)
    private String phone;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;
}
