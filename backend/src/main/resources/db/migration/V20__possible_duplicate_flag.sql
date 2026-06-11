-- V20: Add possible_duplicate flag to requests
-- Set when a customer submits a new request while they already have an open
-- request in the same category.  Staff and Admin see a visible badge;
-- the customer is blocked from submitting at the form level.

ALTER TABLE requests
    ADD COLUMN IF NOT EXISTS possible_duplicate BOOLEAN NOT NULL DEFAULT FALSE;

-- Composite index: efficient lookup of open requests per customer+category
CREATE INDEX IF NOT EXISTS idx_requests_customer_category
    ON requests (customer_id, category_id, status);
