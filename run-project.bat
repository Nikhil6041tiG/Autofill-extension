@echo off
echo Starting Auto-Apply Job Application System...

echo Starting Backend Server...
cd /d "%~dp0\backend"
echo Building backend project...
npm run build

REM Start backend server in a new window
start cmd /k "cd /d %~dp0\backend && node dist/server.js && pause"

echo Installing and building Chrome Extension...
cd /d "%~dp0\extension"
npm install
npm run build

echo Starting Selenium Runner...
cd /d "%~dp0\selenium-runner"

REM Start selenium runner in a new window
start cmd /k "cd /d %~dp0\selenium-runner && python -m uvicorn app:app --host 0.0.0.0 --port 8002 && pause"

echo.
echo All components are now running!
echo.
echo System Status:
echo   - Backend: http://localhost:3000
echo   - Selenium Runner: http://0.0.0.0:8002
echo   - Chrome Extension: Load from /extension/dist in Chrome
echo.
echo To use the extension:
echo   1. Open Chrome and go to chrome://extensions/
echo   2. Enable 'Developer mode'
echo   3. Click 'Load unpacked'
echo   4. Select the %~dp0\extension\dist folder
echo.
echo Press any key to continue...
pause >nul