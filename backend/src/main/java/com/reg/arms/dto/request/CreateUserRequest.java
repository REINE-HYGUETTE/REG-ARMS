package com.reg.arms.dto.request;

import com.reg.arms.entity.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateUserRequest {

    // Name is optional: the invite flow only needs an email + role. The invited
    // user fills in their own name and password when they accept the invitation.
    @Size(max = 100)
    private String firstName;

    @Size(max = 100)
    private String lastName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @Size(max = 20)
    private String phone;

    @NotNull(message = "Role is required")
    private UserRole role;

    private String password;  // optional — auto-generated if blank

    /**
     * Province for the new account.
     * Required when creating a STAFF account (admin assigns their coverage province).
     * Ignored when STAFF creates a TECHNICIAN (auto-inherited from the staff member).
     */
    @Size(max = 100)
    private String province;

    /**
     * District for the new account.
     * Required when creating a STAFF account (admin assigns their coverage district).
     * Ignored when STAFF creates a TECHNICIAN (auto-inherited from the staff member).
     */
    @Size(max = 100)
    private String district;
}
