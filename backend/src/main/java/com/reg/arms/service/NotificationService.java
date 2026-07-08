package com.reg.arms.service;

import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.entity.Notification;
import com.reg.arms.entity.Request;
import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.NotificationType;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.repository.NotificationRepository;
import com.reg.arms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SseEmitterRegistry sseEmitterRegistry;

    /**
     * Creates and persists a notification for {@code user} and immediately pushes it
     * over SSE if the user is currently connected.
     *
     * @param request may be {@code null} for system-level notifications (e.g. password
     *                reset confirmations, account approvals) that are not associated
     *                with a specific service request.
     */
    @Transactional
    public void notifyUser(User user, Request request, NotificationType type, String title, String message) {
        Notification notification = Notification.builder()
                .user(user)
                .request(request)   // nullable — see Javadoc above
                .type(type)
                .title(title)
                .message(message)
                .isRead(false)
                .emailSent(false)
                .build();
        notificationRepository.save(notification);

        // Push live event via SSE if the user is connected.
        // NB: Map.of rejects null values — it would NPE (and roll back this
        // insert) for system notifications with no linked request.
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type.name());
        payload.put("title", title);
        payload.put("message", message);
        payload.put("requestId", request != null ? request.getId() : null);
        sseEmitterRegistry.push(user.getId(), payload);
    }

    @Transactional
    public void notifyAdmins(Request request, NotificationType type, String title, String message) {
        List<User> recipients = userRepository.findByRoleInAndIsActiveTrue(
                List.of(UserRole.ADMIN));
        for (User user : recipients) {
            notifyUser(user, request, type, title, message);
        }
    }

    /**
     * Notifies all ADMINs plus the STAFF responsible for the request's district —
     * used for new-request routing, SLA breach and problem alerts.
     *
     * <p>Staff visibility is district-scoped everywhere else in the system
     * (request list, dashboard, reports), so staff in other districts are not
     * alerted about requests they cannot even open. Staff without a configured
     * district have global visibility and therefore receive everything, and if
     * the request itself has no district every staff member is notified.
     */
    @Transactional
    public void notifyStaffAndAdmins(Request request, NotificationType type, String title, String message) {
        String requestDistrict = request != null ? request.getDistrict() : null;
        List<User> recipients = userRepository.findByRoleInAndIsActiveTrue(
                List.of(UserRole.ADMIN, UserRole.STAFF));
        for (User user : recipients) {
            if (user.getRole() == UserRole.STAFF
                    && requestDistrict != null && !requestDistrict.isBlank()
                    && user.getDistrict() != null && !user.getDistrict().isBlank()
                    && !requestDistrict.equalsIgnoreCase(user.getDistrict())) {
                continue;   // staff member of a different district — not their request
            }
            notifyUser(user, request, type, title, message);
        }
    }

    @Transactional(readOnly = true)
    public Page<Notification> getUserNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        notificationRepository.markReadByIdAndUserId(notificationId, userId);
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllReadByUserId(userId);
    }
}
