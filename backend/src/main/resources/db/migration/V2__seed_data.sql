-- ============================================================
-- SEED DATA
-- Passwords are BCrypt hashes of the demo passwords
-- ============================================================

-- Categories
INSERT INTO categories (name, description, default_priority, icon) VALUES
('Power Outage',       'Complete or partial loss of electricity supply',        'High'::priority_level,     '⚡'),
('Voltage Issues',     'Fluctuating, high, or low voltage problems',            'Medium'::priority_level,   '📊'),
('Equipment Failure',  'Transformer, meter, or infrastructure failure',         'High'::priority_level,     '🔧'),
('New Connection',     'Request for new electrical service connection',          'Low'::priority_level,      '🔌'),
('Meter Issues',       'Billing meter tampering, damage, or malfunction',       'Medium'::priority_level,   '📟'),
('Billing Dispute',    'Incorrect charges, overcharging, or billing errors',    'Low'::priority_level,      '💰'),
('Street Lighting',    'Street lamp outages or lighting infrastructure issues', 'Low'::priority_level,      '💡'),
('Safety Hazard',      'Fallen lines, exposed wires, fire risk, explosions',   'Critical'::priority_level, '🚨'),
('Industrial Supply',  'Three-phase, high-capacity, or industrial connections', 'High'::priority_level,     '🏭'),
('Other',              'Miscellaneous service requests',                        'Low'::priority_level,      '📝');

-- Users (passwords: admin123, super123, staff123, tech123, cust123)
INSERT INTO users (first_name, last_name, email, phone, password_hash, role, province, district) VALUES
('Alice',    'Mugisha',   'admin@reg.rw',          '+250788000001', '$2a$10$o4uQ47RYskStjrk9koXvUuuXIthGXVLYpPGWpb9CO940e6zrLYMgC', 'ADMIN'::user_role,      'Kigali City',     'Gasabo'),
('Bernard',  'Nkusi',     'staff2@reg.rw',           '+250788000002', '$2a$10$o4uQ47RYskStjrk9koXvUuuXIthGXVLYpPGWpb9CO940e6zrLYMgC', 'STAFF'::user_role,      'Kigali City',     'Kicukiro'),
('Claire',   'Uwase',     'staff@reg.rw',           '+250788000003', '$2a$10$o4uQ47RYskStjrk9koXvUuuXIthGXVLYpPGWpb9CO940e6zrLYMgC', 'STAFF'::user_role,      'Kigali City',     'Nyarugenge'),
('Daniel',   'Habimana',  'tech@reg.rw',            '+250788000004', '$2a$10$o4uQ47RYskStjrk9koXvUuuXIthGXVLYpPGWpb9CO940e6zrLYMgC', 'TECHNICIAN'::user_role, 'Northern Province','Musanze'),
('Emmanuel', 'Gasana',    'customer@example.com',   '+250788000005', '$2a$10$o4uQ47RYskStjrk9koXvUuuXIthGXVLYpPGWpb9CO940e6zrLYMgC', 'CUSTOMER'::user_role,   'Southern Province','Huye');

-- Technician profile
INSERT INTO technicians (user_id, employee_id, specialization, province_coverage, is_available, max_workload) VALUES
(4, 'TECH-001', 'High-voltage lines, Transformers', '["Northern Province","Kigali City"]'::jsonb, TRUE, 6);

-- Sample requests
INSERT INTO requests (request_code, customer_id, category_id, title, description, province, district, phone, ai_priority, ai_confidence, status, assigned_tech_id) VALUES
('REG-2024-0001', 5, 1, 'Complete power outage — hospital area',
 'Total blackout affecting Kacyiru hospital and surrounding area. Emergency situation with patients on life support.',
 'Kigali City', 'Gasabo', '+250788001001', 'Critical'::priority_level, 0.9600, 'In Progress'::request_status, 4),
('REG-2024-0002', 5, 3, 'Transformer explosion at market',
 'Main transformer exploded causing fire risk. Market area with 200+ vendors affected.',
 'Northern Province', 'Musanze', '+250788002002', 'Critical'::priority_level, 0.9400, 'Pending'::request_status, NULL),
('REG-2024-0003', 5, 2, 'Fluctuating voltage damaging appliances',
 'Voltage fluctuations causing damage to electrical appliances over past 3 days.',
 'Southern Province', 'Huye', '+250788003003', 'High'::priority_level, 0.8900, 'In Progress'::request_status, 4);
