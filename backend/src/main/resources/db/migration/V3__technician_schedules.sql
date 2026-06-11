-- ============================================================
-- Technician work schedules
-- ============================================================

CREATE TABLE technician_schedules (
    id              BIGSERIAL       PRIMARY KEY,
    technician_id   BIGINT          NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    day_of_week     VARCHAR(10)     NOT NULL,
    start_time      TIME            NOT NULL DEFAULT '08:00',
    end_time        TIME            NOT NULL DEFAULT '17:00',
    is_working      BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (technician_id, day_of_week)
);

CREATE INDEX idx_schedules_technician ON technician_schedules (technician_id);

-- Seed default Mon–Fri schedule for every existing technician
INSERT INTO technician_schedules (technician_id, day_of_week, start_time, end_time, is_working)
SELECT t.id, d.day, '08:00'::TIME, '17:00'::TIME, TRUE
FROM technicians t
CROSS JOIN (
    VALUES ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'), ('FRIDAY'),
           ('SATURDAY'), ('SUNDAY')
) AS d(day)
ON CONFLICT (technician_id, day_of_week) DO NOTHING;

-- Saturday and Sunday default to non-working
UPDATE technician_schedules
SET is_working = FALSE
WHERE day_of_week IN ('SATURDAY', 'SUNDAY');
