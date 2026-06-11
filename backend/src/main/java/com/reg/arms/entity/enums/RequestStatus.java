package com.reg.arms.entity.enums;

public enum RequestStatus {
    Pending,
    /** Technician has been routed and notified — waiting for them to click "Pursue". */
    Assigned,
    /** Technician clicked "Pursue" — actively working on the request. */
    In_Progress,
    Resolved,
    Closed,
    Cancelled;

    public String toDbValue() {
        return this.name().replace("_", " ");
    }

    public static RequestStatus fromDbValue(String value) {
        return RequestStatus.valueOf(value.replace(" ", "_"));
    }
}
