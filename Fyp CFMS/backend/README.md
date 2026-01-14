# CFMS Backend - Course Folder Management System

Django REST API backend for the Course Folder Management System.

## 📋 Prerequisites

- Python 3.9 or higher
- MySQL 8.0 or higher
- MySQL Workbench (optional, for database management)

## 🚀 Installation Steps

### 1. Create MySQL Database

Open MySQL Workbench and run:

```sql
CREATE DATABASE cfms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Setup Python Environment

```bash
# Navigate to backend folder
cd "d:\Fyp Project Client\backend"

# Create virtual environment
python -m venv venv

# Activate virtual environment
# For Command Prompt:
venv\Scripts\activate

# For PowerShell:
venv\Scripts\Activate.ps1

# If PowerShell gives execution policy error:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

2. Edit `.env` and update:
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_NAME=cfms_db
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
DB_HOST=localhost
DB_PORT=3306
```

### 5. Run Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser (Admin)

```bash
python manage.py createsuperuser
```

Follow the prompts:
- Email: admin@cust.pk
- Full name: Admin User
- Password: (enter your password)

### 7. Start Development Server

```bash
python manage.py runserver
```

Backend will run on: **http://127.0.0.1:8000**

## 📚 API Endpoints

### Authentication (`/api/auth/`)
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login (returns JWT tokens)
- `POST /api/auth/logout/` - Logout
- `POST /api/auth/token/refresh/` - Refresh access token
- `GET /api/auth/me/` - Get current user info

### Terms (`/api/terms/`)
- `GET /api/terms/` - List all terms
- `POST /api/terms/` - Create term
- `GET /api/terms/{id}/` - Get term details
- `PUT /api/terms/{id}/` - Update term
- `DELETE /api/terms/{id}/` - Delete term

### Departments (`/api/departments/`)
- `GET /api/departments/` - List departments
- `POST /api/departments/` - Create department
- `GET /api/departments/{id}/` - Get department
- `PUT /api/departments/{id}/` - Update department
- `DELETE /api/departments/{id}/` - Delete department

### Programs (`/api/programs/`)
- `GET /api/programs/` - List programs
- `POST /api/programs/` - Create program
- `GET /api/programs/{id}/` - Get program
- `PUT /api/programs/{id}/` - Update program
- `DELETE /api/programs/{id}/` - Delete program
- Query: `?department=1` - Filter by department

### Faculty (`/api/faculty/`)
- `GET /api/faculty/` - List all faculty
- `POST /api/faculty/` - Add faculty
- `GET /api/faculty/{id}/` - Get faculty details
- `PUT /api/faculty/{id}/` - Update faculty
- `DELETE /api/faculty/{id}/` - Delete faculty
- Query: `?department=1` - Filter by department
- Query: `?program=1` - Filter by program
- Query: `?is_active=true` - Filter by active status

## 🧪 Testing the API

### 1. Admin Panel
Visit: http://127.0.0.1:8000/admin/
- Login with superuser credentials
- Manage all data through web interface

### 2. Swagger API Documentation
Visit: http://127.0.0.1:8000/swagger/
- Interactive API documentation
- Test endpoints directly from browser

### 3. ReDoc Documentation
Visit: http://127.0.0.1:8000/redoc/
- Alternative API documentation

### 4. DRF Browsable API
Visit: http://127.0.0.1:8000/api/
- Browse all endpoints
- Test with forms

## 📊 MySQL Queries (for MySQL Workbench)

### View All Tables
```sql
USE cfms_db;
SHOW TABLES;
```

### View Users
```sql
SELECT * FROM users_user;
```

### View Departments
```sql
SELECT * FROM departments_department;
```

### View Programs
```sql
SELECT * FROM programs_program;
```

### View Faculty
```sql
SELECT * FROM faculty_faculty;
```

### View Terms
```sql
SELECT * FROM terms_term;
```

### Delete All Data (BE CAREFUL!)
```sql
DELETE FROM faculty_faculty;
DELETE FROM programs_program;
DELETE FROM departments_department;
DELETE FROM terms_term;
DELETE FROM users_user WHERE is_superuser = 0;
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Login Example
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cust.pk","password":"yourpassword"}'
```

Response:
```json
{
  "user": {
    "id": 1,
    "email": "admin@cust.pk",
    "full_name": "Admin User",
    "role": "ADMIN"
  },
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Using JWT Token
```bash
curl -X GET http://127.0.0.1:8000/api/terms/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📁 Project Structure

```
backend/
├── cfms_backend/          # Main project settings
│   ├── settings.py        # Django settings
│   ├── urls.py           # Main URL routing
│   └── wsgi.py           # WSGI application
├── users/                # User management app
│   ├── models.py         # User model
│   ├── serializers.py    # User serializers
│   └── views.py          # Authentication views
├── terms/                # Terms management app
├── departments/          # Departments app
├── programs/             # Programs app
├── faculty/              # Faculty app
├── manage.py             # Django management script
├── requirements.txt      # Python dependencies
└── .env                  # Environment variables
```

## ⚠️ Common Issues

### Issue: "Access denied for user"
**Solution:** Check your MySQL password in `.env` file

### Issue: "No module named 'MySQLdb'"
**Solution:** 
```bash
pip install mysqlclient
```

### Issue: "Port 8000 already in use"
**Solution:**
```bash
python manage.py runserver 8001
```

### Issue: CORS errors in browser
**Solution:** Verify `CORS_ALLOWED_ORIGINS` in `.env` includes your frontend URL

## 🎯 Development Workflow

1. Activate virtual environment
2. Start Django server: `python manage.py runserver`
3. Make changes to code
4. Test changes in browser/Postman
5. If models changed, run migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

## 📝 Next Steps (Phase 2)

- [ ] Course allocation APIs
- [ ] Course folder creation
- [ ] File upload system (13 documents)
- [ ] Review/approval workflow
- [ ] PDF merger functionality
- [ ] Notifications system

## 🤝 Support

For any issues or questions, check:
1. Django error logs in terminal
2. MySQL error logs in Workbench
3. Browser console for frontend errors

---

**Backend Status:** ✅ Phase 1 Complete
**Version:** 1.0.0
**Last Updated:** October 8, 2025
