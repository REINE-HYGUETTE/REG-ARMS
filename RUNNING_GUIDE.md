# REG ARMS — Running Guide

## Prerequisites

| Requirement    | Version  | Check Command          |
|----------------|----------|------------------------|
| Java JDK       | 17+      | `java -version`        |
| Maven          | 3.9+     | `mvn -version`         |
| Node.js        | 18+      | `node -v`              |
| npm            | 9+       | `npm -v`               |
| PostgreSQL     | 15+      | `psql --version`       |

## Step 1: Database Setup

Open a terminal and connect to PostgreSQL:

```bash
psql -U postgres
```

Create the database (if it doesn't exist):

```sql
CREATE DATABASE reg_abms;
\q
```

The password for the `postgres` user is `hyguette` (configured in `application.yml`).

Flyway will automatically run all migrations on first startup, creating all tables and seed data.

## Step 2: Start the Backend

```bash
cd backend

# Option A: Using Maven wrapper
./mvnw spring-boot:run

# Option B: Using Maven
mvn spring-boot:run

# Option C: Build and run JAR
mvn clean package -DskipTests
java -jar target/reg-arms-0.0.1-SNAPSHOT.jar
```

The backend starts on **http://localhost:8080**.

Verify it's running:
```bash
curl http://localhost:8080/api/categories
```

### Environment Variables (Optional)

| Variable       | Default                | Description            |
|----------------|------------------------|------------------------|
| JWT_SECRET     | (built-in default)     | JWT signing key        |
| AI_API_URL     | http://localhost:5000   | Python AI service URL  |
| UPLOAD_DIR     | ./uploads              | File upload directory  |
| MAIL_USERNAME  | noreply@reg.rw         | SMTP email sender      |
| MAIL_PASSWORD  | (empty)                | SMTP email password    |

## Step 3: Start the Frontend

```bash
cd frontend
npm install          # First time only
npm run dev
```

The frontend starts on **http://localhost:5173** (or 5174 if 5173 is in use).

Open your browser to **http://localhost:5173** — you should see the login page.

## Step 4: (Optional) Start the AI Microservice

The Python Flask AI service provides priority prediction:

```bash
cd ai_service
pip install -r requirements.txt
python app.py
```

Runs on **http://localhost:5000**. The system works without it — the frontend falls back to client-side keyword-based prediction if the AI service is unavailable.

## Default Test Accounts

After Flyway runs the seed migration, these accounts are available:

| Email                    | Password  | Role        |
|--------------------------|-----------|-------------|
| admin@reg.rw             | admin123  | ADMIN       |
| supervisor@reg.rw        | pass123   | SUPERVISOR  |
| staff@reg.rw             | pass123   | STAFF       |
| technician@reg.rw        | pass123   | TECHNICIAN  |
| customer@reg.rw          | pass123   | CUSTOMER    |

> Note: Check `V2__seed_data.sql` for exact seed accounts if different.

## Architecture Diagram

```
┌─────────────┐     /api proxy     ┌──────────────┐     JDBC     ┌────────────┐
│   React UI  │ ──────────────────→│ Spring Boot  │ ───────────→ │ PostgreSQL │
│  (Vite dev) │     port 5173      │   Backend    │  port 5432   │  reg_abms  │
│             │ ←──────────────────│  port 8080   │ ←─────────── │            │
└─────────────┘     JSON / JWT     └──────┬───────┘              └────────────┘
                                          │
                                          │ HTTP
                                          ▼
                                   ┌──────────────┐
                                   │ Python Flask  │
                                   │  AI Service   │
                                   │  port 5000    │
                                   └──────────────┘
```

## Troubleshooting

### Backend won't start
- **"Could not connect to database"**: Ensure PostgreSQL is running and `reg_abms` database exists
- **"Password authentication failed"**: Check `application.yml` — password should be `hyguette`
- **Port 8080 in use**: Kill existing process or change `server.port` in `application.yml`

### Frontend shows login loop
- Backend must be running — the frontend proxies all `/api` calls to port 8080
- Check browser console for 401 errors
- Clear `localStorage` (`reg_token`, `reg_user`) and try again

### CORS errors
- Only happens if you access frontend from a port not listed in `app.cors.allowed-origins`
- The Vite proxy avoids CORS entirely in development

### Flyway migration fails
- Ensure database is empty or set `spring.flyway.baseline-on-migrate: true` (already configured)
- Check `V1__initial_schema.sql` for any syntax issues with your PostgreSQL version
