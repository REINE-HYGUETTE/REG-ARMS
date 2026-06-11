-- Track when a SLA-breach notification was sent so the scheduler doesn't spam duplicates.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS sla_breach_notified_at TIMESTAMP;
