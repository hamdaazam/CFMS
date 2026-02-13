# ✅ Default Login Credentials Created!

## 🎉 Problem Solved!

The database was empty - that's why you were getting "Invalid credentials" error. I've created a default admin user for you.

## 🔑 Login Credentials

You can now login with **either** of these:

### Option 1: Email Login
- **Email**: `admin@test.com`
- **Password**: `admin1234`

### Option 2: CNIC Login
- **CNIC**: `1234567890123`
- **Password**: `admin1234`

## 🚀 Try Logging In Now!

1. Make sure **backend is running**: http://127.0.0.1:8000
2. Make sure **frontend is running**: http://localhost:5173
3. Go to the login page
4. Use the credentials above

## 📝 Create More Users

### Using Django Admin:
1. Go to: http://127.0.0.1:8000/admin/
2. Login with the credentials above
3. Go to "Users" section
4. Click "Add User"

### Using Script:
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python create_default_user.py
```

### Using API:
```bash
POST http://127.0.0.1:8000/api/auth/register/
{
  "cnic": "1234567890124",
  "full_name": "Your Name",
  "email": "your@email.com",
  "password": "yourpassword",
  "password_confirm": "yourpassword",
  "role": "FACULTY"
}
```

## 🔧 Reset Password

If you need to reset the password for the default user:

```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python create_default_user.py
```

This will reset the password back to `admin1234`.

## ✅ You're All Set!

The login should work now. The issue was that there were no users in the database - now there is one!

