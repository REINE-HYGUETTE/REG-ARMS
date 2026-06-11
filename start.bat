@echo off
title REG ARMS - Startup
color 0A

echo ============================================
echo   REG ARMS - Starting All Services
echo ============================================
echo.

REM ── 1. Flask AI Service ─────────────────────────────────────────────────────
echo [1/3] Starting AI Service (Flask on port 5000)...
cd /d "%~dp0ai-service"
start "REG ARMS - AI Service" cmd /k "python3 ai_api.py"
timeout /t 3 /nobreak >nul

REM ── 2. Spring Boot Backend ──────────────────────────────────────────────────
echo [2/3] Starting Backend (Spring Boot on port 8080)...
cd /d "%~dp0backend"
start "REG ARMS - Backend" cmd /k "mvnw.cmd spring-boot:run"
echo       (first run may take 1-2 minutes to compile)
timeout /t 5 /nobreak >nul

REM ── 3. React Frontend ───────────────────────────────────────────────────────
echo [3/3] Starting Frontend (React/Vite on port 5173)...
cd /d "%~dp0frontend"
start "REG ARMS - Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   All services are starting up.
echo   Open: http://localhost:5173
echo ============================================
echo.
echo   AI Service  → http://localhost:5000/api/health
echo   Backend     → http://localhost:8080
echo   Frontend    → http://localhost:5173
echo.
pause
