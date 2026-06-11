package com.reg.arms.util;

import com.reg.arms.entity.enums.PriorityLevel;

import java.time.Duration;
import java.time.LocalDateTime;

public final class SlaUtils {

    private SlaUtils() {}

    // ── SLA target hours by priority ──────────────────────────────────────────

    public static long slaHours(PriorityLevel priority) {
        if (priority == null) return 24;
        return switch (priority) {
            case Critical -> 2;
            case High     -> 8;
            case Medium   -> 24;
            case Low      -> 72;
        };
    }

    public static LocalDateTime deadline(LocalDateTime createdAt, PriorityLevel priority) {
        return createdAt.plusHours(slaHours(priority));
    }

    // ── SLA status ─────────────────────────────────────────────────────────────

    public enum SlaStatus { OK, AT_RISK, BREACHED }

    /**
     * Determines SLA status.
     *
     * @param createdAt  request creation timestamp
     * @param priority   final (manual or AI) priority
     * @param resolvedAt null when request is still open
     * @return OK | AT_RISK | BREACHED
     */
    public static SlaStatus status(LocalDateTime createdAt, PriorityLevel priority,
                                   LocalDateTime resolvedAt) {
        if (createdAt == null) return SlaStatus.OK;

        LocalDateTime dl        = deadline(createdAt, priority);
        LocalDateTime reference = resolvedAt != null ? resolvedAt : LocalDateTime.now();

        if (!reference.isBefore(dl)) {
            return SlaStatus.BREACHED;
        }

        // AT_RISK when ≥ 70 % of the SLA window has elapsed
        long totalSecs   = Duration.between(createdAt, dl).getSeconds();
        long elapsedSecs = Duration.between(createdAt, reference).getSeconds();
        if (totalSecs > 0 && (double) elapsedSecs / totalSecs >= 0.70) {
            return SlaStatus.AT_RISK;
        }
        return SlaStatus.OK;
    }
}
