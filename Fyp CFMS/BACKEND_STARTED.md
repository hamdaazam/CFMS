# ✅ Backend Server Setup Complete!

## What Was Fixed:

1. ✅ Installed missing dependencies (`django-filter`, updated packages)
2. ✅ Configured SQLite database for easy local development (no MySQL needed)
3. ✅ Updated startup scripts

## How to Start the Backend:

### Option 1: Use the Batch File (Easiest)
Double-click: `start-backend.bat` (in the root CFMS folder)

### Option 2: Manual Start
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python manage.py runserver 127.0.0.1:8000
```

## Backend URL:
**http://127.0.0.1:8000**

## API Endpoints:
- **API Root**: http://127.0.0.1:8000/api/
- **Login**: http://127.0.0.1:8000/api/auth/login/
- **Register**: http://127.0.0.1:8000/api/auth/register/
- **Admin Panel**: http://127.0.0.1:8000/admin/

## First Time Setup:

If this is your first time running, you may need to create a superuser:

```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python manage.py createsuperuser
```

Follow the prompts to create an admin account.

## Troubleshooting:

If the server doesn't start:
1. Check that port 8000 is not already in use
2. Make sure all dependencies are installed: `pip install -r requirements.txt`
3. Check for error messages in the terminal

## Database:

The backend is now using **SQLite** (db.sqlite3 file) for local development.
- No MySQL setup required!
- Database file: `Fyp CFMS\backend\db.sqlite3`
- To switch to MySQL later, set `DB_PASSWORD` in `.env` file

