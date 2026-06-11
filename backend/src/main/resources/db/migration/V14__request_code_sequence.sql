-- Replace the COUNT-based request code generation with a proper DB sequence
-- to eliminate the race condition when multiple requests are created concurrently.

CREATE SEQUENCE IF NOT EXISTS request_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Seed the sequence from the current highest request number so existing codes
-- are not duplicated after the migration.
DO $$
DECLARE
    max_seq BIGINT := 0;
BEGIN
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(request_code FROM 'REG-\d+-(\d+)$') AS BIGINT
        )
    ), 0)
    INTO max_seq
    FROM requests
    WHERE request_code ~ '^REG-\d+-\d+$';

    IF max_seq > 0 THEN
        PERFORM setval('request_code_seq', max_seq);
    END IF;
END $$;
