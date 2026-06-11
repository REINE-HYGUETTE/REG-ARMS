-- ============================================================
-- REG ARMS — PostgreSQL Schema
-- Migrated from MySQL 8.0+
-- ============================================================

-- Custom ENUM types
CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER');
CREATE TYPE priority_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE request_status AS ENUM ('Pending', 'In Progress', 'Resolved', 'Closed');
CREATE TYPE notification_type AS ENUM ('NEW_REQUEST', 'STATUS_UPDATE', 'ASSIGNMENT', 'RESOLVED', 'URGENT_ALERT', 'COMMENT', 'SYSTEM');

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    first_name      VARCHAR(100)    NOT NULL,
    last_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    phone           VARCHAR(20)     NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    role            user_role       NOT NULL DEFAULT 'CUSTOMER',
    province        VARCHAR(100),
    district        VARCHAR(100),
    sector          VARCHAR(100),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN         NOT NULL DEFAULT FALSE,
    reset_token     VARCHAR(255),
    reset_expires   TIMESTAMP,
    last_login      TIMESTAMP,
    profile_photo   VARCHAR(500),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_province ON users (province);

-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE categories (
    id                  BIGSERIAL       PRIMARY KEY,
    name                VARCHAR(100)    NOT NULL UNIQUE,
    description         TEXT,
    default_priority    priority_level  NOT NULL DEFAULT 'Medium',
    icon                VARCHAR(50),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: requests
-- ============================================================
CREATE TABLE requests (
    id                  BIGSERIAL       PRIMARY KEY,
    request_code        VARCHAR(30)     NOT NULL UNIQUE,
    customer_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id         BIGINT          NOT NULL REFERENCES categories(id),
    title               VARCHAR(300)    NOT NULL,
    description         TEXT            NOT NULL,
    province            VARCHAR(100)    NOT NULL,
    district            VARCHAR(100)    NOT NULL,
    sector              VARCHAR(100),
    phone               VARCHAR(20)     NOT NULL,
    ai_priority         priority_level,
    ai_confidence       DECIMAL(5,4),
    ai_model_used       VARCHAR(100),
    ai_keywords_detected JSONB,
    manual_priority     priority_level,
    assigned_staff_id   BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    assigned_tech_id    BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    status              request_status  NOT NULL DEFAULT 'Pending',
    resolved_at         TIMESTAMP,
    closed_at           TIMESTAMP,
    resolution_notes    TEXT,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requests_customer ON requests (customer_id);
CREATE INDEX idx_requests_status ON requests (status);
CREATE INDEX idx_requests_created ON requests (created_at);
CREATE INDEX idx_requests_province ON requests (province);
CREATE INDEX idx_requests_code ON requests (request_code);

-- ============================================================
-- TABLE: request_attachments
-- ============================================================
CREATE TABLE request_attachments (
    id              BIGSERIAL       PRIMARY KEY,
    request_id      BIGINT          NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    uploaded_by     BIGINT          NOT NULL REFERENCES users(id),
    file_name       VARCHAR(255)    NOT NULL,
    file_path       VARCHAR(500)    NOT NULL,
    file_size       INTEGER,
    file_type       VARCHAR(100),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_request ON request_attachments (request_id);

-- ============================================================
-- TABLE: technicians
-- ============================================================
CREATE TABLE technicians (
    id                  BIGSERIAL       PRIMARY KEY,
    user_id             BIGINT          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_id         VARCHAR(50)     UNIQUE,
    specialization      VARCHAR(200),
    province_coverage   JSONB,
    is_available        BOOLEAN         NOT NULL DEFAULT TRUE,
    current_workload    INTEGER         NOT NULL DEFAULT 0,
    max_workload        INTEGER         NOT NULL DEFAULT 5,
    rating              DECIMAL(3,2)    DEFAULT 0.00,
    total_resolved      INTEGER         NOT NULL DEFAULT 0,
    certifications      JSONB,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_technicians_available ON technicians (is_available);

-- ============================================================
-- TABLE: comments
-- ============================================================
CREATE TABLE comments (
    id              BIGSERIAL       PRIMARY KEY,
    request_id      BIGINT          NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       BIGINT          REFERENCES comments(id) ON DELETE SET NULL,
    body            TEXT            NOT NULL,
    is_internal     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_request ON comments (request_id);
CREATE INDEX idx_comments_user ON comments (user_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
    id              BIGSERIAL           PRIMARY KEY,
    user_id         BIGINT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id      BIGINT              REFERENCES requests(id) ON DELETE SET NULL,
    type            notification_type   NOT NULL,
    title           VARCHAR(255)        NOT NULL,
    message         TEXT                NOT NULL,
    is_read         BOOLEAN             NOT NULL DEFAULT FALSE,
    email_sent      BOOLEAN             NOT NULL DEFAULT FALSE,
    email_sent_at   TIMESTAMP,
    created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications (user_id);
CREATE INDEX idx_notifications_unread ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications (created_at);

-- ============================================================
-- TABLE: activity_logs
-- ============================================================
CREATE TABLE activity_logs (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    request_id      BIGINT          REFERENCES requests(id) ON DELETE SET NULL,
    action          VARCHAR(100)    NOT NULL,
    description     TEXT,
    old_value       TEXT,
    new_value       TEXT,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_user ON activity_logs (user_id);
CREATE INDEX idx_activity_request ON activity_logs (request_id);
CREATE INDEX idx_activity_action ON activity_logs (action);
CREATE INDEX idx_activity_created ON activity_logs (created_at);

-- ============================================================
-- TABLE: ai_predictions
-- ============================================================
CREATE TABLE ai_predictions (
    id                  BIGSERIAL       PRIMARY KEY,
    request_id          BIGINT          NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    model_version       VARCHAR(50)     NOT NULL,
    input_text          TEXT,
    predicted_priority  priority_level  NOT NULL,
    confidence_score    DECIMAL(5,4)    NOT NULL,
    logistic_score      DECIMAL(5,4),
    random_forest_score DECIMAL(5,4),
    naive_bayes_score   DECIMAL(5,4),
    tfidf_features      JSONB,
    keywords_detected   JSONB,
    actual_priority     priority_level,
    is_correct          BOOLEAN,
    processing_ms       INTEGER,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_predictions_request ON ai_predictions (request_id);
CREATE INDEX idx_predictions_predicted ON ai_predictions (predicted_priority);
CREATE INDEX idx_predictions_created ON ai_predictions (created_at);

-- ============================================================
-- TABLE: reports
-- ============================================================
CREATE TABLE reports (
    id              BIGSERIAL       PRIMARY KEY,
    generated_by    BIGINT          NOT NULL REFERENCES users(id),
    report_type     VARCHAR(100)    NOT NULL,
    period_start    DATE,
    period_end      DATE,
    filters         JSONB,
    file_path       VARCHAR(500),
    file_size       INTEGER,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_type ON reports (report_type);
CREATE INDEX idx_reports_created ON reports (created_at);
