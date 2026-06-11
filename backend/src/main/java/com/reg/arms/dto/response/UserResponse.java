package com.reg.arms.dto.response;

import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.UserRole;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class UserResponse {

    private Long id;
    private String firstName;
    private String lastName;
    private String fullName;
    private String email;
    private String phone;
    private UserRole role;
    private String province;
    private String district;
    private String sector;
    private String cell;
    private String village;
    private Boolean isActive;
    private Boolean emailVerified;
    private String profilePhoto;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .province(user.getProvince())
                .district(user.getDistrict())
                .sector(user.getSector())
                .cell(user.getCell())
                .village(user.getVillage())
                .isActive(user.getIsActive())
                .emailVerified(user.getEmailVerified())
                .profilePhoto(user.getProfilePhoto())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
