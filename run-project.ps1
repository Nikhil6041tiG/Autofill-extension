# PowerShell script to run the complete auto-apply job application system
# This script starts all three components of the project

Write-Host "Starting Auto-Apply Job Application System..." -ForegroundColor Green

# Function to start backend server
function Start-Backend {
    Write-Host "Starting Backend Server..." -ForegroundColor Yellow
    
    # Navigate to backend directory
    Set-Location "$PSScriptRoot\backend"
    
    # Build the project
    Write-Host "Building backend project..." -ForegroundColor Cyan
    npm run build
    
    # Start the server in a new PowerShell window
    Start-Process powershell -ArgumentList "-Command", "Set-Location '$PSScriptRoot\backend'; node dist/server.js; Read-Host 'Press Enter to close'"
    
    Write-Host "Backend server started on http://localhost:3000" -ForegroundColor Green
}

# Function to build Chrome extension
function Build-Extension {
    Write-Host "Building Chrome Extension..." -ForegroundColor Yellow
    
    # Navigate to extension directory
    Set-Location "$PSScriptRoot\extension"
    
    # Build the extension
    Write-Host "Installing extension dependencies..." -ForegroundColor Cyan
    npm install
    
    Write-Host "Building extension..." -ForegroundColor Cyan
    npm run build
    
    Write-Host "Chrome extension built successfully in /extension/dist" -ForegroundColor Green
}

# Function to start selenium runner
function Start-SeleniumRunner {
    Write-Host "Starting Selenium Runner..." -ForegroundColor Yellow
    
    # Navigate to selenium-runner directory
    Set-Location "$PSScriptRoot\selenium-runner"
    
    # Start selenium runner in a new PowerShell window
    Start-Process powershell -ArgumentList "-Command", "Set-Location '$PSScriptRoot\selenium-runner'; python -m uvicorn app:app --host 0.0.0.0 --port 8001; Read-Host 'Press Enter to close'"
    
    Write-Host "Selenium runner started on http://0.0.0.0:8001" -ForegroundColor Green
}

# Main execution
try {
    # Start backend server
    Start-Backend
    
    # Build Chrome extension
    Build-Extension
    
    # Start selenium runner
    Start-SeleniumRunner
    
    Write-Host ""
    Write-Host "All components are now running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "System Status:" -ForegroundColor Cyan
    Write-Host "  - Backend: http://localhost:4000" -ForegroundColor White
    Write-Host "  - Selenium Runner: http://0.0.0.0:8001" -ForegroundColor White
    Write-Host "  - Chrome Extension: Load from /extension/dist in Chrome" -ForegroundColor White
    Write-Host ""
    Write-Host "To use the extension:" -ForegroundColor Cyan
    Write-Host "  1. Open Chrome and go to chrome://extensions/" -ForegroundColor White
    Write-Host "  2. Enable 'Developer mode'" -ForegroundColor White
    Write-Host "  3. Click 'Load unpacked'" -ForegroundColor White
    Write-Host "  4. Select the '$PSScriptRoot\extension\dist' folder" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
catch {
    Write-Host "An error occurred: $($_.Exception.Message)" -ForegroundColor Red
}