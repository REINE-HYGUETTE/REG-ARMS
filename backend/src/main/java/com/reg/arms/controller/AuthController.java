package com.reg.arms.controller;

import com.reg.arms.dto.request.*;
import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.dto.response.AuthResponse;
import com.reg.arms.dto.response.InvitationInfoResponse;
import com.reg.arms.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(authService.login(request, httpRequest.getRemoteAddr()));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success(
                "If an account exists with that email, a password reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password has been reset successfully."));
    }

    /** Validate an invitation token so the accept-invite page can greet the invitee. */
    @GetMapping("/invitation")
    public ResponseEntity<InvitationInfoResponse> getInvitation(@RequestParam String token) {
        return ResponseEntity.ok(authService.getInvitation(token));
    }

    /** Complete an invited account — the invitee sets their own name and password. */
    @PostMapping("/accept-invite")
    public ResponseEntity<ApiResponse> acceptInvite(@Valid @RequestBody AcceptInviteRequest request) {
        authService.acceptInvite(request);
        return ResponseEntity.ok(ApiResponse.success("Your account has been set up. You can now sign in."));
    }
}
