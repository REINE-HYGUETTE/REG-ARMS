# REG ARMS — Frontend Documentation

**Rwanda Energy Group — AI-Based Request Management System**

## Technology Stack

| Component        | Technology                          |
|------------------|-------------------------------------|
| Framework        | React 19 + TypeScript 6             |
| Build Tool       | Vite 6.4                            |
| Styling          | Tailwind CSS v4 (with @theme tokens)|
| Server State     | TanStack Query v5                   |
| Auth State       | React Context (AuthProvider)        |
| Charts           | Recharts                            |
| HTTP Client      | Axios (with JWT interceptor)        |
| Routing          | React Router v7                     |
| Icons            | Lucide React                        |

## Project Structure

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # Main layout (Sidebar + Topbar + Outlet)
│   │   ├── Sidebar.tsx        # Role-based navigation sidebar
│   │   └── Topbar.tsx         # Top header with notifications bell
│   └── ui/
│       ├── Badge.tsx          # PriorityBadge & StatusBadge
│       ├── MetricCard.tsx     # Dashboard stat cards
│       └── Spinner.tsx        # Loading spinner
├── lib/
│   ├── api.ts                 # Axios instance with JWT interceptor
│   └── auth.tsx               # AuthProvider context + useAuth hook
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.tsx # Admin dashboard with charts & table
│   │   └── UsersPage.tsx      # User management (CRUD)
│   ├── customer/
│   │   ├── CustomerDashboard.tsx  # Customer overview
│   │   ├── MyRequestsPage.tsx     # Customer's request list
│   │   └── SubmitRequestPage.tsx  # Submit form + AI prediction
│   ├── operator/
│   │   └── OperatorDashboard.tsx  # Staff/Tech/Supervisor dashboard
│   ├── AIPredictionsPage.tsx  # AI accuracy dashboard
│   ├── AnalyticsPage.tsx      # 4-tab analytics (Overview, AI, Tech, Geo)
│   ├── AvailabilityPage.tsx   # Technician availability toggle
│   ├── CompletedPage.tsx      # Resolved requests list
│   ├── DashboardRedirect.tsx  # Redirects / to role-specific dashboard
│   ├── KanbanPage.tsx         # Drag-drop kanban board
│   ├── LoginPage.tsx          # Login + Register forms
│   ├── NotFoundPage.tsx       # 404 page
│   ├── NotificationsPage.tsx  # Notifications list
│   ├── ProfilePage.tsx        # Profile edit + password change
│   ├── ReportsPage.tsx        # Report templates + charts
│   ├── RequestDetailPage.tsx  # Request detail with comments
│   ├── RequestsListPage.tsx   # Admin/Staff request table
│   └── TechniciansPage.tsx    # Technician management table
├── types/
│   └── index.ts               # TypeScript interfaces
├── App.tsx                    # Route definitions
└── main.tsx                   # Entry point
```

## Design System

### Color Tokens (Tailwind @theme)

| Token             | Value     | Usage                     |
|-------------------|-----------|---------------------------|
| `--color-primary` | `#00703C` | REG green — buttons, links|
| `--color-accent`  | `#F5C518` | REG yellow — highlights   |
| `--color-danger`  | `#DC2626` | Errors, critical badges   |
| `--color-surface` | `#F8FAF9` | Page background           |
| `--color-border`  | `#E2E8E4` | Card/table borders        |

### UI Patterns

- **Cards**: `bg-white rounded-xl border border-border p-5 shadow-sm`
- **Tables**: Inside cards with `bg-surface-alt` header rows
- **Buttons**: Primary `bg-primary text-white rounded-lg`, outline `border-border`
- **Inputs**: `border-[1.5px] border-border rounded-lg focus:border-primary`
- **Badges**: Color-coded by priority (Critical=red, High=orange, Medium=yellow, Low=green)

## Pages by Role

| Page              | ADMIN | SUPERVISOR | STAFF | TECHNICIAN | CUSTOMER |
|-------------------|-------|------------|-------|------------|----------|
| Dashboard         | Admin | Operator   | Operator | Operator | Customer |
| Submit Request    |       |            |       |            | Yes      |
| My Requests       |       |            |       |            | Yes      |
| All Requests      | Yes   | Yes        | Yes   |            |          |
| Assigned Tasks    |       |            |       | Yes        |          |
| Kanban Board      |       | Yes        | Yes   | Yes        |          |
| Completed         |       |            | Yes   | Yes        |          |
| AI Predictions    | Yes   | Yes        |       |            |          |
| Reports           | Yes   | Yes        |       |            |          |
| Analytics         | Yes   |            |       |            |          |
| Users & Roles     | Yes   |            |       |            |          |
| Technicians       | Yes   | Yes        |       |            |          |
| Availability      |       |            | Yes   | Yes        |          |
| Notifications     | Yes   | Yes        | Yes   | Yes        | Yes      |
| Profile           | Yes   | Yes        | Yes   | Yes        | Yes      |

## API Integration

### Axios Configuration (`lib/api.ts`)

- Base URL: `/api` (proxied by Vite to `http://localhost:8080`)
- JWT token stored in `localStorage` as `reg_token`
- Auto-redirect to `/login` on 401 response

### Auth Flow (`lib/auth.tsx`)

1. User submits login → `POST /api/auth/login`
2. AuthResponse saved to `localStorage` (`reg_token` + `reg_user`)
3. AuthContext provides `token`, `role`, `userId`, `fullName` to all components
4. Axios interceptor attaches `Authorization: Bearer <token>` to every request

### Key API Mappings

| Frontend Action              | Backend Endpoint                        |
|-----------------------------|-----------------------------------------|
| Login                       | `POST /api/auth/login`                  |
| Register                    | `POST /api/auth/register`               |
| Submit request (with files) | `POST /api/requests` (multipart)        |
| List requests               | `GET /api/requests?page=&status=&search=` |
| View request detail         | `GET /api/requests/{id}`                |
| Update status               | `PATCH /api/requests/{id}/status`       |
| Add comment                 | `POST /api/requests/{id}/comments`      |
| Dashboard stats             | `GET /api/requests/stats`               |
| Notifications               | `GET /api/notifications?size=100`       |
| Mark notification read      | `PATCH /api/notifications/{id}/read`    |
| Profile                     | `GET /PUT /api/profile`                 |
| Change password             | `POST /api/profile/change-password`     |
| Admin: list users           | `GET /api/admin/users`                  |
| Admin: create user          | `POST /api/admin/users`                 |
| Toggle technician avail.    | `PATCH /api/technicians/toggle-availability` |
| Report data                 | `GET /api/reports/*`                    |

## Development

```bash
cd frontend
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

Vite proxy forwards `/api` to `http://localhost:8080` (Spring Boot backend).
