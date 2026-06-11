# REG ARMS — System Documentation
**Automated Request Management System for Rwanda Energy Group**
*Version 1.0 — May 2026*

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [User Roles & Access](#3-user-roles--access)
4. [Core Workflows](#4-core-workflows)
5. [AI Features](#5-ai-features)
6. [Smart Technician Matching](#6-smart-technician-matching)
7. [SLA Management](#7-sla-management)
8. [Notification System](#8-notification-system)
9. [API Reference](#9-api-reference)
10. [Frontend Pages](#10-frontend-pages)
11. [Email Notifications](#12-email-notifications)
12. [Deployment Notes](#12-deployment-notes)
13. [Known Limitations](#13-known-limitations)

---

## 1. System Overview

REG ARMS is a full-stack customer service request management platform built for Rwanda Energy Group (REG). It handles the full lifecycle of customer service requests — from submission to resolution — with AI-powered priority prediction, smart technician assignment, real-time notifications, and SLA enforcement.

**Key capabilities:**
- Customers submit service requests (power outages, billing disputes, equipment failures, etc.)
- AI engine predicts request priority using an ensemble ML model
- Smart algorithm matches and assigns the best available technician automatically for critical requests
- Staff manage request flow through a Kanban board and request list
- SLA deadlines are tracked per priority level with automatic escalation on breach
- Reports, analytics, and CSV/PDF exports for management

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│   Vite + React 18 + TypeScript + Tanstack Query + Recharts      │
│   Port 5173 — proxies /api/* to Spring Boot                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────────────┐
│                  Spring Boot 3 (Java 17)                         │
│   REST API · JWT Auth · Spring Security · JPA · Flyway          │
│   Port 8080                                                     │
│                                                                 │
│   ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│   │ PostgreSQL  │  │ Email (SMTP) │  │ Flask AI Service     │    │
│   │ (primary   │  │ Gmail App PW │  │ Port 5000           │    │
│   │  store)    │  │              │  │ scikit-learn         │    │
│   └────────────┘  └──────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Tanstack Query, React Router, Recharts, Lucide icons |
| Backend | Spring Boot 3, Java 17, Spring Security, Spring Data JPA, Hibernate |
| Database | PostgreSQL with Flyway migrations |
| AI Service | Python Flask, scikit-learn (Logistic Regression + Random Forest + Naive Bayes), TF-IDF |
| Auth | JWT (1-hour expiry), BCrypt password hashing |
| Email | JavaMailSender via Gmail SMTP |
| Real-time | Server-Sent Events (SSE) |

---

## 3. User Roles & Access

### Role Summary

| Role | Who | How Created | Portal |
|------|-----|-------------|--------|
| **ADMIN** | System administrators | Admin-created only | Admin Portal |
| **STAFF** | Operations staff (dispatchers, supervisors) | Admin-created only | Staff Portal |
| **TECHNICIAN** | Field technicians | Admin-created only | Technician Portal |
| **CUSTOMER** | REG customers | Self-register (requires admin approval) | Customer Portal |

### Customer Registration Flow

1. Customer fills registration form at `/login`
2. Account created with `isActive = false`
3. Admin receives notification, reviews, and approves via Users page
4. Customer receives approval email and can now log in

### Role Capabilities

**ADMIN**
- Full user management (create, edit, approve, deactivate, delete)
- Category management (create, edit, activate/deactivate)
- Reports, analytics, and data exports (CSV/PDF)
- AI model management and retraining
- Request archiving and restoration
- View all data across the system

**STAFF**
- View and manage all requests (assign, change status, override priority)
- View and manage technicians (set capacity/max workload)
- Kanban board for request flow management
- SLA monitoring and technician recommendation engine
- Comment on requests (internal and public)

**TECHNICIAN**
- View assigned tasks only
- Acknowledge and start tasks (Pending → In Progress)
- Complete tasks and add resolution notes
- Manage own weekly availability schedule
- Toggle own availability on/off
- Edit own professional profile (specialization, coverage areas)

**CUSTOMER**
- Submit service requests with photo attachments
- Track own request statuses
- Cancel pending requests
- Add public comments on own requests
- Rate resolution satisfaction (1–5 stars)
- Receive email notifications on request updates

---

## 4. Core Workflows

### 4.1 Request Submission (Customer)

```
Customer fills form
    → Live AI priority preview shown
    → Duplicate check runs (same category + province)
    → Category auto-suggestion if typing in title
    → Submit
        → AI priority prediction stored
        → SLA deadline calculated
        → Request code generated (REG-YYYYMMDD-XXXX)
        → Acknowledgement email sent to customer
        → If Critical: auto-assign best technician (score ≥ 60)
        → Staff/admin notified via SSE + notification record
```

### 4.2 Request Lifecycle

```
Pending
  → Staff assigns technician (or auto-assigned for Critical)
  → Technician clicks "Acknowledge & Start"
In_Progress
  → Technician works, adds comments/notes
  → Staff can override priority, add internal notes
Resolved
  → Technician marks resolved + adds resolution notes
  → Customer receives email with link to view
  → Customer rates satisfaction (1–5 stars)
  → Technician workload decremented
  → Rating averaged into technician's score
Closed
  → Request closed (terminal state)
Cancelled
  → Customer or staff cancelled (terminal state)
```

### 4.3 Priority Hierarchy

When displaying priority, the system uses this order of precedence:

```
manualPriority (staff override)
    ↓ if null
aiPriority (ML prediction)
    ↓ if null
category.defaultPriority (admin-set policy)
    ↓ if null
Medium (system default)
```

### 4.4 SLA Windows

| Priority | SLA Window |
|----------|-----------|
| Critical | 2 hours |
| High | 8 hours |
| Medium | 24 hours |
| Low | 72 hours |

SLA breached requests are automatically escalated to Critical by the scheduler.

---

## 5. AI Features

### 5.1 Priority Prediction

The AI service (Flask, port 5000) uses an ensemble of three ML models:

| Model | Weight |
|-------|--------|
| Logistic Regression | Soft-vote combined |
| Random Forest | Soft-vote combined |
| Naive Bayes | Soft-vote combined |

**Input:** Request title + description + category name  
**Output:** Priority level (Low / Medium / High / Critical) + confidence score (0–1) + detected keywords

**Overrides applied after ML prediction:**
1. **Keyword elevation** — If life-safety keywords are detected (e.g. "fire", "electrocuted", "explosion"), priority is elevated to Critical regardless of ML output
2. **Category floor** — Each category has an admin-set `defaultPriority`. The AI prediction cannot go below this floor. Example: "Safety Hazard" category has floor = Critical
3. **Flask fallback** — If Flask is unavailable, falls back to `category.defaultPriority`

### 5.2 Category Auto-Suggestion

Pure Java keyword matcher with synonym expansion in English, French, and Kinyarwanda. Runs without calling Flask. Fires as the customer types the request title and suggests the most relevant category.

### 5.3 Duplicate Detection

Before submission: `GET /api/requests/check-duplicates?categoryId=&province=` checks for open requests in the same category and province. Customer is warned but can still proceed.

After submission: `GET /api/requests/{id}/similar` shows staff any similar open requests.

### 5.4 AI Accuracy Tracking

Every prediction is stored in `ai_predictions`. When staff override a priority, `isCorrect = false` is recorded. After 48 hours without override, `AiAccuracyScheduler` marks the prediction as implicitly correct (`isCorrect = true`). This feeds the accuracy reports visible in the Admin AI Predictions page.

### 5.5 Model Retraining

Admin can trigger retraining via the AI Predictions page. The Spring backend collects all requests with known outcomes and sends them to Flask's `POST /api/model/retrain`. The model retrains in-process and future predictions use the new weights.

---

## 6. Smart Technician Matching

When staff views a request, the system scores all available technicians on a 100-point scale.

### Scoring Dimensions

| Dimension | Base Weight | Critical Weight | Low Weight |
|-----------|-------------|-----------------|------------|
| Specialization match | 35 pts | 25 pts | 40 pts |
| Location match | 25 pts | 30 pts | 25 pts |
| Workload / availability | 25 pts | 35 pts | 15 pts |
| Category history | 15 pts | 10 pts | 20 pts |

**Weight shift logic:** Critical requests favor free technicians (higher workload weight). Low-priority requests favor specialization expertise.

### Specialization Scoring (up to 35 pts)
- Exact category tag match: full points
- Falls back to keyword matching against free-text `specialization` field

### Location Scoring (up to 25 pts)
- Province match: 15 pts
- District match: additional 10 pts (bonus on top)
- No province coverage declared: 0 pts

### Workload Scoring (up to 25 pts)
- Formula: `(1 - currentWorkload/maxWorkload) × weight`
- At 0% capacity used: full points
- At 100% capacity: 0 points
- Off-shift technicians (not working at current time): −40% penalty

### Category History Scoring (up to 15 pts)
- Based on how many times the technician has previously resolved requests in this category
- Uses `categoryResolvedCounts` map stored on the `Technician` entity

### Auto-Assignment
For **Critical** requests only: if the top-scored technician scores ≥ 60/100, they are automatically assigned without staff intervention. Staff can always reassign.

---

## 7. SLA Management

### Monitoring

Two background schedulers run continuously:

| Scheduler | Frequency | Action |
|-----------|-----------|--------|
| Critical SLA check | Every 2 minutes | Detect Critical requests past 2h SLA; push URGENT_ALERT to all staff/admins |
| Full SLA check | Every 10 minutes | Scan all priorities; auto-escalate breached requests to Critical; mark `slaBreachNotifiedAt` |

### Frontend Indicators

- **SLA chips** on request cards: shown when `slaStatus = AT_RISK` or `BREACHED`
  - AT_RISK: amber chip showing time remaining
  - BREACHED: red chip showing how long overdue
- **SLA bar** on request detail page showing progress to deadline

### SLA Status Values

| Value | Meaning |
|-------|---------|
| `OK` | Within SLA window — no indicator shown |
| `AT_RISK` | Less than 25% of window remaining |
| `BREACHED` | Deadline has passed |

---

## 8. Notification System

### Real-time (SSE)
Each logged-in user has a persistent Server-Sent Events connection. The `SseEmitterRegistry` manages per-user emitter lifecycle with heartbeat keepalives. Events are pushed instantly on:
- New request created (staff/admin)
- Request assigned to technician
- Status changed
- SLA breach detected

### In-App Notifications
All events are also stored in the `notifications` table and shown in the Notifications page. Unread count is shown in the topbar badge.

### Email Notifications

| Trigger | Recipient | Content |
|---------|-----------|---------|
| Request submitted | Customer | Request code, category, predicted priority, SLA window, tracking link |
| Comment added by staff/tech | Customer | Comment text, commenter name, link to request |
| Account approved | Customer | Welcome message, login link |
| Password reset | User | Reset link (expires in 1 hour) |
| New user invited (admin-created) | New user | Credentials and login link |

---

## 9. API Reference

### Base URL
`http://localhost:8080/api`

### Authentication
All endpoints (except `/auth/**` and `/locations/**`) require a JWT Bearer token:
```
Authorization: Bearer <token>
```

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login → returns `{ token, user }` |
| POST | `/auth/register` | Customer self-registration |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Submit new password with reset token |

### Request Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/requests` | All | Submit new request (multipart) |
| GET | `/requests` | All | List requests (filtered by role) |
| GET | `/requests/{id}` | All | Get request detail |
| PATCH | `/requests/{id}/status` | STAFF, TECHNICIAN | Update status |
| PATCH | `/requests/{id}/assign` | STAFF | Assign technician |
| PATCH | `/requests/{id}/priority` | STAFF | Override priority |
| POST | `/requests/predict` | All | Live AI priority preview |
| GET | `/requests/{id}/technician-recommendations` | STAFF | Ranked technician scores |
| GET | `/requests/check-duplicates` | All | Pre-submit duplicate check |
| GET | `/requests/suggest-category` | All | Keyword-based category suggestion |
| POST | `/requests/{id}/cancel` | CUSTOMER | Cancel own request |
| POST | `/requests/{id}/rate` | CUSTOMER | Rate resolution (1–5) |
| GET | `/requests/my-stats` | CUSTOMER | Own request status counts |
| GET | `/requests/stats` | ADMIN, STAFF | System-wide stats |

### Technician Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/technicians` | ADMIN, STAFF | List all technicians |
| GET | `/technicians/available` | ADMIN, STAFF | List available technicians |
| PATCH | `/technicians/{id}/profile` | ADMIN, STAFF | Set max capacity (maxWorkload only) |
| GET | `/technicians/me` | TECHNICIAN | Own technician profile |
| PATCH | `/technicians/me/profile` | TECHNICIAN | Update own specialization/coverage |
| GET | `/technicians/schedule` | TECHNICIAN | Own weekly schedule |
| PUT | `/technicians/schedule` | TECHNICIAN | Update weekly schedule |
| PATCH | `/technicians/toggle-availability` | TECHNICIAN | Toggle available/unavailable |

### Comment Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/requests/{id}/comments` | All | List comments (internal filtered for CUSTOMER) |
| POST | `/requests/{id}/comments` | All | Add comment |
| PATCH | `/requests/{id}/comments/{cid}` | Author | Edit comment |
| DELETE | `/requests/{id}/comments/{cid}` | Author, STAFF, ADMIN | Delete comment |

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | List all users |
| POST | `/admin/users` | Create user |
| PUT | `/admin/users/{id}` | Update user |
| DELETE | `/admin/users/{id}` | Delete user |
| PATCH | `/admin/users/{id}/toggle-status` | Activate/deactivate |
| PATCH | `/admin/users/{id}/approve` | Approve pending registration |
| DELETE | `/admin/users/{id}/reject` | Reject registration |
| GET | `/admin/users/pending` | List pending registrations |
| GET/POST/PUT/DELETE | `/admin/categories/**` | Category management |

---

## 10. Frontend Pages

### Customer Portal

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard/customer` | Stats overview, recent requests |
| Submit Request | `/submit-request` | Request form with AI live preview, duplicate check, category suggestion. Location and phone pre-filled from profile |
| My Requests | `/my-requests` | Own request list with status filter |
| Request Detail | `/requests/:id` | Full detail with comments, attachments, status history |
| Notifications | `/notifications` | In-app notification feed |
| Profile | `/profile` | Edit name, phone, location; change password; upload photo |

### Staff Portal

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard/operator` | Active feed, SLA alerts, hotspot map |
| Requests | `/requests` | Full paginated list with filters (status, priority, category, province, SLA) |
| Kanban | `/kanban` | Drag-and-drop board across Pending / In Progress / Resolved |
| Completed | `/completed` | Terminal state requests (Closed/Cancelled) |
| Technicians | `/technicians` | Technician list; set max capacity per technician |
| Notifications | `/notifications` | In-app notification feed |
| Profile | `/profile` | Edit own profile; change password |

### Technician Portal

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard/operator` | Assigned task feed |
| Assigned Tasks | `/tasks` | Task list with status filter, workload bar, Acknowledge & Start button |
| Kanban | `/kanban` | Kanban view of own assigned tasks |
| Completed | `/completed` | Own resolved/closed tasks |
| Availability | `/availability` | Weekly schedule editor + availability toggle |
| Notifications | `/notifications` | In-app notification feed |
| Profile | `/profile` | Edit own profile; change password; **Professional Profile section** (specialization, service category tags, province/district coverage) |

### Admin Portal

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard/admin` | System stats, priority distribution chart, SLA metrics |
| Users | `/users` | Full user management with approval queue |
| Categories | `/categories` | Service category management with default priority setting |
| Analytics | `/analytics` | Deep charts: AI confusion matrix, technician performance, geographic, confidence distribution |
| Reports | `/reports` | Report generation with CSV and PDF export |
| AI Predictions | `/ai-predictions` | AI accuracy tracking, model retrain trigger |
| Notifications | `/notifications` | In-app notification feed |
| Profile | `/profile` | Edit own profile; change password |

---

## 11. Email Notifications

All emails are sent asynchronously (`@Async`) and do not block the API response.

### Request Acknowledgement
**When:** Customer submits a request  
**To:** Customer  
**Contains:** Request code, category, predicted priority, expected SLA window, direct link to track the request

### Comment Notification
**When:** Staff or technician adds a **public** (non-internal) comment on a customer's request  
**To:** Customer  
**Contains:** Commenter's name, comment text, link to request  
*Note: Internal comments (staff-only notes) never trigger customer emails*

### Account Approved
**When:** Admin approves a pending registration  
**To:** New customer  
**Contains:** Welcome message, login link

### Password Reset
**When:** User requests password reset  
**To:** User  
**Contains:** Reset link valid for 1 hour

### Invitation (Admin-created accounts)
**When:** Admin creates a STAFF or TECHNICIAN account  
**To:** New user  
**Contains:** Login credentials and portal link

---

## 12. Deployment Notes

### Environment Variables Required

Before deploying to any non-local environment, move these values from `application.yml` to environment variables:

```bash
# Database
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/reg_arms
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<your_db_password>

# JWT
JWT_SECRET=<random_256_bit_hex_string>

# Email
MAIL_USERNAME=<gmail_address>
MAIL_PASSWORD=<gmail_app_password>

# Frontend URL (used in email links)
APP_FRONTEND_URL=https://your-domain.com
```

### Flask AI Service
- The Flask service should be bound to `127.0.0.1` only (not `0.0.0.0`) in production so it is not publicly accessible
- It should only be reachable from the Spring Boot process
- No authentication is currently on the Flask `/api/model/retrain` endpoint — restrict access at the network level

### CORS
Update `app.cors.allowed-origins` in `application.yml` for production domains:
```yaml
app:
  cors:
    allowed-origins: "https://your-domain.com"
```

### Database
- Flyway runs migrations automatically on startup
- PostgreSQL 14+ required
- The `reg_arms` database must be created before first run

### Running Locally

**Backend:**
```bash
cd backend
mvn spring-boot:run
# Runs on http://localhost:8080
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**AI Service:**
```bash
cd flask_service
pip install -r requirements.txt
python app.py
# Runs on http://localhost:5000
```

---

## 13. Known Limitations

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | Security | Flask service has no auth on `/api/model/retrain` — restrict at network level | High |
| 2 | Security | File serving (`GET /api/files/**`) has no ownership check — any logged-in user can access any file path | Medium |
| 3 | Security | JWT stored in `localStorage` — susceptible to XSS; HttpOnly cookies would be safer | Medium |
| 4 | Security | Hardcoded credentials in `application.yml` must be moved to env vars before production | High |
| 5 | Data | `GET /api/requests` SLA filter loads all rows into memory before paginating — may be slow with very large datasets | Low |
| 6 | UX | Admin has no frontend request-list page — they rely on dashboard stats only | Low |
| 7 | Data | Comment ownership not enforced at API level — customers can enumerate comments on any request ID (internal comments are filtered out) | Low |

---

*Document generated May 2026. For questions or updates, maintain this file alongside code changes.*
