package com.reg.arms.service;

import com.reg.arms.entity.ActivityLog;
import com.reg.arms.entity.Request;
import com.reg.arms.entity.User;
import com.reg.arms.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class ActivityLogService {

    private final ActivityLogRepository      activityLogRepository;
    private final PlatformTransactionManager transactionManager;

    /** General user-level log (no request context). */
    @Async
    public void log(User user, String action, String description, String ipAddress) {
        persist(user, null, action, description, null, null, ipAddress);
    }

    /**
     * Request-scoped log — preferred for all request lifecycle events.
     *
     * <p>Uses {@link TransactionTemplate} with REQUIRES_NEW so the activity log
     * runs in its own isolated transaction.  This avoids the race condition where
     * the parent transaction hasn't committed yet when the {@code @Async} thread
     * starts, and also ensures that a failure here (e.g. FK violation) never
     * poisons the parent's session.</p>
     */
    @Async
    public void logRequest(User user, Request request, String action,
                           String description, String oldValue, String newValue) {
        persist(user, request, action, description, oldValue, newValue, null);
    }

    // ── private ───────────────────────────────────────────────────────────────

    private void persist(User user, Request request, String action,
                         String description, String oldValue, String newValue,
                         String ipAddress) {
        TransactionTemplate tmpl = new TransactionTemplate(transactionManager);
        tmpl.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        try {
            tmpl.execute(status -> {
                ActivityLog entry = ActivityLog.builder()
                        .user(user)
                        .request(request)
                        .action(action)
                        .description(description)
                        .oldValue(oldValue)
                        .newValue(newValue)
                        .ipAddress(ipAddress)
                        .build();
                activityLogRepository.save(entry);
                return null;
            });
        } catch (Exception e) {
            // Log as WARN — activity log failures must never crash the calling flow
            log.warn("Activity log skipped [action={}]: {}", action, e.getMessage());
        }
    }
}
