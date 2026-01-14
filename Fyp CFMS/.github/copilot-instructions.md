# CFMS (Course Folder Management System) - AI Agent Instructions

## System Architecture

**Full-stack application**: React 19 + TypeScript frontend with Django 5.2 REST backend, MySQL 8.0 database.

### Project Structure
```
src/                    # React frontend (Vite, port 5173)
├── components/         # Reusable UI components
│   ├── common/        # Button, Modal, Input, Card, ProtectedRoute
│   ├── layout/        # DashboardLayout, Sidebar, Navbar
│   └── modals/        # Feature-specific modals
├── pages/             # Route components (one per route)
├── services/api.ts    # Centralized axios API client
├── context/           # React Context (AuthContext)
└── hooks/             # useReviewMode (coordinator/audit review detection)

backend/               # Django REST API (port 8000)
├── users/            # Custom User model (CNIC authentication)
├── course_folders/   # Core: CourseFolder, Assessment, CourseLogEntry, AuditAssignment
├── courses/          # Course, CourseAllocation, CourseCoordinatorAssignment
├── departments/      # Department model
├── programs/         # Program model
├── terms/            # Term (academic sessions)
└── faculty/          # Faculty profile (FK to User)
```

## Critical Knowledge

### Authentication & User Model
**CNIC-based authentication** (13-digit Pakistani ID) instead of email/username:
- Login: `cnic` (13 digits) + `password` → JWT tokens
- Custom User model: `backend/users/models.py` with `AUTH_USER_MODEL = 'users.User'`
- JWT tokens in localStorage: `access_token`, `refresh_token`, `user` (JSON object)
- **Role hierarchy**: ADMIN > HOD > CONVENER (dept) > COORDINATOR (program) > FACULTY > AUDIT_TEAM/AUDIT_MEMBER/EVALUATOR
- **All roles**: ADMIN, HOD, CONVENER, COORDINATOR, FACULTY, AUDIT_TEAM, AUDIT_MEMBER, EVALUATOR, SUPERVISOR, STUDENT
- **Role-based routing**: Read `user.role` from AuthContext, use `<ProtectedRoute allowedRoles={[...]}>`

### Course Folder Workflow (11-Stage State Machine)
**STATUS_CHOICES** in `course_folders/models.py` defines the folder lifecycle:
```
DRAFT → SUBMITTED → APPROVED_COORDINATOR → UNDER_AUDIT → AUDIT_COMPLETED 
   ↓         ↓              ↓                      ↓           ↓
REJECTED_* ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←  ← ← ← ← ← ←
   ↓
SUBMITTED_TO_HOD → APPROVED_BY_HOD (final)
   ↓
REJECTED_BY_HOD
```

**Key transitions** (enforced in `course_folders/views.py`):
1. **Faculty**: `DRAFT` → `SUBMITTED` (must pass `check_completeness()` or use `skip_validation=1`)
2. **Coordinator**: `SUBMITTED` → `APPROVED_COORDINATOR` / `REJECTED_COORDINATOR`
3. **Convener**: `APPROVED_COORDINATOR` → `UNDER_AUDIT` (assigns audit team)
4. **Auditors**: Submit reports → `AUDIT_COMPLETED` (when all submitted OR any rejected)
5. **Convener**: `AUDIT_COMPLETED` → `SUBMITTED_TO_HOD` / `REJECTED_BY_CONVENER`
6. **HOD**: `SUBMITTED_TO_HOD` → `APPROVED_BY_HOD` / `REJECTED_BY_HOD`

**Rejection loops**: Folders return to DRAFT on rejection, faculty resubmits

### Data Model Relationships
```
CourseFolder (central entity)
├── course_allocation (FK) → CourseAllocation → Course
├── faculty (FK) → Faculty → User
├── term (FK) → Term
├── department (FK) → Department
├── program (FK) → Program
├── outline_content (JSONField) - stores all form data (assignments, quizzes, logs)
├── components (1:N) → FolderComponent (PDFs: course outline, attendance, etc.)
├── assessments (1:N) → Assessment (question papers, solutions, sample scripts)
├── log_entries (1:N) → CourseLogEntry (lecture records)
└── audit_assignments (1:N) → AuditAssignment (auditor reports with ratings)
```

**Critical constraints**:
- Users MUST exist before Faculty records (Faculty.user FK)
- CourseFolder has `unique_together = [['course_allocation', 'term']]`
- Custom User model requires `users` app BEFORE `django.contrib.admin` in INSTALLED_APPS

### Hybrid Data Storage (Database + JSONField)
**CourseFolder uses two parallel storage strategies**:
1. **Database tables**: `Assessment`, `CourseLogEntry`, `FolderComponent` (legacy/backup)
2. **JSONField** (`outline_content`): Primary source for frontend (assignments, quizzes, logs)

**Why this matters**: Pages like `FolderQuizzes.tsx` read from `outline_content.quizzes`, NOT `assessments` table. To update:
```typescript
// Save to JSONField (preferred)
await courseFolderAPI.saveOutline(folderId, {
  outline_content: { quizzes: updatedQuizzes },
  section: 'quizzes'  // Optional: only update this key
});
```

**Backend merge logic** (`save-outline` action in views.py):
- `section` param → updates single top-level key
- No `section` → deep merge (dicts merged, lists/scalars replaced)
- Auto-creates snapshots (`OutlineContentSnapshot`) before changes

### API Patterns

**Backend (Django REST)**: All apps use `ModelViewSet` with DRF routers
- Endpoints: `/api/<app>/` (list/create), `/api/<app>/<id>/` (retrieve/update/delete)
- **Custom actions** (use `@action` decorator):
  - `/api/course-folders/{id}/submit/` - Faculty submits folder
  - `/api/course-folders/{id}/coordinator_review/` - Coordinator approves/rejects
  - `/api/course-folders/{id}/assign_audit/` - Convener assigns auditors
  - `/api/course-folders/{id}/save-outline/` - Save JSONField outline_content
  - `/api/course-folders/{id}/basic/` - Fast endpoint (no nested serializers)

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
**In-memory cache**: 5-second TTL for GET requests (see `apiCache` in api.ts)

### Frontend Conventions

**Component organization**:
- `components/common/` - Reusable UI (Button, Modal, Input, Card, ProtectedRoute)
- `components/layout/` - DashboardLayout, Sidebar, Navbar
- `components/modals/` - Feature-specific modals (AddCourseModal, AllocateCourseModal, etc.)
- `pages/` - Route components (one per route, role-specific dashboards)

**Route protection**: Wrap with `<ProtectedRoute allowedRoles={['ADMIN', 'CONVENER']}>` (see `App.tsx`)

**Review mode detection**: Use `useReviewMode()` hook to detect coordinator/auditor read-only views
```typescript
const { isCoordinatorReview, isAuditMemberReview, basePath } = useReviewMode();
// basePath: '/faculty' | '/coordinator' | '/audit-member'
```

**State management**: React Context for auth (`AuthContext.tsx`), local state for features

**Styling**: Tailwind CSS with custom colors (background color: `#F4F7FE`)

## Development Workflows

### Starting the application (PowerShell):
```powershell
# Backend (Terminal 1)
cd backend
.\venv\Scripts\Activate.ps1  # Virtual environment: myenv/
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

