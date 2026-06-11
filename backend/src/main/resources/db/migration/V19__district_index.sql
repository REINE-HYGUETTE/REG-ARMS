-- V19: Performance indexes for district-based routing and filtering
-- Supports:  staff district scoping, technician filtering, request routing

CREATE INDEX IF NOT EXISTS idx_users_district  ON users (district);
CREATE INDEX IF NOT EXISTS idx_users_province  ON users (province);
CREATE INDEX IF NOT EXISTS idx_users_role_district ON users (role, district);

-- Speeds up "give me all requests from district X"
CREATE INDEX IF NOT EXISTS idx_requests_district ON requests (district);
