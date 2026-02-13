# Fix User Login Issues

## Problem: Can't Login Other Users

Users need `is_active=True` to login. Here are ways to fix this:

## Solution 1: Using Django Admin (Easiest)

1. **Access Django Admin:**
   - Open: http://127.0.0.1:8000/admin/
   - Login with your admin account

2. **Activate Users:**
   - Go to **Users** section
   - Find users that can't login
   - Click on each user
   - Check the **"Active"** checkbox
   - Click **Save**

## Solution 2: Using API (If you have admin access)

### Activate a specific user:
```bash
# First, login as admin to get token
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your_password"}'

# Then update user (replace USER_ID and TOKEN)
curl -X PATCH http://127.0.0.1:8000/api/users/USER_ID/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": true}'
```

## Solution 3: Create New Users via API

### Register a new user:
```bash
POST http://127.0.0.1:8000/api/auth/register/
Content-Type: application/json

{
  "cnic": "1234567890123",
  "full_name": "John Doe",
  "email": "john@example.com",
  "role": "FACULTY",
  "password": "securepassword123",
  "password_confirm": "securepassword123"
}
```

**Note:** CNIC must be exactly 13 digits (numbers only)

## Solution 4: Check User Status

### List all users via API:
```bash
GET http://127.0.0.1:8000/api/users/
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Look for users with `"is_active": false` - these cannot login.

## Common Issues:

### 1. User is inactive
- **Fix:** Set `is_active=True` in Django admin or via API

### 2. Coordinator users need extra setup
- Coordinators need:
  - Active faculty profile
  - Active course coordinator assignments
- **Fix:** Create these via admin or API

### 3. User doesn't exist
- **Fix:** Create user via register API or Django admin

### 4. Wrong credentials
- **Fix:** Reset password via Django admin or use "Forgot Password" if implemented

## Quick Check Script

Once the dependency issue is fixed, run:
```bash
cd "Fyp CFMS\backend"
.\venv\Scripts\Activate.ps1
python fix_user_login.py
```

This will show all users and their active status.

## For Coordinators Specifically

If a coordinator can't login, check:
1. User `is_active=True` ✓
2. Faculty profile exists and `is_active=True` ✓  
3. Has active `CourseCoordinatorAssignment` ✓

All three must be true for coordinator login to work.

