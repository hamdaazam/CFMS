# ============================================================
# CFMS - Setup Daily Term Deactivation Task (PowerShell)
# This script creates a Windows Scheduled Task to automatically
# deactivate expired academic terms every day at midnight
# ============================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CFMS Term Management - Setup Scheduled Task" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory (backend directory)
$BackendDir = $PSScriptRoot
$PythonPath = Join-Path $BackendDir "venv\Scripts\python.exe"
$ScriptPath = Join-Path $BackendDir "manage.py"

Write-Host "Backend Directory: $BackendDir" -ForegroundColor Yellow
Write-Host "Python Path: $PythonPath" -ForegroundColor Yellow
Write-Host ""

# Check if Python exists
if (-not (Test-Path $PythonPath)) {
    Write-Host "ERROR: Python virtual environment not found!" -ForegroundColor Red
    Write-Host "Expected location: $PythonPath" -ForegroundColor Red
    Write-Host "Please ensure the virtual environment is set up correctly." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Right-click PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as administrator'" -ForegroundColor Yellow
    Write-Host "3. Navigate to: $BackendDir" -ForegroundColor Yellow
    Write-Host "4. Run: .\setup_scheduled_task.ps1" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Creating scheduled task..." -ForegroundColor Green
Write-Host ""

try {
    # Define the action
    $action = New-ScheduledTaskAction `
        -Execute $PythonPath `
        -Argument "manage.py deactivate_expired_terms" `
        -WorkingDirectory $BackendDir

    # Define the trigger (daily at midnight)
    $trigger = New-ScheduledTaskTrigger -Daily -At "00:00"

    # Define settings
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable:$false

    # Define principal (run with highest privileges)
    $principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest

    # Register the task
    Register-ScheduledTask `
        -TaskName "CFMS-DeactivateExpiredTerms" `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Daily task to deactivate expired academic terms in CFMS" `
        -Force | Out-Null

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  SUCCESS! Task created successfully." -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: CFMS-DeactivateExpiredTerms" -ForegroundColor White
    Write-Host "  Schedule: Daily at 00:00 (midnight)" -ForegroundColor White
    Write-Host "  Command: $PythonPath" -ForegroundColor White
    Write-Host "  Arguments: manage.py deactivate_expired_terms" -ForegroundColor White
    Write-Host "  Working Directory: $BackendDir" -ForegroundColor White
    Write-Host ""
    Write-Host "Management Commands:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  View task in Task Scheduler:" -ForegroundColor Yellow
    Write-Host "    taskschd.msc" -ForegroundColor White
    Write-Host ""
    Write-Host "  Test the task now:" -ForegroundColor Yellow
    Write-Host "    Start-ScheduledTask -TaskName 'CFMS-DeactivateExpiredTerms'" -ForegroundColor White
    Write-Host ""
    Write-Host "  Check task status:" -ForegroundColor Yellow
    Write-Host "    Get-ScheduledTask -TaskName 'CFMS-DeactivateExpiredTerms'" -ForegroundColor White
    Write-Host ""
    Write-Host "  View task history:" -ForegroundColor Yellow
    Write-Host "    Get-ScheduledTask -TaskName 'CFMS-DeactivateExpiredTerms' | Get-ScheduledTaskInfo" -ForegroundColor White
    Write-Host ""
    Write-Host "  Remove the task:" -ForegroundColor Yellow
    Write-Host "    Unregister-ScheduledTask -TaskName 'CFMS-DeactivateExpiredTerms' -Confirm:`$false" -ForegroundColor White
    Write-Host ""
    
    # Test run option
    Write-Host "Would you like to test the task now? (Y/N): " -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host ""
        Write-Host "Running task..." -ForegroundColor Yellow
        Start-ScheduledTask -TaskName "CFMS-DeactivateExpiredTerms"
        Start-Sleep -Seconds 2
        
        Write-Host ""
        Write-Host "Task execution initiated. Check the console output:" -ForegroundColor Green
        Write-Host ""
        
        # Show task info
        $taskInfo = Get-ScheduledTask -TaskName "CFMS-DeactivateExpiredTerms" | Get-ScheduledTaskInfo
        Write-Host "Last Run Time: $($taskInfo.LastRunTime)" -ForegroundColor White
        Write-Host "Last Result: $($taskInfo.LastTaskResult)" -ForegroundColor White
        Write-Host ""
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to create scheduled task." -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Read-Host "Press Enter to exit"
