@echo off
echo ========================================
echo Admin Login Troubleshooter
echo ========================================
echo.

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv venv
    echo Then: venv\Scripts\activate
    pause
    exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat

echo Running troubleshooting script...
echo.
python troubleshoot_login.py

echo.
echo ========================================
echo Done!
echo ========================================
pause

