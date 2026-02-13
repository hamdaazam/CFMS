# How to Add More Users

## ✅ Test Users Created!

I've created test users with different roles. Here are the login credentials:

## 🔑 Test User Credentials

**Password for all test users: `test1234`**

### 1. Faculty Member
- **Email**: `faculty@test.com`
- **CNIC**: `1234567890124`
- **Role**: FACULTY

### 2. Course Coordinator
- **Email**: `coordinator@test.com`
- **CNIC**: `1234567890125`
- **Role**: COORDINATOR

### 3. Department Convener
- **Email**: `convener@test.com`
- **CNIC**: `1234567890126`
- **Role**: CONVENER

### 4. Head of Department
- **Email**: `hod@test.com`
- **CNIC**: `1234567890127`
- **Role**: HOD

### 5. Audit Member
- **Email**: `audit@test.com`
- **CNIC**: `1234567890128`
- **Role**: AUDIT_MEMBER

### 6. Admin User (already exists)
- **Email**: `admin@test.com`
- **CNIC**: `1234567890123`
- **Password**: `admin1234`
- **Role**: ADMIN

---

## 📝 Methods to Add More Users

### Method 1: Django Admin Panel (Easiest)

1. **Login to Admin:**
   - Go to: http://127.0.0.1:8000/admin/
   - Login with: `admin@test.com` / `admin1234`

2. **Add User:**
   - Click on **"Users"** in the left sidebar
   - Click **"Add User"** button (top right)
   - Fill in:
     - **CNIC**: 13 digits (e.g., `1234567890129`)
     - **Full Name**: User's full name
     - **Email**: User's email (optional but recommended)
     - **Password**: Set a password
     - **Role**: Select from dropdown
     - **Active**: ✅ Check this box (important!)
   - Click **"Save"**

### Method 2: Using Scripts

**Create more test users:**
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python create_multiple_users.py
```

**Activate all users (if any are inactive):**
```bash
python activate_all_users.py
```

### Method 3: Using API (Programmatic)

**Register via API:**
```bash
POST http://127.0.0.1:8000/api/auth/register/
Content-Type: application/json

{
  "cnic": "1234567890129",
  "full_name": "New User",
  "email": "newuser@test.com",
  "password": "password123",
  "password_confirm": "password123",
  "role": "FACULTY"
}
```

### Method 4: Import from MySQL Database

If you have users in your MySQL database (`cfms_db`), you can:

1. **Switch to MySQL:**
   - Edit `backend/.env` file
   - Add: `DB_PASSWORD=your_mysql_password`
   - Restart backend server

2. **Users will automatically be available** if they exist in MySQL

---

## ⚠️ Important Notes

1. **Users must be Active** to login:
   - Check the "Active" checkbox in Django admin
   - Or run: `python activate_all_users.py`

2. **CNIC Format:**
   - Must be exactly 13 digits
   - Numbers only (no dashes or spaces)

3. **Password Requirements:**
   - Minimum 8 characters
   - Can be any combination of letters/numbers

4. **Role Requirements:**
   - Some roles need department/program assignments
   - COORDINATOR needs both department and program
   - CONVENER needs department

---

## 🔍 Check All Users

**List all users:**
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python activate_all_users.py
```

This will show all users and their status.

---

## ✅ You're All Set!

You now have multiple users you can login with. Try logging in with different roles to test the system!

