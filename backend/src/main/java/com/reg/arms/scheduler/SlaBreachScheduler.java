package com.reg.arms.scheduler;

import com.reg.arms.entity.Request;
import com.reg.arms.entity.enums.NotificationType;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.repository.RequestRepository;
import com.reg.arms.service.ActivityLogService;
import com.reg.arms.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * SLA breach detection and escalation scheduler.
 *
 * <p>Two scheduled scans run in parallel:
 * <ol>
 *   <li><b>Critical fast-path</b> (every 2 minutes) — polls only requests that are
 *       already {@code Critical} priority and have exceeded their 2-hour SLA window.
 *       This ensures high-urgency breaches are surfaced within 2 minutes of occurrence.</li>
 *   <li><b>Full scan</b> (every 10 minutes) — covers all priorities (High, Medium, Low)
 *       and also auto-escalates non-Critical breached requests to Critical.</li>
 * </ol>
 *
 * <p>The {@code sla_breach_notified_at} column is stamped after first handling
 * to prevent duplicate alerts on subsequent scheduler runs.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SlaBreachScheduler {

    private final RequestRepository    requestRepository;
    private final NotificationService  notificationService;
    private final ActivityLogService   activityLogService;

    /**
     * Fast path: poll Critical-only breaches every 2 minutes.
     * Critical SLA = 2 hours, so a 2-minute detection window is appropriate.
     */
    @Scheduled(fixedDelay = 2 * 60 * 1_000)   // every 2 minutes
    @Transactional
    public void checkCriticalSlaBreaches() {
        List<Request> breached = requestRepository.findCriticalBreachedAndUnnotified();
        if (!breached.isEmpty()) {
            log.info("Critical SLA fast-path: {} breach(es) found", breached.size());
            processSlaBreaches(breached);
        }
    }

    /**
     * Full scan: all priorities, every 10 minutes.
     * Also auto-escalates non-Critical breached requests to Critical.
     */
    @Scheduled(fixedDelay = 10 * 60 * 1_000)   // every 10 minutes
    @Transactional
    public void checkSlaBreaches() {
        List<Request> breached = requestRepository.findBreachedAndUnnotified();

        if (breached.isEmpty()) return;

        log.info("SLA breach check: {} newly-breached request(s) found", breached.size());
        processSlaBreaches(breached);
    }

    // ── Shared processing logic ───────────────────────────────────────────────

    private void processSlaBreaches(List<Request> breached) {
        for (Request request : breached) {
            try {
                PriorityLevel currentPriority = request.getFinalPriority();
                boolean wasEscalated          = false;

                // ── Auto-escalate to Critical if not already there ────────────
                if (currentPriority != PriorityLevel.Critical) {
                    request.setManualPriority(PriorityLevel.Critical);
                    request.setSlaEscalatedAt(LocalDateTime.now());
                    wasEscalated = true;

                    // Log the system-driven priority change in the audit trail
                    activityLogService.logRequest(
                            null,   // null actor → displayed as "System"
                            request,
                            "PRIORITY_OVERRIDDEN",
                            "Auto-escalated to Critical due to SLA breach",
                            currentPriority.name(),
                            PriorityLevel.Critical.name()
                    );

                    log.info("Request {} auto-escalated: {} → Critical (SLA breached)",
                            request.getRequestCode(), currentPriority);
                }

                // ── Build notification message ────────────────────────────────
                String escalationNote = wasEscalated
                        ? " Priority has been automatically escalated from "
                          + currentPriority.name() + " → Critical."
                        : " (already Critical)";

                notificationService.notifyStaffAndAdmins(
                        request,
                        NotificationType.URGENT_ALERT,
                        "⚠ SLA Breached: " + request.getRequestCode(),
                        "Request " + request.getRequestCode() +
                        " has exceeded its SLA deadline." +
                        escalationNote +
                        " Customer: " + request.getCustomer().getFullName() +
                        " · " + request.getDistrict() + ", " + request.getProvince() + "."
                );

                // ── Stamp to prevent duplicate processing ─────────────────────
                request.setSlaBreachNotifiedAt(LocalDateTime.now());
                requestRepository.save(request);

                log.info("SLA breach handled for request {} (escalated={})",
                        request.getRequestCode(), wasEscalated);

            } catch (Exception e) {
                log.error("Failed to handle SLA breach for request {}: {}",
                        request.getRequestCode(), e.getMessage());
            }
        }
    }
}
