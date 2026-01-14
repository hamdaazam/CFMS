@echo off
REM ============================================================
REM CFMS - Setup Daily Term Deactivation Task
REM This script creates a Windows Scheduled Task to automatically
REM deactivate expired academic terms every day at midnight
REM ============================================================

echo.
echo ============================================================
echo   CFMS Term Management - Setup Scheduled Task
echo ============================================================
echo.

REM Get the current directory
set BACKEND_DIR=%~dp0
set PYTHON_PATH=%BACKEND_DIR%venv\Scripts\python.exe
set SCRIPT_PATH=%BACKEND_DIR%manage.py

echo Backend Directory: %BACKEND_DIR%
echo Python Path: %PYTHON_PATH%
echo.

REM Check if Python exists
if not exist "%PYTHON_PATH%" (
    echo ERROR: Python virtual environment not found!
    echo Expected location: %PYTHON_PATH%
    echo Please ensure the virtual environment is set up correctly.
    echo.
    pause
    exit /b 1
)

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Please:
    echo 1. Right-click this script
    echo 2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Creating scheduled task...
echo.

REM Create the scheduled task
schtasks /create /tn "CFMS-DeactivateExpiredTerms" /tr "\"%PYTHON_PATH%\" \"%SCRIPT_PATH%\" deactivate_expired_terms" /sc daily /st 00:00 /f /rl highest /ru SYSTEM

if %errorLevel% EQU 0 (
    echo.
    echo ============================================================
    echo   SUCCESS! Task created successfully.
    echo ============================================================
    echo.
    echo Task Details:
    echo   Name: CFMS-DeactivateExpiredTerms
    echo   Schedule: Daily at 00:00 (midnight)
    echo   Command: %PYTHON_PATH%
    echo   Arguments: %SCRIPT_PATH% deactivate_expired_terms
    echo.
    echo To verify the task:
    echo   1. Open Task Scheduler (taskschd.msc)
    echo   2. Look for "CFMS-DeactivateExpiredTerms"
    echo.
    echo To test the task now:
    echo   schtasks /run /tn "CFMS-DeactivateExpiredTerms"
    echo.
    echo To remove the task:
    echo   schtasks /delete /tn "CFMS-DeactivateExpiredTerms" /f
    echo.
) else (
    echo.
    echo ERROR: Failed to create scheduled task.
    echo Error code: %errorLevel%
    echo.
)

pause
