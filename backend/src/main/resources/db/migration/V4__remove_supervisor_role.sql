-- Convert any existing SUPERVISOR users to STAFF before removing the enum value
UPDATE users SET role = 'STAFF'::user_role WHERE role = 'SUPERVISOR'::user_role;

-- PostgreSQL does not support DROP VALUE on an enum.
-- Recreate the type without SUPERVISOR using a three-step rename/replace approach.
-- Must drop the column default first because PostgreSQL cannot auto-cast it.
CREATE TYPE user_role_new AS ENUM ('ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER');

ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
    ALTER COLUMN role TYPE user_role_new
    USING role::text::user_role_new;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'CUSTOMER'::user_role_new;

DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;
