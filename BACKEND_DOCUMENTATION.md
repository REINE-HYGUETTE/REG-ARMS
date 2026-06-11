# REG ARMS — Backend Documentation

**Rwanda Energy Group — AI-Based Request Management System**

## Technology Stack

| Component        | Technology                          |
|------------------|-------------------------------------|
| Framework        | Spring Boot 3.3.5 (Java 17)        |
| Database         | PostgreSQL 15+                      |
| ORM              | Spring Data JPA / Hibernate 6       |
| Migrations       | Flyway                              |
| Authentication   | JWT (jjwt 0.12.6)                   |
| Authorization    | Spring Security with role-based access |
| AI Microservice  | Python Flask (TF-IDF + ensemble ML) |
| Build            | Maven                               |

## Project Structure

```
backend/src/main/java/com/reg/arms/
├── config/            # Security, CORS, app configuration
├── controller/        # REST API endpoints
├── dto/
│   ├── request/       # Incoming request DTOs
│   └── response/      # Outgoing response DTOs
├── entity/            # JPA entities
│   └── enums/         # PostgreSQL-mapped enums
├── exception/         # Custom exceptions & global handler
├── repository/        # Spring Data JPA repositories
├── security/          # JWT filter, UserPrincipal, token provider
└── service/           # Business logic layer
```

## Database Schema

**PostgreSQL** with custom ENUM types:

- `user_role`: ADMIN, SUPERVISOR, STAFF, TECHNICIAN, CUSTOMER
- `priority_level`: Low, Medium, High, Critical
- `request_status`: Pending, In Progress, Resolved, Closed
- `notification_type`: NEW_REQUEST, STATUS_UPDATE, ASSIGNMENT, RESOLVED, URGENT_ALERT, COMMENT, SYSTEM

**Core Tables:**

| Table                | Description                              |
|----------------------|------------------------------------------|
| `users`              | All system users with role and location  |
| `categories`         | Service request categories               |
| `requests`           | Service requests (core entity)           |
| `request_attachments`| File attachments linked to requests      |
| `technicians`        | Technician profiles linked to users      |
| `comments`           | Comments on requests (public/internal)   |
| `notifications`      | User notifications                       |
| `activity_logs`      | Audit trail for request changes          |
| `ai_predictions`     | AI model prediction history              |

Migrations are in `src/main/resources/db/migration/`.

## Authentication & Authorization

- **JWT tokens** issued on login/register, valid for 1 hour (configurable)
- Token sent as `Authorization: Bearer <token>` header
- **5 roles** with hierarchical permissions:

| Endpoint Pattern         | Allowed Roles                        |
|--------------------------|--------------------------------------|
| `/api/auth/**`           | Public (no auth required)            |
| `/api/admin/**`          | ADMIN only                           |
| `/api/reports/**`        | ADMIN, SUPERVISOR                    |
| `/api/technicians` (GET) | ADMIN, SUPERVISOR                    |
| `/api/technicians/toggle-availability` | TECHNICIAN             |
| All other `/api/**`      | Any authenticated user               |

## API Endpoints

### Auth — `/api/auth`

| Method | Path                    | Body                   | Response        | Auth  |
|--------|-------------------------|------------------------|-----------------|-------|
| POST   | `/api/auth/login`       | `{email, password}`    | AuthResponse    | No    |
| POST   | `/api/auth/register`    | RegisterRequest        | AuthResponse    | No    |
| POST   | `/api/auth/forgot-password` | `{email}`          | ApiResponse     | No    |
| POST   | `/api/auth/reset-password`  | ResetPasswordRequest | ApiResponse   | No    |

### Requests — `/api/requests`

| Method | Path                         | Description                    | Auth             |
|--------|------------------------------|--------------------------------|------------------|
| POST   | `/api/requests` (multipart)  | Create request with files      | Authenticated    |
| POST   | `/api/requests` (JSON)       | Create request without files   | Authenticated    |
| GET    | `/api/requests`              | List requests (paginated)      | Authenticated    |
| GET    | `/api/requests/{id}`         | Get request details            | Authenticated    |
| PATCH  | `/api/requests/{id}/status`  | Update request status          | Staff roles      |
| PATCH  | `/api/requests/{id}/assign`  | Assign technician              | ADMIN, SUPERVISOR|
| GET    | `/api/requests/stats`        | Dashboard statistics           | ADMIN, SUPERVISOR|

**Query parameters for GET `/api/requests`:**
- `search` — search by title, code, customer name
- `status` — filter by RequestStatus enum
- `page`, `size`, `sort` — Spring Pageable

### Comments — `/api/requests/{requestId}/comments`

| Method | Path                                    | Description       |
|--------|-----------------------------------------|-------------------|
| GET    | `/api/requests/{requestId}/comments`    | List comments     |
| POST   | `/api/requests/{requestId}/comments`    | Add comment       |

### Users — `/api`

| Method | Path                              | Description              | Auth     |
|--------|-----------------------------------|--------------------------|----------|
| GET    | `/api/profile`                    | Get current user profile | Auth     |
| PUT    | `/api/profile`                    | Update profile           | Auth     |
| POST   | `/api/profile/change-password`    | Change password          | Auth     |
| GET    | `/api/admin/users`                | List all users           | ADMIN    |
| POST   | `/api/admin/users`                | Create user              | ADMIN    |
| PATCH  | `/api/admin/users/{id}/toggle-status` | Toggle user active   | ADMIN    |

### Notifications — `/api/notifications`

| Method | Path                              | Description              |
|--------|---------------------------------  |--------------------------|
| GET    | `/api/notifications`              | List (paginated)         |
| GET    | `/api/notifications/unread-count` | Unread count             |
| PATCH  | `/api/notifications/{id}/read`    | Mark one as read         |
| PATCH  | `/api/notifications/read-all`     | Mark all as read         |

### Technicians — `/api/technicians`

| Method | Path                                   | Description            | Auth              |
|--------|----------------------------------------|------------------------|-------------------|
| GET    | `/api/technicians`                     | List all technicians   | ADMIN, SUPERVISOR |
| GET    | `/api/technicians/available`           | List available only    | ADMIN, SUPERVISOR |
| PATCH  | `/api/technicians/toggle-availability` | Toggle own availability| TECHNICIAN        |

### Reports — `/api/reports` (ADMIN, SUPERVISOR)

| Method | Path                              | Description                  |
|--------|-----------------------------------|------------------------------|
| GET    | `/api/reports/monthly-volume`     | Monthly request volume       |
| GET    | `/api/reports/by-priority`        | Count by priority level      |
| GET    | `/api/reports/by-category`        | Count by category            |
| GET    | `/api/reports/by-province`        | Count by province            |
| GET    | `/api/reports/by-status`          | Count by status              |
| GET    | `/api/reports/technician-performance` | Technician metrics       |
| GET    | `/api/reports/ai-accuracy`        | AI model accuracy stats      |

### Categories — `/api/categories`

| Method | Path               | Description         |
|--------|--------------------|---------------------|
| GET    | `/api/categories`  | List all categories |

## Configuration

Key settings in `application.yml`:

```yaml
spring.datasource.url: jdbc:postgresql://localhost:5432/reg_abms
server.port: 8080
app.jwt.expiration-ms: 3600000   # 1 hour
app.ai.api-url: http://localhost:5000
app.cors.allowed-origins: http://localhost:3000,http://localhost:5173
```

Environment variable overrides: `JWT_SECRET`, `AI_API_URL`, `UPLOAD_DIR`, `MAIL_USERNAME`, `MAIL_PASSWORD`.
