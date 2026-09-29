@echo off
setlocal
title Levi's Media Engine Pro - Dev Runner
cd /d "%~dp0"

echo ===================================================
echo   Levi's Media Engine Pro (Dev Version)
echo   Universal Downloader ^& Master Video-to-GIF Studio
echo ===================================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in your PATH!
    echo Please ensure Python 3.8+ is installed.
    echo.
    pause
    exit /b 1
)

echo [*] Launching Levi's Downloader Pro Backend...
cd app_backend
python backend.py

if %errorlevel% neq 0 (
    echo.
    echo [!] Application exited with code %errorlevel%.
    pause
)
