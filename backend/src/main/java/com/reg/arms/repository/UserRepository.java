package com.reg.arms.repository;

import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByRoleAndIsActiveTrue(UserRole role);

    List<User> findByRoleInAndIsActiveTrue(List<UserRole> roles);

    List<User> findAllByOrderByCreatedAtDesc();

    Optional<User> findByResetToken(String resetToken);

    List<User> findAllByRoleAndIsActiveTrue(UserRole role);

    /** Self-registered customers awaiting admin approval */
    List<User> findAllByIsActiveFalseAndLastLoginIsNullOrderByCreatedAtAsc();
}
