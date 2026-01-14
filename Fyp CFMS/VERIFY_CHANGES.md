# How to View Excel Upload Feature

## ✅ Quick Steps:

1. **Open Browser**: http://localhost:5173

2. **Login as Admin**:
   - Email: `admin@example.com`
   - OR CNIC: `1112233445512`
   - Password: `admin123`

3. **Navigate to Faculty Management**:
   - Click "Faculty Management" in sidebar
   - OR go to: http://localhost:5173/faculty-management/manage

4. **Look for the Card at the TOP**:
   - White card with title "Bulk Faculty Upload (Excel)"
   - Should be ABOVE the "Faculty" header section
   - Contains file upload input and instructions

## 🔍 If You Don't See It:

### Check 1: Are you Admin?
- Look at top-right corner - should show your name
- Click on your profile - role should be "ADMIN"
- If not ADMIN, logout and login with admin credentials

### Check 2: Hard Refresh Browser
- Press `Ctrl + Shift + R`
- Or `Ctrl + F5`
- This clears cache and reloads

### Check 3: Check Browser Console
- Press `F12` to open DevTools
- Go to "Console" tab
- Look for any red errors
- If you see errors, share them

### Check 4: Verify URL
- Should be: `http://localhost:5173/faculty-management/manage`
- NOT: `http://localhost:5173/faculty-management` (without /manage)

## 📋 What You Should See:

```
┌─────────────────────────────────────────┐
│  Bulk Faculty Upload (Excel)            │
│                                         │
│  Upload an Excel file (.xlsx) with     │
│  columns:                               │
│                                         │
│  Required Columns:                     │
│  • name - Full name                    │
│  • email - Email address               │
│  • cnic - 13-digit CNIC number         │
│  • department - Department name         │
│  • role - FACULTY, CONVENER, or HOD    │
│                                         │
│  Optional: program, id                  │
│                                         │
│  [Note: Default password: Cust123]     │
│                                         │
│  [Select Excel File] [Upload Button]   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Faculty                                │
│  [Add Faculty Button]                  │
└─────────────────────────────────────────┘
```

## 🛠️ If Still Not Working:

1. **Restart Frontend Server**:
   ```cmd
   cd "C:\Users\Hamda Azam\Downloads\Fyp Project Client (7)\Fyp Project Client"
   npm run dev
   ```

2. **Check if file was saved**:
   - File: `src/pages/ManageFaculty.tsx`
   - Line 314-341 should have the Excel upload code

3. **Clear browser cache completely**:
   - Chrome: Settings → Privacy → Clear browsing data
   - Select "Cached images and files"
   - Time range: "All time"

