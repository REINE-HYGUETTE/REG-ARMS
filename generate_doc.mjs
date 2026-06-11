import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents,
} from 'docx';
import fs from 'fs';

const RED = 'B91C1C';
const DARK_RED = '7F1D1D';
const LIGHT_RED = 'FEE2E2';
const LIGHT_GRAY = 'F3F4F6';
const MED_GRAY = 'E5E7EB';
const DARK = '111827';
const GRAY_TEXT = '6B7280';

const border = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ─── helpers ───────────────────────────────────────────────────────────────────

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 32, color: DARK_RED })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RED, space: 4 } },
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 26, color: DARK })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, bold: true, font: 'Arial', size: 22, color: RED })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: 'Arial', size: 20, color: DARK, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: 'Arial', size: 20, color: DARK })],
  });
}

function bold(text) {
  return new TextRun({ text, font: 'Arial', size: 20, bold: true, color: DARK });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
    indent: { left: 360 },
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '374151' })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer(pts = 80) {
  return new Paragraph({ spacing: { before: 0, after: pts }, children: [] });
}

// ─── table builders ────────────────────────────────────────────────────────────

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        borders,
        width: { size: colWidths[i], type: WidthType.DXA },
        shading: { fill: RED, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, font: 'Arial', size: 18, color: 'FFFFFF' })],
        })],
      })
    ),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          borders,
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? 'FFFFFF' : LIGHT_GRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            children: [new TextRun({ text: cell, font: 'Arial', size: 18, color: DARK })],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ─── document sections ────────────────────────────────────────────────────────

const titlePage = [
  spacer(1440),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text: 'REG ARMS', font: 'Arial', size: 72, bold: true, color: RED })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: 'Automated Request Management System', font: 'Arial', size: 32, color: DARK_RED })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: 'Rwanda Energy Group', font: 'Arial', size: 26, color: GRAY_TEXT })],
  }),
  spacer(240),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: RED }, bottom: { style: BorderStyle.SINGLE, size: 4, color: RED } },
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: 'System Documentation  •  Version 1.0  •  May 2026', font: 'Arial', size: 22, color: GRAY_TEXT })],
  }),
  spacer(1440),
  pageBreak(),
];

const tocSection = [
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: 'Table of Contents', bold: true, font: 'Arial', size: 32, color: DARK_RED })],
  }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  pageBreak(),
];

// ─── Section 1: Overview ────────────────────────────────────────────────────────

const section1 = [
  heading1('1. System Overview'),
  para('REG ARMS is a full-stack customer service request management platform built for Rwanda Energy Group (REG). It handles the full lifecycle of customer service requests — from submission to resolution — with AI-powered priority prediction, smart technician assignment, real-time notifications, and SLA enforcement.'),
  spacer(60),
  heading2('Key Capabilities'),
  bullet('Customers submit service requests (power outages, billing disputes, equipment failures, etc.)'),
  bullet('AI engine predicts request priority using an ensemble ML model'),
  bullet('Smart algorithm matches and assigns the best available technician automatically for critical requests'),
  bullet('Staff manage request flow through a Kanban board and request list'),
  bullet('SLA deadlines are tracked per priority level with automatic escalation on breach'),
  bullet('Reports, analytics, and CSV/PDF exports for management'),
];

// ─── Section 2: Architecture ──────────────────────────────────────────────────

const section2 = [
  pageBreak(),
  heading1('2. Architecture'),
  heading2('Technology Stack'),
  makeTable(
    ['Layer', 'Technology'],
    [
      ['Frontend', 'React 18, TypeScript, Vite, Tailwind CSS, Tanstack Query, React Router, Recharts, Lucide icons'],
      ['Backend', 'Spring Boot 3, Java 17, Spring Security, Spring Data JPA, Hibernate'],
      ['Database', 'PostgreSQL with Flyway migrations'],
      ['AI Service', 'Python Flask, scikit-learn (Logistic Regression + Random Forest + Naive Bayes), TF-IDF'],
      ['Auth', 'JWT (1-hour expiry), BCrypt password hashing'],
      ['Email', 'JavaMailSender via Gmail SMTP'],
      ['Real-time', 'Server-Sent Events (SSE)'],
    ],
    [2200, 7160]
  ),
  spacer(120),
  heading2('Service Ports'),
  bullet('Frontend (React / Vite): http://localhost:5173 — proxies /api/* to Spring Boot'),
  bullet('Backend (Spring Boot): http://localhost:8080'),
  bullet('AI Service (Flask): http://localhost:5000'),
];

// ─── Section 3: User Roles ────────────────────────────────────────────────────

const section3 = [
  pageBreak(),
  heading1('3. User Roles & Access'),
  heading2('Role Summary'),
  makeTable(
    ['Role', 'Who', 'How Created', 'Portal'],
    [
      ['ADMIN', 'System administrators', 'Admin-created only', 'Admin Portal'],
      ['STAFF', 'Operations staff, dispatchers, supervisors', 'Admin-created only', 'Staff Portal'],
      ['TECHNICIAN', 'Field technicians', 'Admin-created only', 'Technician Portal'],
      ['CUSTOMER', 'REG customers', 'Self-register (requires admin approval)', 'Customer Portal'],
    ],
    [1800, 2500, 2500, 1960]
  ),
  spacer(120),
  heading2('Customer Registration Flow'),
  bullet('Customer fills registration form at /login'),
  bullet('Account created with isActive = false'),
  bullet('Admin receives notification, reviews, and approves via Users page'),
  bullet('Customer receives approval email and can now log in'),
  spacer(80),
  heading2('Role Capabilities'),
  heading3('ADMIN'),
  bullet('Full user management (create, edit, approve, deactivate, delete)'),
  bullet('Category management (create, edit, activate/deactivate)'),
  bullet('Reports, analytics, and data exports (CSV/PDF)'),
  bullet('AI model management and retraining'),
  bullet('Request archiving and restoration'),
  bullet('View all data across the system'),
  heading3('STAFF'),
  bullet('View and manage all requests (assign, change status, override priority)'),
  bullet('View and manage technicians (set capacity/max workload)'),
  bullet('Kanban board for request flow management'),
  bullet('SLA monitoring and technician recommendation engine'),
  bullet('Comment on requests (internal and public)'),
  heading3('TECHNICIAN'),
  bullet('View assigned tasks only'),
  bullet('Acknowledge and start tasks (Pending → In Progress)'),
  bullet('Complete tasks and add resolution notes'),
  bullet('Manage own weekly availability schedule'),
  bullet('Toggle own availability on/off'),
  bullet('Edit own professional profile (specialization, coverage areas)'),
  heading3('CUSTOMER'),
  bullet('Submit service requests with photo attachments'),
  bullet('Track own request statuses'),
  bullet('Cancel pending requests'),
  bullet('Add public comments on own requests'),
  bullet('Rate resolution satisfaction (1–5 stars)'),
  bullet('Receive email notifications on request updates'),
];

// ─── Section 4: Workflows ────────────────────────────────────────────────────

const section4 = [
  pageBreak(),
  heading1('4. Core Workflows'),
  heading2('4.1 Request Submission'),
  bullet('Customer fills form with title, description, category, location, and optional photo'),
  bullet('Live AI priority preview shown as customer types'),
  bullet('Duplicate check runs (same category + province)'),
  bullet('Category auto-suggestion fires as customer types the title'),
  bullet('On submit: AI priority prediction stored, SLA deadline calculated, request code generated (REG-YYYYMMDD-XXXX)'),
  bullet('Acknowledgement email sent to customer'),
  bullet('If Critical: auto-assign best technician (score ≥ 60)'),
  bullet('Staff/admin notified via SSE + notification record'),
  spacer(80),
  heading2('4.2 Request Lifecycle'),
  makeTable(
    ['Status', 'Description', 'Who Acts'],
    [
      ['Pending', 'Request submitted, awaiting assignment', 'Staff assigns technician'],
      ['In Progress', 'Technician acknowledged and started work', 'Technician works, adds comments'],
      ['Resolved', 'Technician marked resolved with notes', 'Customer rates satisfaction'],
      ['Closed', 'Request closed (terminal state)', '—'],
      ['Cancelled', 'Cancelled by customer or staff (terminal)', '—'],
    ],
    [1800, 4000, 2560]
  ),
  spacer(120),
  heading2('4.3 Priority Hierarchy'),
  para('When displaying priority, the system uses this precedence order:'),
  bullet('manualPriority (staff override) — highest precedence'),
  bullet('aiPriority (ML prediction)'),
  bullet('category.defaultPriority (admin-set policy)'),
  bullet('Medium (system default) — fallback'),
  spacer(80),
  heading2('4.4 SLA Windows'),
  makeTable(
    ['Priority', 'SLA Window'],
    [
      ['Critical', '2 hours'],
      ['High', '8 hours'],
      ['Medium', '24 hours'],
      ['Low', '72 hours'],
    ],
    [3000, 6360]
  ),
  spacer(80),
  para('SLA breached requests are automatically escalated to Critical by the background scheduler.'),
];

// ─── Section 5: AI Features ──────────────────────────────────────────────────

const section5 = [
  pageBreak(),
  heading1('5. AI Features'),
  heading2('5.1 Priority Prediction'),
  para('The AI service (Flask, port 5000) uses an ensemble of three ML models combined via soft-vote:'),
  makeTable(
    ['Model', 'Method'],
    [
      ['Logistic Regression', 'Soft-vote ensemble'],
      ['Random Forest', 'Soft-vote ensemble'],
      ['Naive Bayes', 'Soft-vote ensemble'],
    ],
    [4000, 5360]
  ),
  spacer(80),
  para('Input: Request title + description + category name'),
  para('Output: Priority level (Low / Medium / High / Critical) + confidence score (0–1) + detected keywords'),
  spacer(80),
  heading3('Overrides Applied After ML Prediction'),
  bullet('Keyword elevation — life-safety keywords (fire, electrocuted, explosion) elevate to Critical regardless of ML output'),
  bullet('Category floor — each category has an admin-set defaultPriority; AI cannot go below this floor'),
  bullet('Flask fallback — if Flask is unavailable, falls back to category.defaultPriority'),
  spacer(80),
  heading2('5.2 Category Auto-Suggestion'),
  para('Pure Java keyword matcher with synonym expansion in English, French, and Kinyarwanda. Runs without calling Flask. Fires as the customer types the request title.'),
  spacer(60),
  heading2('5.3 Duplicate Detection'),
  para('Before submission: GET /api/requests/check-duplicates?categoryId=&province= checks for open requests in the same category and province. Customer is warned but can still proceed.'),
  para('After submission: GET /api/requests/{id}/similar shows staff any similar open requests.'),
  spacer(60),
  heading2('5.4 AI Accuracy Tracking'),
  para('Every prediction is stored in ai_predictions. When staff override a priority, isCorrect = false is recorded. After 48 hours without override, AiAccuracyScheduler marks the prediction as implicitly correct. This feeds the accuracy reports on the Admin AI Predictions page. Overall accuracy is displayed capped at 97% to reflect real-world model limitations.'),
  spacer(60),
  heading2('5.5 Model Retraining'),
  para('Admin can trigger retraining via the AI Predictions page. The Spring backend collects all requests with known outcomes and sends them to Flask POST /api/model/retrain. The model retrains in-process and future predictions use the new weights.'),
];

// ─── Section 6: Smart Matching ────────────────────────────────────────────────

const section6 = [
  pageBreak(),
  heading1('6. Smart Technician Matching'),
  para('When staff views a request, the system scores all available technicians on a 100-point scale.'),
  spacer(60),
  heading2('Scoring Dimensions'),
  makeTable(
    ['Dimension', 'Base Weight', 'Critical Weight', 'Low Weight'],
    [
      ['Specialization match', '35 pts', '25 pts', '40 pts'],
      ['Location match', '25 pts', '30 pts', '25 pts'],
      ['Workload / availability', '25 pts', '35 pts', '15 pts'],
      ['Category history', '15 pts', '10 pts', '20 pts'],
    ],
    [3000, 1890, 1890, 1580]
  ),
  spacer(120),
  heading2('Specialization Scoring (up to 35 pts)'),
  bullet('Exact category tag match: full points'),
  bullet('Falls back to keyword matching against free-text specialization field'),
  spacer(60),
  heading2('Location Scoring (up to 25 pts)'),
  bullet('Province match: 15 pts'),
  bullet('District match: additional 10 pts (bonus on top)'),
  bullet('No province coverage declared: 0 pts'),
  spacer(60),
  heading2('Workload Scoring (up to 25 pts)'),
  para('Formula: (1 - currentWorkload / maxWorkload) × weight'),
  bullet('At 0% capacity used: full points'),
  bullet('At 100% capacity: 0 points'),
  bullet('Off-shift technicians (not working at current time): −40% penalty'),
  spacer(60),
  heading2('Category History Scoring (up to 15 pts)'),
  para('Based on how many times the technician has previously resolved requests in this category. Uses the categoryResolvedCounts map stored on the Technician entity.'),
  spacer(60),
  heading2('Auto-Assignment'),
  para('For Critical requests only: if the top-scored technician scores ≥ 60/100, they are automatically assigned without staff intervention. Staff can always reassign.'),
];

// ─── Section 7: SLA ──────────────────────────────────────────────────────────

const section7 = [
  pageBreak(),
  heading1('7. SLA Management'),
  heading2('Background Schedulers'),
  makeTable(
    ['Scheduler', 'Frequency', 'Action'],
    [
      ['Critical SLA check', 'Every 2 minutes', 'Detect Critical requests past 2h SLA; push URGENT_ALERT to all staff/admins'],
      ['Full SLA check', 'Every 10 minutes', 'Scan all priorities; auto-escalate breached requests to Critical; mark slaBreachNotifiedAt'],
    ],
    [2400, 1800, 5160]
  ),
  spacer(120),
  heading2('SLA Status Values'),
  makeTable(
    ['Status', 'Meaning', 'UI Indicator'],
    [
      ['OK', 'Within SLA window', 'No indicator shown'],
      ['AT_RISK', 'Less than 25% of window remaining', 'Amber chip with time remaining'],
      ['BREACHED', 'Deadline has passed', 'Red chip showing how long overdue'],
    ],
    [1800, 3000, 4560]
  ),
];

// ─── Section 8: Notifications ────────────────────────────────────────────────

const section8 = [
  pageBreak(),
  heading1('8. Notification System'),
  heading2('Real-Time (SSE)'),
  para('Each logged-in user has a persistent Server-Sent Events connection. The SseEmitterRegistry manages per-user emitter lifecycle with heartbeat keepalives. Events are pushed instantly on:'),
  bullet('New request created (staff/admin)'),
  bullet('Request assigned to technician'),
  bullet('Status changed'),
  bullet('SLA breach detected'),
  spacer(80),
  heading2('In-App Notifications'),
  para('All events are also stored in the notifications table and shown in the Notifications page. Unread count is shown in the topbar badge.'),
  spacer(60),
  heading2('Email Notifications'),
  makeTable(
    ['Trigger', 'Recipient', 'Content'],
    [
      ['Request submitted', 'Customer', 'Request code, category, predicted priority, SLA window, tracking link'],
      ['Comment added (public only)', 'Customer', 'Comment text, commenter name, link to request'],
      ['Account approved', 'Customer', 'Welcome message, login link'],
      ['Password reset', 'User', 'Reset link (expires in 1 hour)'],
      ['New user invited (admin-created)', 'New user', 'Credentials and portal link'],
    ],
    [2800, 1600, 4960]
  ),
];

// ─── Section 9: API Reference ────────────────────────────────────────────────

const section9 = [
  pageBreak(),
  heading1('9. API Reference'),
  para('Base URL: http://localhost:8080/api'),
  para('All endpoints (except /auth/** and /locations/**) require a JWT Bearer token in the Authorization header.'),
  spacer(80),
  heading2('Auth Endpoints'),
  makeTable(
    ['Method', 'Path', 'Description'],
    [
      ['POST', '/auth/login', 'Login → returns { token, user }'],
      ['POST', '/auth/register', 'Customer self-registration'],
      ['POST', '/auth/forgot-password', 'Request password reset email'],
      ['POST', '/auth/reset-password', 'Submit new password with reset token'],
    ],
    [1200, 3200, 4960]
  ),
  spacer(120),
  heading2('Request Endpoints'),
  makeTable(
    ['Method', 'Path', 'Roles', 'Description'],
    [
      ['POST', '/requests', 'All', 'Submit new request (multipart)'],
      ['GET', '/requests', 'All', 'List requests (filtered by role)'],
      ['GET', '/requests/{id}', 'All', 'Get request detail'],
      ['PATCH', '/requests/{id}/status', 'STAFF, TECHNICIAN', 'Update status'],
      ['PATCH', '/requests/{id}/assign', 'STAFF', 'Assign technician'],
      ['PATCH', '/requests/{id}/priority', 'STAFF', 'Override priority'],
      ['POST', '/requests/predict', 'All', 'Live AI priority preview'],
      ['GET', '/requests/{id}/technician-recommendations', 'STAFF', 'Ranked technician scores'],
      ['GET', '/requests/check-duplicates', 'All', 'Pre-submit duplicate check'],
      ['POST', '/requests/{id}/cancel', 'CUSTOMER', 'Cancel own request'],
      ['POST', '/requests/{id}/rate', 'CUSTOMER', 'Rate resolution (1–5)'],
    ],
    [1000, 3200, 1760, 3400]
  ),
  spacer(120),
  heading2('Technician Endpoints'),
  makeTable(
    ['Method', 'Path', 'Roles', 'Description'],
    [
      ['GET', '/technicians', 'ADMIN, STAFF', 'List all technicians'],
      ['GET', '/technicians/available', 'ADMIN, STAFF', 'List available technicians'],
      ['PATCH', '/technicians/{id}/profile', 'ADMIN, STAFF', 'Set max capacity (maxWorkload only)'],
      ['GET', '/technicians/me', 'TECHNICIAN', 'Own technician profile'],
      ['PATCH', '/technicians/me/profile', 'TECHNICIAN', 'Update own specialization/coverage'],
      ['GET', '/technicians/schedule', 'TECHNICIAN', 'Own weekly schedule'],
      ['PUT', '/technicians/schedule', 'TECHNICIAN', 'Update weekly schedule'],
      ['PATCH', '/technicians/toggle-availability', 'TECHNICIAN', 'Toggle available/unavailable'],
    ],
    [1000, 3200, 1760, 3400]
  ),
  spacer(120),
  heading2('Admin Endpoints'),
  makeTable(
    ['Method', 'Path', 'Description'],
    [
      ['GET', '/admin/users', 'List all users'],
      ['POST', '/admin/users', 'Create user'],
      ['PUT', '/admin/users/{id}', 'Update user'],
      ['DELETE', '/admin/users/{id}', 'Delete user'],
      ['PATCH', '/admin/users/{id}/toggle-status', 'Activate / deactivate'],
      ['PATCH', '/admin/users/{id}/approve', 'Approve pending registration'],
      ['DELETE', '/admin/users/{id}/reject', 'Reject pending registration'],
      ['GET', '/admin/users/pending', 'List pending registrations'],
      ['*/GET/POST/PUT/DELETE', '/admin/categories/**', 'Category management'],
    ],
    [2000, 3200, 4160]
  ),
];

// ─── Section 10: Frontend Pages ──────────────────────────────────────────────

const section10 = [
  pageBreak(),
  heading1('10. Frontend Pages'),
  heading2('Customer Portal'),
  makeTable(
    ['Page', 'Route', 'Description'],
    [
      ['Dashboard', '/dashboard/customer', 'Stats overview, recent requests'],
      ['Submit Request', '/submit-request', 'Request form with AI live preview, duplicate check, category suggestion'],
      ['My Requests', '/my-requests', 'Own request list with status filter'],
      ['Request Detail', '/requests/:id', 'Full detail with comments, attachments, status history'],
      ['Notifications', '/notifications', 'In-app notification feed'],
      ['Profile', '/profile', 'Edit name, phone, location; change password; upload photo'],
    ],
    [2000, 2500, 4860]
  ),
  spacer(120),
  heading2('Staff Portal'),
  makeTable(
    ['Page', 'Route', 'Description'],
    [
      ['Dashboard', '/dashboard/operator', 'Active feed, SLA alerts, hotspot map'],
      ['Requests', '/requests', 'Full paginated list with filters (status, priority, category, province, SLA)'],
      ['Kanban', '/kanban', 'Drag-and-drop board across Pending / In Progress / Resolved'],
      ['Technicians', '/technicians', 'Technician list; set max capacity per technician'],
      ['Notifications', '/notifications', 'In-app notification feed'],
      ['Profile', '/profile', 'Edit own profile; change password'],
    ],
    [2000, 2500, 4860]
  ),
  spacer(120),
  heading2('Technician Portal'),
  makeTable(
    ['Page', 'Route', 'Description'],
    [
      ['Dashboard', '/dashboard/operator', 'Assigned task feed'],
      ['Assigned Tasks', '/tasks', 'Task list with status filter, workload bar, Acknowledge & Start button'],
      ['Kanban', '/kanban', 'Kanban view of own assigned tasks'],
      ['Availability', '/availability', 'Weekly schedule editor + availability toggle'],
      ['Profile', '/profile', 'Edit own profile; Professional Profile section (specialization, coverage areas)'],
    ],
    [2000, 2500, 4860]
  ),
  spacer(120),
  heading2('Admin Portal'),
  makeTable(
    ['Page', 'Route', 'Description'],
    [
      ['Dashboard', '/dashboard/admin', 'System stats, priority distribution chart, SLA metrics'],
      ['Users', '/users', 'Full user management with approval queue'],
      ['Categories', '/categories', 'Service category management with default priority setting'],
      ['Analytics', '/analytics', 'Deep charts: AI confusion matrix, technician performance, geographic'],
      ['Reports', '/reports', 'Report generation with CSV and PDF export'],
      ['AI Predictions', '/ai-predictions', 'AI accuracy tracking, model retrain trigger'],
    ],
    [2000, 2500, 4860]
  ),
];

// ─── Section 11: Deployment ──────────────────────────────────────────────────

const section11 = [
  pageBreak(),
  heading1('11. Deployment Notes'),
  heading2('Environment Variables Required'),
  para('Before deploying to any non-local environment, move these values from application.yml to environment variables:'),
  code('SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/reg_arms'),
  code('SPRING_DATASOURCE_USERNAME=postgres'),
  code('SPRING_DATASOURCE_PASSWORD=<your_db_password>'),
  code('JWT_SECRET=<random_256_bit_hex_string>'),
  code('MAIL_USERNAME=<gmail_address>'),
  code('MAIL_PASSWORD=<gmail_app_password>'),
  code('APP_FRONTEND_URL=https://your-domain.com'),
  spacer(80),
  heading2('Flask AI Service'),
  bullet('Bind to 127.0.0.1 only (not 0.0.0.0) in production so it is not publicly accessible'),
  bullet('Reachable from the Spring Boot process only'),
  bullet('No authentication on /api/model/retrain — restrict at the network level'),
  spacer(80),
  heading2('Running Locally'),
  heading3('Backend'),
  code('cd backend'),
  code('mvn spring-boot:run'),
  code('# Runs on http://localhost:8080'),
  spacer(60),
  heading3('Frontend'),
  code('cd frontend'),
  code('npm install'),
  code('npm run dev'),
  code('# Runs on http://localhost:5173'),
  spacer(60),
  heading3('AI Service'),
  code('cd flask_service'),
  code('pip install -r requirements.txt'),
  code('python app.py'),
  code('# Runs on http://localhost:5000'),
  spacer(80),
  heading2('Database'),
  bullet('Flyway runs migrations automatically on startup'),
  bullet('PostgreSQL 14+ required'),
  bullet('The reg_arms database must be created before first run'),
  bullet('Update app.cors.allowed-origins in application.yml for production domains'),
];

// ─── Section 12: Known Limitations ───────────────────────────────────────────

const section12 = [
  pageBreak(),
  heading1('12. Known Limitations'),
  makeTable(
    ['#', 'Area', 'Issue', 'Severity'],
    [
      ['1', 'Security', 'Flask service has no auth on /api/model/retrain — restrict at network level', 'High'],
      ['2', 'Security', 'File serving has no ownership check — any logged-in user can access any file path', 'Medium'],
      ['3', 'Security', 'JWT stored in localStorage — susceptible to XSS; HttpOnly cookies would be safer', 'Medium'],
      ['4', 'Security', 'Hardcoded credentials in application.yml must be moved to env vars before production', 'High'],
      ['5', 'Data', 'SLA filter loads all rows into memory before paginating — may be slow with very large datasets', 'Low'],
      ['6', 'UX', 'Admin has no frontend request-list page — they rely on dashboard stats only', 'Low'],
      ['7', 'Data', 'Comment ownership not enforced at API level — internal comments are filtered but IDs are enumerable', 'Low'],
    ],
    [600, 1400, 5400, 1200]
  ),
  spacer(200),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 0 },
    children: [new TextRun({ text: 'Document generated May 2026 — REG ARMS System Documentation', font: 'Arial', size: 18, color: GRAY_TEXT, italics: true })],
  }),
];

// ─── Assemble ────────────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 20, color: DARK } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: DARK_RED },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: RED },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } },
          spacing: { before: 0, after: 120 },
          children: [
            new TextRun({ text: 'REG ARMS', font: 'Arial', size: 18, bold: true, color: RED }),
            new TextRun({ text: '  —  System Documentation', font: 'Arial', size: 18, color: GRAY_TEXT }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: MED_GRAY, space: 4 } },
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 0 },
          children: [
            new TextRun({ text: 'Page ', font: 'Arial', size: 16, color: GRAY_TEXT }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: GRAY_TEXT }),
            new TextRun({ text: ' of ', font: 'Arial', size: 16, color: GRAY_TEXT }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: GRAY_TEXT }),
          ],
        })],
      }),
    },
    children: [
      ...titlePage,
      ...tocSection,
      ...section1,
      ...section2,
      ...section3,
      ...section4,
      ...section5,
      ...section6,
      ...section7,
      ...section8,
      ...section9,
      ...section10,
      ...section11,
      ...section12,
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('C:/Users/hp/Documents/reg_ai_system/REG_ARMS_System_Documentation.docx', buffer);
  console.log('Done: REG_ARMS_System_Documentation.docx');
});
