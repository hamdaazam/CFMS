# How to Access Excel Upload Feature

## 🚀 Step-by-Step Guide:

### Step 1: Make Sure Servers Are Running

**Backend (Django):**
```cmd
cd "C:\Users\Hamda Azam\Downloads\Fyp Project Client (7)\Fyp Project Client\backend"
venv\Scripts\activate
python manage.py runserver
```
Should show: `Starting development server at http://127.0.0.1:8000/`

**Frontend (React):**
```cmd
cd "C:\Users\Hamda Azam\Downloads\Fyp Project Client (7)\Fyp Project Client"
npm run dev
```
Should show: `Local: http://localhost:5173/`

### Step 2: Open Browser
Go to: **http://localhost:5173**

### Step 3: Login as Admin
- Click "Login" or go to: http://localhost:5173/login
- Enter:
  - **Email:** `admin@example.com`
  - **OR CNIC:** `1112233445512`
  - **Password:** `admin123`

### Step 4: Navigate to Faculty Management

**Option A: Via Sidebar (Easiest)**
1. After login, look at the left sidebar
2. Find "Faculty Management" menu item
3. Click on it
4. You'll see a page with "Add Faculty" button
5. On that page, look for a button/link that says "Manage Faculty" or "View Faculty"
6. Click it to go to `/faculty-management/manage`

**Option B: Direct URL**
After logging in, go directly to:
**http://localhost:5173/faculty-management/manage**

**Option C: Via Admin Dashboard**
1. After login, you'll be on Admin Dashboard
2. Look for "Faculty Management" card/section
3. Click "Manage Faculty" or "View Faculty" button
4. This will take you to the manage page

### Step 5: Find the Excel Upload Card

Once on `/faculty-management/manage`, you should see at the TOP:

```
┌─────────────────────────────────────────────┐
│  Bulk Faculty Upload (Excel)                │
│                                             │
│  Upload an Excel file (.xlsx) with columns: │
│  • name, email, cnic, department, role     │
│  • Default password: Cust123                │
│                                             │
│  [Select File] [Upload Button]              │
└─────────────────────────────────────────────┘
```

## 🔍 Troubleshooting:

### If you get "404 Not Found" or "Page not found":
- Make sure you're logged in as ADMIN
- Check the URL is exactly: `http://localhost:5173/faculty-management/manage`
- Try logging out and logging back in

### If you see "Unauthorized" or "Access Denied":
- You're not logged in as ADMIN
- Logout and login with admin credentials:
  - Email: `admin@example.com`
  - Password: `admin123`

### If the page loads but Excel upload card is missing:
- Press `Ctrl + Shift + R` to hard refresh
- Check browser console (F12) for errors
- Make sure you're on `/faculty-management/manage` not `/faculty-management`

### If servers aren't running:
- Check Task Manager for `node.exe` and `python.exe` processes
- Restart both servers using commands above

## 📍 Quick Links:

- **Login:** http://localhost:5173/login
- **Admin Dashboard:** http://localhost:5173/admin/dashboard
- **Add Faculty:** http://localhost:5173/faculty-management
- **Manage Faculty (Excel Upload):** http://localhost:5173/faculty-management/manage

## ✅ What You Should See:

1. **Login Page** → Enter admin credentials
2. **Admin Dashboard** → Shows overview
3. **Faculty Management Page** → Click "Manage Faculty" button
4. **Manage Faculty Page** → Excel upload card at the top!

