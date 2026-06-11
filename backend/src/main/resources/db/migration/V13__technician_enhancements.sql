-- ─────────────────────────────────────────────────────────────────────────────
-- V13 — Smart Technician enhancements
--
--  1. district_coverage          — sub-province location list for precise matching
--  2. category_resolved_counts   — per-category resolution history map
--  3. specialization_tags        — structured category name tags (replaces free-text guessing)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS district_coverage         jsonb NOT NULL DEFAULT '[]';

ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS category_resolved_counts  jsonb NOT NULL DEFAULT '{}';

ALTER TABLE technicians
    ADD COLUMN IF NOT EXISTS specialization_tags       jsonb NOT NULL DEFAULT '[]';
