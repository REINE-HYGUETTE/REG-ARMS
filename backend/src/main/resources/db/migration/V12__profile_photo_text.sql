-- Profile photo was VARCHAR(500) — far too small for a base64-encoded image.
-- Change to TEXT (unlimited in PostgreSQL) so photos persist correctly.
ALTER TABLE users ALTER COLUMN profile_photo TYPE TEXT;
