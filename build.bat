@echo off
setlocal
title Levi's Media Engine Pro - Builder
cd /d "%~dp0"

echo ===================================================
echo   Levi's Media Engine Pro - Standalone Build Script
echo ===================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

echo [*] Step 1/3: Building Frontend with Vite...
cd app_frontend\youtube-downloader
call npm.cmd run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
cd ..\..

echo [*] Step 2/3: Copying Dist Web Assets to Backend...
if not exist "app_backend\dist" mkdir "app_backend\dist"
xcopy /E /Y /I "app_frontend\youtube-downloader\dist\*" "app_backend\dist\" >nul

echo [*] Step 3/3: Bundling with PyInstaller...
cd app_backend
python -m pip install --user pyinstaller >nul 2>&1
python -m PyInstaller LevisYoutubeDownloader.spec --noconfirm

if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller build failed!
    pause
    exit /b 1
)

cd ..
echo.
echo [SUCCESS] Standalone build complete!
echo Output executable is at: app_backend\dist\LevisYoutubeDownloader.exe
echo.
pause
