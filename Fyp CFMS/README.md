# CFMS - Course Folder Management System

A full-stack application for managing course folders with React frontend and Django backend.

## 🚀 Quick Start

### Prerequisites
- Python 3.9+ 
- Node.js 18+
- MySQL (optional - uses SQLite by default for local development)

### Backend Setup

1. **Navigate to backend folder:**
   ```bash
   cd "Fyp CFMS\backend"
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   .\venv\Scripts\Activate.ps1  # Windows PowerShell
   # OR
   venv\Scripts\activate  # Windows CMD
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start backend server:**
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```

   Backend will run on: **http://127.0.0.1:8000**

### Frontend Setup

1. **Navigate to frontend folder:**
   ```bash
   cd "Fyp CFMS"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

   Frontend will run on: **http://localhost:5173** (or similar port)

### Quick Start (Using Batch Files)

**Windows:**
- Double-click `start-backend.bat` to start backend
- Double-click `start-frontend.bat` to start frontend

## 📁 Project Structure

```
CFMS/
├── Fyp CFMS/          # Frontend (React + Vite)
│   ├── src/          # Source code
│   ├── public/       # Public assets
│   └── package.json  # Frontend dependencies
│
└── backend/          # Backend (Django REST API)
    ├── cfms_backend/ # Django project settings
    ├── users/        # User management app
    ├── courses/      # Course management app
    └── manage.py     # Django management script
```

## 🔧 Configuration

### Backend API URL
The frontend is configured to connect to `http://127.0.0.1:8000/api` by default.

To change it, edit: `Fyp CFMS/public/config.js`

### Database
- **Default**: SQLite (no setup required)
- **MySQL**: Set `DB_PASSWORD` in `backend/.env` to use MySQL

## 🌐 API Endpoints

- **API Root**: http://127.0.0.1:8000/api/
- **Admin Panel**: http://127.0.0.1:8000/admin/
- **API Docs**: http://127.0.0.1:8000/swagger/

## 🐛 Troubleshooting

### Backend won't start
1. Make sure virtual environment is activated
2. Check all dependencies are installed: `pip install -r requirements.txt`
3. Run migrations: `python manage.py migrate`

### Frontend can't connect to backend
1. Verify backend is running on http://127.0.0.1:8000
2. Check `public/config.js` has correct API URL
3. Hard refresh browser (Ctrl+Shift+R)

### CORS errors
- Backend is configured to allow all origins in development
- Make sure backend is running before starting frontend

## 📝 Notes

- All deployment files have been removed for local development focus
- Database uses SQLite by default (no MySQL setup needed)
- CORS is configured to allow all origins in development mode

