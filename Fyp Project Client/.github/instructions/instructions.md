# CFMS (Course Folder Management System) - AI Agent Instructions

## System Architecture

**Full-stack application**: React 19 + TypeScript frontend with Django 4.2 REST backend, MySQL database.

### Project Structure
- `src/` - React frontend (Vite dev server, port 5173)
- `backend/` - Django REST API (port 8000)
- Django apps: `users`, `terms`, `departments`, `programs`, `faculty`, `courses`

## Critical Knowledge

### Authentication & User Model
**CNIC-based authentication** (13-digit Pakistani ID) instead of email/username:
- Login with: `cnic` (13 digits) + `password`
- Custom User model: `backend/users/models.py` with `AUTH_USER_MODEL = 'users.User'`
- JWT tokens stored in localStorage: `access_token`, `refresh_token`, `user`
- Role hierarchy: ADMIN > CONVENER (dept) > COORDINATOR (program) > SUPERVISOR/EVALUATOR > STUDENT

### Data Model Relationships
```
Department (1:N) Programs (1:N) Courses
    │                │
    └────────> Users (role-based)
    │                │
    └────────> Faculty (FK to User + dept/program)
```

**Key constraint**: Users MUST be created before Faculty records (Faculty has FK to User).

### API Patterns

**Backend (Django REST)**: All apps use `ModelViewSet` with DRF routers
- Endpoints: `/api/<app>/` (list/create), `/api/<app>/<id>/` (retrieve/update/delete)
- Course allocations: `/api/courses/allocations/`
- Authentication: `/api/auth/login/`, `/api/auth/me/`, `/api/auth/register/`

**Frontend (Axios)**: Centralized in `src/services/api.ts`
```typescript
// Pattern for all API modules:
export const <entity>API = {
  getAll: (params?) => api.get('/<entity>/', { params }),
  getById: (id) => api.get(`/<entity>/${id}/`),
  create: (data) => api.post('/<entity>/', data),
  update/partialUpdate: (id, data) => api.put/patch(...),
  delete: (id) => api.delete(...)
}
```

**Token refresh**: Automatic via axios interceptor (401 → refresh → retry)

### Frontend Conventions

**Component organization**:
- `components/common/` - Reusable UI (Button, Modal, Input, Card, ProtectedRoute)
- `components/layout/` - DashboardLayout, Sidebar, Navbar
- `components/modals/` - Feature-specific modals (AddCourseModal, AllocateCourseModal, etc.)
- `pages/` - Route components (one per route, role-specific dashboards)

**Route protection**: Wrap with `<ProtectedRoute allowedRoles={['ADMIN', 'CONVENER']}>` (see `App.tsx`)

**State management**: React Context for auth (`AuthContext.tsx`), local state for features

**Styling**: Tailwind CSS with custom colors (background: `#F4F7FE`)

## Development Workflows

### Starting the application (PowerShell):
```powershell
# Backend (Terminal 1)
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver  # http://127.0.0.1:8000

# Frontend (Terminal 2)
npm run dev  # http://localhost:5173
```

### Database operations:
```powershell
# In backend/ with venv activated
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser  # Creates ADMIN with CNIC
```

**Reset scripts available**: `reset_database.sql`, `reset_admin_password.py`, `create_test_user.py`

### API documentation:
- Swagger UI: http://127.0.0.1:8000/swagger/
- ReDoc: http://127.0.0.1:8000/redoc/

## Key Technical Details

**Database**: MySQL 8.0 with PyMySQL adapter (config in `.env`)
- Charset: `utf8mb4`, collation: `utf8mb4_unicode_ci`
- Custom table names: `<app>_<model>` (e.g., `courses_course`, `terms_term`)

**CORS**: Enabled via `django-cors-headers` for frontend at localhost:5173

**File uploads**: Profile pictures stored as **base64 in TextField** (not file storage)

**Django app order matters**: `users` MUST be listed before `admin` in `INSTALLED_APPS` for custom user model

**Filtering**: DjangoFilterBackend on ViewSets (filter by FK IDs, search fields, ordering)
- Example: `coursesAPI.getAll({ department: 1, is_active: true })`

## Common Patterns

### Adding new CRUD feature:
1. Backend: Create model → serializer → ViewSet → register router in `urls.py`
2. Add to `backend/<app>/urls.py`: `router.register(r'', MyViewSet)`
3. Frontend: Add API methods to `src/services/api.ts`
4. Create page component, modal (if needed), add route to `App.tsx`

### Role-based features:
- Check `user.role` from `useAuth()` hook
- Dashboard components: `AdminDashboard`, `FacultyDashboard`, `CoordinatorDashboard`, etc.
- Sidebar navigation adapts via `userRole` prop in `DashboardLayout`

### Handling nested data:
- Use separate read (`CourseSerializer`) vs write (`CourseCreateUpdateSerializer`) serializers
- Populate dropdowns: fetch departments/programs on component mount, store in state

## Gotchas & Conventions

1. **CNIC validation**: Must be exactly 13 digits (normalized in backend)
2. **Django migrations**: Custom User model requires `users` app in `INSTALLED_APPS` BEFORE `django.contrib.admin`
3. **Token storage**: Never expose tokens in component props - use localStorage directly or AuthContext
4. **Foreign keys**: Always send numeric IDs in POST/PUT, receive nested objects in GET
5. **Timestamps**: Backend uses `Asia/Karachi` timezone
6. **PowerShell execution policy**: May need `Set-ExecutionPolicy RemoteSigned` for scripts
7. **Course allocations**: Can exist without a term (term FK is nullable)

## Testing & Debugging

**Backend errors**: Check Django console (terminal 1) for stack traces
**Frontend errors**: Browser DevTools console + Network tab (check 401/403/500 responses)
**Auth issues**: Verify tokens in localStorage, check token expiry (1 hour access, 7 days refresh)

## Project Documentation
- See `backend/README.md` for detailed backend setup
- See `PROJECT_README.md` for quick start guide
- Implementation docs: `*_COMPLETE.md` files in root (e.g., `COURSE_MANAGEMENT_COMPLETE.md`)
