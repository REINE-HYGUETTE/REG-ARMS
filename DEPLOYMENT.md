# REG-ARMS — Deployment Guide

Three services + a database. Recommended free-tier hosts:

| Service   | Host                         | Build                          |
|-----------|------------------------------|--------------------------------|
| Database  | Neon (serverless Postgres)   | —                              |
| Backend   | Render / Koyeb (Docker)      | `backend/Dockerfile`           |
| AI service| Render / Koyeb (Docker)      | `ai-service/Dockerfile`        |
| Frontend  | Vercel / Netlify (static)    | `npm run build` → `dist/`      |

Deploy order: **Database → AI service → Backend → Frontend** (each needs the URL of the one before it).

---

## 1. Database — Neon
Create a project, copy the connection string. Convert it to JDBC form for the backend:
- Neon gives: `postgresql://USER:PASS@HOST/DB?sslmode=require`
- Backend needs: `DATABASE_URL = jdbc:postgresql://HOST/DB?sslmode=require&stringtype=unspecified`
  with `DATABASE_USERNAME` and `DATABASE_PASSWORD` set separately.

Flyway runs the migrations automatically on first backend boot.

## 2. AI service (Flask)
No env vars required. Render/Koyeb inject `PORT`; the Dockerfile honors it.
After deploy, note its URL, e.g. `https://reg-arms-ai.onrender.com`.

## 3. Backend (Spring Boot) — Koyeb (Docker, free tier, allows Gmail SMTP)

Koyeb builds straight from the GitHub repo. Because this is a monorepo, point it
at the `backend/` folder:

1. **Create Service** → GitHub → repo `REG-ARMS`, branch `master`.
2. **Builder:** Dockerfile.
   - **Work directory:** `backend`
   - **Dockerfile location:** `backend/Dockerfile`
3. **Instance:** Free (Nano). **Region:** Frankfurt (closest to Rwanda).
4. **Exposed port:** `8080` (also set env `PORT=8080`). Health check: **TCP** on
   `8080` (the default — the app has no `/health` route, and TCP is enough).
5. Add the env vars in the table below → **Deploy**.
6. Copy the service URL (e.g. `https://reg-arms-api-xxxx.koyeb.app`). You'll put
   it in the frontend's `VITE_API_URL`.
7. **After the frontend is live**, come back and set `CORS_ALLOWED_ORIGINS` and
   `FRONTEND_URL` to the Vercel URL, then redeploy (resolves the chicken-and-egg).

### Backend env vars
| Var | Example | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `jdbc:postgresql://...&stringtype=unspecified` | from Neon |
| `DATABASE_USERNAME` | `reg_user` | |
| `DATABASE_PASSWORD` | `••••` | |
| `JWT_SECRET` | long random string | **change from default** |
| `AI_API_URL` | `https://reg-arms-ai.onrender.com` | no trailing slash |
| `CORS_ALLOWED_ORIGINS` | `https://reg-arms.vercel.app` | the frontend URL |
| `FRONTEND_URL` | `https://reg-arms.vercel.app` | used in email links |
| `MAIL_HOST` | `smtp.gmail.com` | Gmail SMTP |
| `MAIL_PORT` | `587` | STARTTLS |
| `MAIL_USERNAME` | `reinehyguette@gmail.com` | must be the Gmail account; becomes the `From` |
| `MAIL_PASSWORD` | *(16-char Gmail app password, no spaces)* | set in host dashboard only — never commit |
| `DB_POOL_SIZE` | `5` | keep small for Neon free tier |
| `UPLOAD_DIR` | `./uploads` | **ephemeral** — see note below |
| `PORT` | `8080` | must match the exposed port set in Koyeb |

## 4. Frontend (static) — build-time env var
Set **before building** (Vercel/Netlify env settings):
| Var | Value |
|-----|-------|
| `VITE_API_URL` | `https://reg-arms-api.onrender.com/api` (backend origin **+ `/api`**) |

Build command `npm run build`, publish directory `dist`. Add an SPA rewrite
(all routes → `/index.html`) so React Router deep links work:
- Netlify: `_redirects` file with `/*  /index.html  200`
- Vercel: handled automatically for Vite, or add a rewrite to `/index.html`.

---

## Known free-tier caveats (already handled in code)
- **AI fallback:** if the AI service is asleep, the backend uses the category's
  default priority — no error. Safe to let it sleep.
- **Cold starts:** free backends sleep after ~15 min idle (~30–50s first hit).
  Keep just the **backend** warm with an UptimeRobot ping if needed.
- **Ephemeral disk:** uploaded attachments in `UPLOAD_DIR` are wiped on every
  redeploy/restart. For durable attachments, move `FileStorageService` to object
  storage (Supabase Storage / Cloudinary) — not yet done.
- **SMTP:** **Render's free tier blocks outbound SMTP ports**, so Gmail SMTP
  will NOT work there. To use Gmail SMTP, host the backend on **Koyeb, Railway,
  or Fly.io** (these allow outbound SMTP). The `From` address is automatically
  the Gmail account in `MAIL_USERNAME`. If port 587 is blocked, try `MAIL_PORT=465`.
- **Memory:** backend heap capped at 400 MB (`JAVA_TOOL_OPTIONS` in Dockerfile)
  to fit 512 MB tiers.
</content>
