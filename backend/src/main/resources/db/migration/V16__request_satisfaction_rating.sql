-- V16: store customer satisfaction rating on the request itself
-- so it can be displayed back on the request detail page.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS satisfaction_rating  SMALLINT CHECK (satisfaction_rating BETWEEN 1 AND 5);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS customer_feedback    TEXT;
