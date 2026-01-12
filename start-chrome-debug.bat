@echo off
REM Chrome Startup Script for Auto-Apply Extension
REM This starts Chrome with remote debugging enabled for Selenium connection

echo ========================================
echo    Auto-Apply Chrome Launcher
echo ========================================
echo.
echo Starting Chrome with remote debugging port 9222...
echo This allows Selenium to connect to your logged-in browser.
echo.

REM Close existing Chrome instances (optional - comment out if you want to keep Chrome running)
REM taskkill /F /IM chrome.exe 2>nul
REM timeout /t 2 >nul

REM Start Chrome with remote debugging port
cd /d "C:\Program Files\Google\Chrome\Application"
start chrome.exe --remote-debugging-port=9222

echo.
echo ✅ Chrome started with remote debugging on port 9222
echo.
echo You can now use the Auto-Apply extension.
echo Keep this window open while using the extension.
echo.
pause
