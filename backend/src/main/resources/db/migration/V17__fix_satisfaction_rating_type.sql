-- V17: change satisfaction_rating from SMALLINT (int2) to INTEGER (int4)
--      so Hibernate 6's Java Integer → Types#INTEGER mapping passes schema validation.
ALTER TABLE requests
    ALTER COLUMN satisfaction_rating TYPE INTEGER
    USING satisfaction_rating::INTEGER;
