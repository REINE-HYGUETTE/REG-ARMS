package com.reg.arms.controller;

import com.reg.arms.dto.request.ChangePasswordRequest;
import com.reg.arms.dto.request.CreateUserRequest;
import com.reg.arms.dto.request.UpdateProfileRequest;
import com.reg.arms.dto.request.UpdateUserRequest;
import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.dto.response.UserResponse;
import com.reg.arms.security.UserPrincipal;
import com.reg.arms.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<UserResponse> getProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userService.getProfile(principal.getId()));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(principal.getId(), request));
    }

    @PatchMapping("/profile/photo")
    public ResponseEntity<UserResponse> updateProfilePhoto(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody java.util.Map<String, String> body) {
        return ResponseEntity.ok(userService.updateProfilePhoto(principal.getId(), body.get("photo")));
    }

    @PostMapping("/profile/change-password")
    public ResponseEntity<ApiResponse> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully."));
    }

    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> listUsers(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userService.listAllUsers(principal.getId()));
    }

    @PostMapping("/admin/users/{id}/resend-invite")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> resendInvite(
            @PathVariable Long id) {
        userService.resendInvite(id);
        return ResponseEntity.ok(ApiResponse.success("Invitation resent successfully."));
    }

    /**
     * Create a new user account.
     * ADMIN → any role; STAFF → TECHNICIAN only (district auto-inherited).
     */
    @PostMapping("/admin/users")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.createUser(request, principal));
    }

    @PutMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userService.updateUser(id, principal.getId(), request));
    }

    @DeleteMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> deleteUser(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        userService.deleteUser(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully."));
    }

    @PatchMapping("/admin/users/{id}/toggle-status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> toggleStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        userService.toggleUserStatus(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.success("User status toggled."));
    }

    @PatchMapping("/admin/users/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> approveUser(@PathVariable Long id) {
        userService.approveUser(id);
        return ResponseEntity.ok(ApiResponse.success("User account approved and notified by email."));
    }

    @DeleteMapping("/admin/users/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> rejectUser(@PathVariable Long id) {
        userService.rejectUser(id);
        return ResponseEntity.ok(ApiResponse.success("Registration rejected and applicant notified."));
    }

    @GetMapping("/admin/users/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> listPendingUsers() {
        return ResponseEntity.ok(userService.listPendingUsers());
    }
}
