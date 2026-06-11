package com.reg.arms.service;

import com.reg.arms.dto.request.ChangePasswordRequest;
import com.reg.arms.dto.request.CreateUserRequest;
import com.reg.arms.dto.request.UpdateProfileRequest;
import com.reg.arms.dto.request.UpdateUserRequest;
import com.reg.arms.dto.response.UserResponse;
import com.reg.arms.entity.Technician;
import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.exception.BadRequestException;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.TechnicianRepository;
import com.reg.arms.repository.UserRepository;
import com.reg.arms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TechnicianRepository technicianRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Transactional(readOnly = true)
    public UserResponse getProfile(Long userId) {
        User user = findUserOrThrow(userId);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUserOrThrow(userId);
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhone(request.getPhone());
        user.setProvince(request.getProvince());
        user.setDistrict(request.getDistrict());
        user.setSector(request.getSector());
        user.setCell(request.getCell());
        user.setVillage(request.getVillage());
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    /** Maximum allowed profile photo size: 2 MB as a base64 data URL (≈ 2.73 MB encoded). */
    private static final int MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB encoded ceiling

    @Transactional
    public UserResponse updateProfilePhoto(Long userId, String photoDataUrl) {
        if (photoDataUrl == null || !photoDataUrl.startsWith("data:image/")) {
            throw new BadRequestException("Invalid image format. Must be a base64 data URL.");
        }
        if (photoDataUrl.length() > MAX_PHOTO_BYTES) {
            throw new BadRequestException("Profile photo is too large. Maximum size is 2 MB.");
        }
        // Only allow safe image MIME types
        String header = photoDataUrl.substring(0, Math.min(50, photoDataUrl.length()));
        if (!header.startsWith("data:image/jpeg;") && !header.startsWith("data:image/png;")
                && !header.startsWith("data:image/gif;") && !header.startsWith("data:image/webp;")) {
            throw new BadRequestException("Only JPEG, PNG, GIF, and WebP images are allowed.");
        }
        User user = findUserOrThrow(userId);
        user.setProfilePhoto(photoDataUrl);
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        User user = findUserOrThrow(userId);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listPendingUsers() {
        return userRepository.findAllByIsActiveFalseAndLastLoginIsNullOrderByCreatedAtAsc()
                .stream().map(UserResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listAllUsers(Long requesterId) {
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(u -> !u.getId().equals(requesterId))
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public void resendInvite(Long targetId) {
        User user = findUserOrThrow(targetId);
        if (user.getLastLogin() != null) {
            throw new BadRequestException("This user has already logged in. Use the edit form to update their details.");
        }
        byte[] bytes = new byte[8];
        new SecureRandom().nextBytes(bytes);
        String newPassword = HexFormat.of().formatHex(bytes);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        emailService.sendWelcomeEmailWithCredentials(user.getEmail(), user.getFullName(), newPassword);
    }

    /**
     * Creates a new user account.
     *
     * Rules enforced by creator role:
     * <ul>
     *   <li>ADMIN — can create any role; province/district taken from DTO (required for STAFF).</li>
     *   <li>STAFF — can only create TECHNICIAN accounts; province/district auto-inherited from
     *       the staff member's own profile (DTO values are ignored).</li>
     * </ul>
     *
     * @param request   user details from the API caller
     * @param creator   authenticated principal making the request
     */
    @Transactional
    public UserResponse createUser(CreateUserRequest request, UserPrincipal creator) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already registered");
        }

        // ── Role-based creation rules ──────────────────────────────────────────
        String inheritedProvince = null;
        String inheritedDistrict = null;

        if (creator.getRole() == UserRole.STAFF) {
            // Staff may ONLY create technician accounts
            if (!UserRole.TECHNICIAN.equals(request.getRole())) {
                throw new BadRequestException(
                    "Staff members can only create Technician accounts.");
            }
            // Technician inherits the staff member's province & district
            User staffUser = findUserOrThrow(creator.getId());
            inheritedProvince = staffUser.getProvince();
            inheritedDistrict = staffUser.getDistrict();

        } else if (creator.getRole() == UserRole.ADMIN) {
            // Admin creating a STAFF account: province+district are required
            if (UserRole.STAFF.equals(request.getRole())) {
                if (request.getProvince() == null || request.getProvince().isBlank()) {
                    throw new BadRequestException(
                        "Province is required when creating a Staff account.");
                }
                if (request.getDistrict() == null || request.getDistrict().isBlank()) {
                    throw new BadRequestException(
                        "District is required when creating a Staff account.");
                }
            }
            inheritedProvince = request.getProvince();
            inheritedDistrict = request.getDistrict();
        }

        // ── Generate password if not provided ─────────────────────────────────
        String password = request.getPassword();
        if (password == null || password.isBlank()) {
            byte[] bytes = new byte[8];
            new SecureRandom().nextBytes(bytes);
            password = HexFormat.of().formatHex(bytes);
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .phone(request.getPhone() != null ? request.getPhone() : "")
                .passwordHash(passwordEncoder.encode(password))
                .role(request.getRole())
                .province(inheritedProvince)
                .district(inheritedDistrict)
                .isActive(true)
                .emailVerified(false)
                .build();

        user = userRepository.save(user);

        // ── Auto-create Technician profile ────────────────────────────────────
        if (UserRole.TECHNICIAN.equals(user.getRole())) {
            String employeeId = String.format("EMP%03d", technicianRepository.count() + 1);
            Technician tech = Technician.builder()
                    .user(user)
                    .employeeId(employeeId)
                    .isAvailable(true)
                    .currentWorkload(0)
                    .maxWorkload(5)
                    .totalResolved(0)
                    .build();
            technicianRepository.save(tech);
        }

        final String savedPassword = password;
        final String fullName = user.getFirstName() + " " + user.getLastName();
        emailService.sendWelcomeEmailWithCredentials(user.getEmail(), fullName, savedPassword);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateUser(Long targetId, Long requesterId, UpdateUserRequest request) {
        if (targetId.equals(requesterId) && request.getRole() != null) {
            User self = findUserOrThrow(requesterId);
            if (request.getRole() != self.getRole()) {
                throw new BadRequestException("You cannot change your own role");
            }
        }

        User user = findUserOrThrow(targetId);

        if (!user.getEmail().equalsIgnoreCase(request.getEmail())
                && userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already in use by another account");
        }

        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getRole() != null) user.setRole(request.getRole());
        if (request.getProvince() != null) user.setProvince(request.getProvince());
        if (request.getDistrict() != null) user.setDistrict(request.getDistrict());
        if (request.getSector() != null) user.setSector(request.getSector());
        if (request.getCell() != null) user.setCell(request.getCell());
        if (request.getVillage() != null) user.setVillage(request.getVillage());

        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    /** Approve a self-registered customer account (isActive=false, lastLogin=null) */
    @Transactional
    public void approveUser(Long targetId) {
        User user = findUserOrThrow(targetId);
        if (Boolean.TRUE.equals(user.getIsActive())) {
            throw new BadRequestException("User account is already active");
        }
        user.setIsActive(true);
        userRepository.save(user);
        emailService.sendAccountApprovedEmail(user.getEmail(), user.getFullName());
    }

    /** Reject (delete) a pending self-registered account that has never logged in */
    @Transactional
    public void rejectUser(Long targetId) {
        User user = findUserOrThrow(targetId);
        if (user.getLastLogin() != null) {
            throw new BadRequestException("Cannot reject a user who has already logged in. Use deactivate instead.");
        }
        emailService.sendAccountRejectedEmail(user.getEmail(), user.getFullName());
        userRepository.delete(user);
    }

    @Transactional
    public void deleteUser(Long targetId, Long requesterId) {
        if (targetId.equals(requesterId)) {
            throw new BadRequestException("You cannot delete your own account");
        }
        User user = findUserOrThrow(targetId);
        try {
            userRepository.delete(user);
            userRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new BadRequestException(
                "Cannot delete this user because they have existing requests, comments, or other data. Deactivate them instead.");
        }
    }

    @Transactional
    public void toggleUserStatus(Long targetId, Long requesterId) {
        if (targetId.equals(requesterId)) {
            throw new BadRequestException("You cannot deactivate your own account");
        }
        User user = findUserOrThrow(targetId);
        user.setIsActive(!user.getIsActive());
        userRepository.save(user);
    }

    private User findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }
}
