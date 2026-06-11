-- V15: soft-delete / archive support for old requests
-- Adds an archived_at timestamp; null = active, non-null = archived.
-- All existing queries filter WHERE archived_at IS NULL via JPA Specifications,
-- so archived requests are invisible to regular list/stats views.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_requests_archived_at ON requests (archived_at) WHERE archived_at IS NULL;

COMMENT ON COLUMN requests.archived_at IS
  'When set, the request is soft-archived and excluded from active views. '
  'Set by the admin archive endpoint; never deletes the row.';
