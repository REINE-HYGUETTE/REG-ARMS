-- V21: Pursue-based technician routing flow
--
-- Adds:
--   1. 'Assigned' status to request_status enum
--      Flow: Pending → Assigned (routed) → In_Progress (pursuing) → Resolved/Closed
--
--   2. pursuing_request_id on technicians table
--      Set when a technician clicks "Pursue"; cleared on Resolved/Closed/Cancelled.
--      Drives the pursue-aware routing: free techs rank above pursuing ones.

-- 1. New enum value
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'Assigned';

-- 2. Pursuing tracker
ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS pursuing_request_id BIGINT
        REFERENCES requests (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_technicians_pursuing
    ON technicians (pursuing_request_id);
