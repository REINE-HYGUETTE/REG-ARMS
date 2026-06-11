-- ============================================================
-- V8: Remove any rogue triggers / column defaults that were
--     overwriting first_name / last_name on the users table.
--
-- Root cause: a BEFORE INSERT (or AFTER INSERT) trigger was
-- added directly to the database during development, causing
-- every newly-registered user to receive the same hardcoded
-- name regardless of what was submitted in the registration form.
-- ============================================================

-- 1. Drop every trigger on the users table so none can silently
--    override first_name / last_name on INSERT or UPDATE.
DO $$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN
        SELECT trigger_name
        FROM   information_schema.triggers
        WHERE  event_object_table = 'users'
          AND  trigger_schema     = current_schema()
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON users CASCADE', trig.trigger_name);
        RAISE NOTICE 'Dropped trigger: %', trig.trigger_name;
    END LOOP;
END $$;

-- 2. Remove any column-level DEFAULT that may have been set on
--    first_name / last_name outside of the original schema.
ALTER TABLE users ALTER COLUMN first_name DROP DEFAULT;
ALTER TABLE users ALTER COLUMN last_name  DROP DEFAULT;

-- 3. Repair any existing rows where both name columns hold the
--    exact hardcoded value (safe no-op if no such rows exist).
--    Sets them to a placeholder so admins can identify and
--    correct them through the Users management UI.
UPDATE users
SET    first_name = 'Unknown',
       last_name  = 'User'
WHERE  first_name = 'Tumukunde'
  AND  last_name  = 'Hyguette'
  AND  role       = 'CUSTOMER'
  AND  last_login IS NULL;   -- only never-logged-in accounts (pending or newly registered)
