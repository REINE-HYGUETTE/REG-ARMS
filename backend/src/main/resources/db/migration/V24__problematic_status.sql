-- V22: Add 'Problematic' request status
--
-- Flow: Assigned or In_Progress → Problematic (tech reports an issue, stays assigned)
--       Problematic → Assigned  (staff resolves the issue, tech can pursue again)
--       Problematic → Pending   (staff decides to re-route, tech unassigned)

ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'Problematic';
