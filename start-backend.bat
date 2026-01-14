@echo off
echo Starting Django Backend Server...
cd "Fyp Project Client\backend"
call venv\Scripts\activate
python manage.py runserver
pause

