@echo off
echo ========================================
echo Starting Django Backend Server
echo ========================================
cd "Fyp CFMS\backend"

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo Installing dependencies...
    call venv\Scripts\activate
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt
    pip install django-filter
) else (
    call venv\Scripts\activate
)

echo.
echo Running database migrations...
python manage.py migrate

echo.
echo ========================================
echo Starting server on http://127.0.0.1:8000
echo ========================================
echo Press Ctrl+C to stop the server
echo.
python manage.py runserver 127.0.0.1:8000
pause

