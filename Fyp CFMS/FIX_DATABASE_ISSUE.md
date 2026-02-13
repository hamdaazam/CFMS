# 🔧 Fix: Users Not Showing from Database

## Problem Identified

Your backend is currently using **SQLite** database which only has 6 test users. Your actual data (many users) is in **MySQL** database (`cfms_db`).

## ✅ Solution: Switch to MySQL Database

### Quick Fix (Recommended)

**Option 1: Use the Script**
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python switch_to_mysql.py
```

Follow the prompts to enter your MySQL password.

**Option 2: Manual Edit**

1. Open: `Fyp CFMS\backend\.env`
2. Find the line: `DB_PASSWORD=`
3. Add your MySQL password: `DB_PASSWORD=your_mysql_password`
4. Save the file

### After Updating Password

**Restart Backend Server:**
1. Stop current server (Ctrl+C)
2. Start again:
   ```bash
   cd "Fyp CFMS\backend"
   .\venv\Scripts\Activate.ps1
   python manage.py runserver 127.0.0.1:8000
   ```

### Verify It Worked

Run this to check:
```bash
python check_database.py
```

You should see:
- Database Engine: `django.db.backends.mysql` (not sqlite3)
- Database Name: `cfms_db`
- Total users: (should show your actual user count from MySQL)

## Why This Happened

- When `DB_PASSWORD` is empty in `.env`, Django uses SQLite (easier for development)
- When `DB_PASSWORD` is set, Django uses MySQL
- Your data is in MySQL, but backend was using SQLite

## After Switching

✅ All your users from MySQL will be visible in frontend
✅ No data migration needed - Django uses existing MySQL tables
✅ All existing data preserved

## If You Don't Know MySQL Password

1. Open MySQL Workbench
2. Try to connect - the password you use there is what you need
3. Or check your MySQL Workbench saved connections

## Troubleshooting

**If backend won't start after switching:**
- Check MySQL is running
- Verify password is correct
- Check MySQL user has access to `cfms_db` database

**If still showing SQLite:**
- Make sure `.env` file has `DB_PASSWORD=your_password` (not empty)
- Restart backend server
- Check `check_database.py` output

