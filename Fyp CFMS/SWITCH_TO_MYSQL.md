# Switch Backend to MySQL Database

## Problem
Your backend is currently using SQLite database which only has 6 test users. Your actual data (many users) is in MySQL database.

## Solution: Switch to MySQL

### Step 1: Edit .env File

1. Open: `Fyp CFMS\backend\.env`
2. Add or update the MySQL password:
   ```
   DB_PASSWORD=your_mysql_password_here
   ```
   Replace `your_mysql_password_here` with your actual MySQL root password.

### Step 2: Restart Backend Server

1. **Stop the backend server** (Ctrl+C)
2. **Start it again:**
   ```bash
   cd "Fyp CFMS\backend"
   .\venv\Scripts\Activate.ps1
   python manage.py runserver 127.0.0.1:8000
   ```

### Step 3: Verify Connection

The backend will automatically connect to MySQL when `DB_PASSWORD` is set.

## Quick Check Script

After switching, run this to verify:
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python check_database.py
```

This will show:
- Which database is being used (should show MySQL)
- How many users are in the database

## If You Don't Know MySQL Password

1. Open MySQL Workbench
2. Try to connect - if it works, you know the password
3. Or check MySQL Workbench connection settings

## After Switching

Once connected to MySQL:
- All your existing users will be visible
- Frontend will show all users from MySQL database
- No data migration needed - Django will use existing MySQL tables

