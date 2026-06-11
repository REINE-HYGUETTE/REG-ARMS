package com.reg.arms.dto.request;

import lombok.Getter;
import lombok.Setter;

/**
 * Optional body for the "Cannot Pursue" action.
 * A technician sends this when they cannot take the assigned request —
 * the system sends it back to Pending and notifies Staff for manual re-routing.
 */
@Getter
@Setter
public class CannotPursueRequest {

    /** Human-readable reason (optional, shown to Staff). */
    private String reason;
}
