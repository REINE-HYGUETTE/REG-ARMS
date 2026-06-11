package com.reg.arms.service;

import com.reg.arms.dto.request.*;
import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.dto.response.AuthResponse;
import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.exception.BadRequestException;
import com.reg.arms.repository.UserRepository;
import com.reg.arms.security.JwtTokenProvider;
import com.reg.arms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Transactional
    public AuthResponse login(LoginRequest request, String ipAddress) {
        // Give specific, helpful errors for inactive accounts before Spring Security
        // swallows the reason into a generic "User is disabled / locked" message.
        userRepository.findByEmail(request.getEmail()).ifPresent(candidate -> {
            if (Boolean.FALSE.equals(candidate.getIsActive())) {
                if (candidate.getLastLogin() == null) {
                    throw new BadRequestException(
                            "Your account is pending admin approval. You will receive an email once it is activated.");
                } else {
                    throw new BadRequestException(
                            "Your account has been deactivated. Please contact REG support.");
                }
            }
        });

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String token = tokenProvider.generateToken(authentication);

        User user = userRepository.findById(principal.getId()).orElseThrow();
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        activityLogService.log(user, "login", "User logged in", ipAddress);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .userId(principal.getId())
                .fullName(principal.getFullName())
                .email(principal.getEmail())
                .role(principal.getRole())
                .build();
    }

    @Transactional
    public ApiResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already registered");
        }

        // Defensive guard: @NotBlank on the DTO should catch this, but log and
        // hard-fail here too so no silent override can sneak a blank name through.
        if (request.getFirstName() == null || request.getFirstName().isBlank()) {
            log.error("register() called with blank firstName for email={}", request.getEmail());
            throw new BadRequestException("First name is required");
        }
        if (request.getLastName() == null || request.getLastName().isBlank()) {
            log.error("register() called with blank lastName for email={}", request.getEmail());
            throw new BadRequestException("Last name is required");
        }

        log.info("Registering new customer: firstName='{}', lastName='{}', email='{}'",
                request.getFirstName(), request.getLastName(), request.getEmail());

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(UserRole.CUSTOMER)
                .province(request.getProvince())
                .isActive(false)          // awaits admin approval
                .emailVerified(false)
                .build();

        user = userRepository.save(user);

        // Notify the applicant
        emailService.sendRegistrationPendingEmail(user.getEmail(), user.getFullName());

        // Notify every active admin
        final User savedUser = user;
        userRepository.findAllByRoleAndIsActiveTrue(UserRole.ADMIN)
                .forEach(admin -> emailService.sendNewRegistrationNotificationToAdmin(
                        admin.getEmail(), admin.getFirstName(), savedUser.getFullName(), savedUser.getEmail()));

        return ApiResponse.success(
                "Registration successful. Your account is pending admin approval. " +
                "You will receive an email once your account is activated.");
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            byte[] tokenBytes = new byte[32];
            new SecureRandom().nextBytes(tokenBytes);
            String rawToken = HexFormat.of().formatHex(tokenBytes);

            user.setResetToken(rawToken);
            user.setResetExpires(LocalDateTime.now().plusHours(1));
            userRepository.save(user);

            String resetUrl = frontendUrl + "/reset-password?token=" + rawToken;
            emailService.sendPasswordResetEmail(user.getEmail(), user.getFullName(), resetUrl);
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByResetToken(request.getToken())
                .orElseThrow(() -> new BadRequestException("Invalid or expired reset token"));

        if (user.getResetExpires() == null || user.getResetExpires().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Invalid or expired reset token");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setResetToken(null);
        user.setResetExpires(null);
        userRepository.save(user);
    }
}
