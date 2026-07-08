package com.reg.arms.service;

import com.reg.arms.dto.request.CreateCommentRequest;
import com.reg.arms.dto.response.CommentResponse;
import com.reg.arms.entity.Comment;
import com.reg.arms.entity.Request;
import com.reg.arms.entity.User;
import com.reg.arms.entity.enums.NotificationType;
import com.reg.arms.entity.enums.UserRole;
import com.reg.arms.exception.BadRequestException;
import com.reg.arms.exception.ForbiddenException;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.CommentRepository;
import com.reg.arms.repository.RequestRepository;
import com.reg.arms.repository.UserRepository;
import com.reg.arms.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final RequestRepository requestRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // ── Access guard ───────────────────────────────────────────────────────────

    /**
     * Enforces read access to the comment thread of a request.
     * <ul>
     *   <li>CUSTOMER   — blocked entirely (comments are internal-only)</li>
     *   <li>TECHNICIAN — only if this request is currently assigned to them</li>
     *   <li>STAFF      — only within their own district</li>
     *   <li>ADMIN      — unrestricted</li>
     * </ul>
     */
    private void assertCommentAccess(Request request, UserPrincipal principal) {
        switch (principal.getRole()) {
            case CUSTOMER -> {
                // Customers can only comment on their own requests
                if (!request.getCustomer().getId().equals(principal.getId())) {
                    throw new ForbiddenException("You can only comment on your own requests.");
                }
            }

            case TECHNICIAN -> {
                if (request.getAssignedTechnician() == null
                        || !request.getAssignedTechnician().getId().equals(principal.getId())) {
                    throw new ForbiddenException(
                            "You can only view or post comments on requests assigned to you.");
                }
            }

            case STAFF -> {
                String staffDistrict = principal.getDistrict();
                if (staffDistrict != null && !staffDistrict.isBlank()
                        && !staffDistrict.equalsIgnoreCase(request.getDistrict())) {
                    throw new ForbiddenException(
                            "You can only view or post comments on requests within your district.");
                }
            }

            default -> { /* ADMIN — no restriction */ }
        }
    }

    // ── Public operations ──────────────────────────────────────────────────────

    /**
     * Returns all comments for {@code requestId}, scoped by the caller's role.
     * Customers are rejected with 403; technicians and staff are scoped as above.
     */
    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(Long requestId, UserPrincipal principal) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Request", "id", requestId));

        assertCommentAccess(request, principal);

        return commentRepository.findByRequestIdOrderByCreatedAtAsc(requestId)
                .stream()
                // Customers never see internal (staff/tech-only) notes
                .filter(c -> principal.getRole() != UserRole.CUSTOMER
                        || !Boolean.TRUE.equals(c.getIsInternal()))
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public CommentResponse addComment(Long requestId, UserPrincipal principal,
                                      CreateCommentRequest dto) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Request", "id", requestId));

        assertCommentAccess(request, principal);

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", principal.getId()));

        // Customers can only post public messages — ignore any isInternal flag they send
        boolean internal = principal.getRole() != UserRole.CUSTOMER
                && dto.getIsInternal() != null && dto.getIsInternal();

        Comment comment = Comment.builder()
                .request(request)
                .user(user)
                .body(dto.getBody())
                .isInternal(internal)
                .build();

        comment = commentRepository.save(comment);

        // Notify the customer by email when a staff member or technician
        // posts a visible (non-internal) comment on their request
        if (!internal
                && (user.getRole() == UserRole.STAFF || user.getRole() == UserRole.TECHNICIAN)
                && request.getCustomer() != null) {
            User customer = request.getCustomer();
            emailService.sendCommentNotificationEmail(
                    customer.getEmail(),
                    customer.getFullName(),
                    request.getRequestCode(),
                    user.getFullName(),
                    dto.getBody(),
                    frontendUrl + "/requests/" + request.getId());
        }

        notifyThreadParticipants(request, user, internal);

        return CommentResponse.from(comment);
    }

    /**
     * In-app notifications for a new message on a request's thread.
     * Everyone involved with the request — except the author — is notified:
     * <ul>
     *   <li>the customer, for customer-visible (non-internal) messages only</li>
     *   <li>the assigned technician</li>
     *   <li>the staff side: the explicitly assigned staff member if there is one;
     *       otherwise, when a customer or technician writes, the district's staff
     *       and the admins — so the message never sits unseen</li>
     * </ul>
     */
    private void notifyThreadParticipants(Request request, User author, boolean internal) {
        String title = internal
                ? "New Internal Note: " + request.getRequestCode()
                : "New Message: " + request.getRequestCode();
        String message = author.getFullName() + " posted a new "
                + (internal ? "internal note" : "message") + " on request "
                + request.getRequestCode() + " (" + request.getTitle() + ").";

        java.util.Set<Long> notified = new java.util.HashSet<>();
        notified.add(author.getId());

        User customer = request.getCustomer();
        if (!internal && customer != null && notified.add(customer.getId())) {
            notificationService.notifyUser(customer, request,
                    NotificationType.COMMENT, title, message);
        }

        User technician = request.getAssignedTechnician();
        if (technician != null && notified.add(technician.getId())) {
            notificationService.notifyUser(technician, request,
                    NotificationType.COMMENT, title, message);
        }

        User staff = request.getAssignedStaff();
        if (staff != null) {
            if (notified.add(staff.getId())) {
                notificationService.notifyUser(staff, request,
                        NotificationType.COMMENT, title, message);
            }
        } else if (author.getRole() == UserRole.CUSTOMER || author.getRole() == UserRole.TECHNICIAN) {
            // No staff member is pinned to this request — alert the district's
            // staff (and admins) that the customer/technician wrote something.
            notificationService.notifyStaffAndAdmins(request,
                    NotificationType.COMMENT, title, message);
        }
    }

    @Transactional
    public CommentResponse editComment(Long requestId, Long commentId, String newBody,
                                       UserPrincipal principal) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment", "id", commentId));

        if (!comment.getRequest().getId().equals(requestId)) {
            throw new BadRequestException("Comment does not belong to this request");
        }
        // Only the author may edit
        if (!comment.getUser().getId().equals(principal.getId())) {
            throw new BadRequestException("You can only edit your own comments");
        }
        if (newBody == null || newBody.isBlank()) {
            throw new BadRequestException("Comment body cannot be empty");
        }

        comment.setBody(newBody.trim());
        return CommentResponse.from(commentRepository.save(comment));
    }

    @Transactional
    public void deleteComment(Long requestId, Long commentId, UserPrincipal principal) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment", "id", commentId));

        if (!comment.getRequest().getId().equals(requestId)) {
            throw new BadRequestException("Comment does not belong to this request");
        }
        // Author can delete; staff/admin can also delete
        boolean isAuthor = comment.getUser().getId().equals(principal.getId());
        boolean isStaff  = principal.getRole() == UserRole.STAFF
                        || principal.getRole() == UserRole.ADMIN;
        if (!isAuthor && !isStaff) {
            throw new BadRequestException("You do not have permission to delete this comment");
        }

        commentRepository.delete(comment);
    }
}
