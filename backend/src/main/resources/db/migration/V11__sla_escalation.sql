-- Track when a request was auto-escalated to Critical by the SLA breach scheduler.
-- NULL means it has not been auto-escalated.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_escalated_at TIMESTAMP;
