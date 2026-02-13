# ✅ Fixes Applied - CORS and API URL Issues

## Problems Fixed:

1. ✅ **Frontend API URL**: Changed from `https://your-backend-url.com/api` to `http://127.0.0.1:8000/api`
2. ✅ **CORS Configuration**: Updated to allow all origins in development
3. ✅ **Config Files**: Updated both `public/config.js` and `dist/config.js`

## What You Need to Do:

### 1. Restart Your Frontend Dev Server
The frontend needs to reload to pick up the new `config.js` changes:

```bash
# Stop the current frontend server (Ctrl+C)
# Then restart it:
cd "Fyp CFMS"
npm run dev
```

### 2. Make Sure Backend is Running
The backend server should be starting. Check if it's running:

```bash
# Option 1: Use the batch file
start-backend.bat

# Option 2: Manual start
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python manage.py runserver 127.0.0.1:8000
```

### 3. Hard Refresh Your Browser
After restarting both servers:
- Press `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac) to hard refresh
- Or clear browser cache and reload

### 4. Verify Backend is Running
Open in browser: http://127.0.0.1:8000/api/

You should see the API root page.

## If You Want to Use MySQL Instead of SQLite:

Since you have MySQL set up, you can configure it:

1. Edit `Fyp CFMS\backend\.env` file
2. Add your MySQL password:
   ```
   DB_PASSWORD=your_mysql_password_here
   ```
3. Restart the backend server

The backend will automatically use MySQL if `DB_PASSWORD` is set, otherwise it uses SQLite.

## Testing:

1. Backend URL: http://127.0.0.1:8000/api/
2. Frontend URL: http://localhost:5173 (or whatever port Vite shows)
3. Try logging in - it should now connect to the correct backend!

## Troubleshooting:

If you still see CORS errors:
1. Make sure backend is running on port 8000
2. Check browser console for exact error message
3. Verify `config.js` shows `http://127.0.0.1:8000/api`
4. Hard refresh the browser (Ctrl+Shift+R)

