# Terms App - Academic Term Management

## Overview

The Terms app manages academic terms (semesters/sessions) in the CFMS (Course Folder Management System). It enforces critical business rules to ensure data integrity and proper term lifecycle management.

## 🎯 Business Rules

### 1. Single Active Term
Only one term can be active at any given time. When a term is activated, all other terms are automatically deactivated.

### 2. Past Term Prevention
Terms whose end date has already passed cannot be marked as active. This prevents accidental activation of expired terms.

### 3. Automatic Deactivation
Terms are automatically deactivated when their end date passes. This can happen:
- On save: When any term is saved, expired terms are auto-deactivated
- Via scheduled task: Daily job that deactivates all expired terms

## 📁 Files

```
terms/
├── models.py                    # Term model with business logic
├── serializers.py               # API serializers with validation
├── views.py                     # API endpoints (ViewSet)
├── urls.py                      # Route configuration
├── admin.py                     # Django admin configuration
├── apps.py                      # App configuration
├── tests.py                     # Unit tests
├── management/
│   └── commands/
│       └── deactivate_expired_terms.py  # Daily maintenance command
├── migrations/                  # Database migrations
├── README.md                    # This file
├── TERM_MANAGEMENT_GUIDE.md     # Complete implementation guide
├── TERM_MANAGEMENT_FLOWS.md     # Visual flow diagrams
└── QUICK_REFERENCE.md           # Quick reference card
```

## 🚀 Quick Start

### 1. Run Migrations
```bash
cd backend
python manage.py makemigrations terms
python manage.py migrate
```

### 2. Create a Term
```bash
python manage.py shell
```
```python
from terms.models import Term
from django.utils import timezone
from datetime import timedelta

today = timezone.now().date()
term = Term.objects.create(
    session_term="Fall 2024",
    start_date=today,
    end_date=today + timedelta(days=120),
    is_active=True
)
```

### 3. Set Up Scheduled Task

**Windows:**
```powershell
# Run as Administrator
cd backend
.\setup_scheduled_task.ps1
```

**Linux/Mac:**
```bash
# Add to crontab
crontab -e
# Add line:
0 0 * * * cd /path/to/backend && python manage.py deactivate_expired_terms
```

## 📡 API Endpoints

### Standard CRUD
- `GET /api/terms/` - List all terms
- `GET /api/terms/?is_active=true` - Filter active terms
- `GET /api/terms/{id}/` - Get single term
- `POST /api/terms/` - Create term
- `PUT /api/terms/{id}/` - Update term
- `PATCH /api/terms/{id}/` - Partial update
- `DELETE /api/terms/{id}/` - Delete term

### Custom Actions
- `POST /api/terms/{id}/activate/` - Activate term (deactivates others)
- `POST /api/terms/deactivate_expired/` - Manual cleanup (admin only)

## 💾 Database Schema

```sql
CREATE TABLE terms_term (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    session_term VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

### Constraints
- `session_term` must be unique
- `end_date` must be after `start_date`
- Minimum duration: 90 days
- Cannot activate if `end_date < today`

## 🔧 Model Features

### Properties

#### `is_expired`
Returns `True` if the term's end date has passed.
```python
term = Term.objects.get(id=1)
if term.is_expired:
    print("This term has ended")
```

#### `days_until_expiry`
Returns the number of days until the term expires (negative if already expired).
```python
term = Term.objects.get(id=1)
print(f"Expires in {term.days_until_expiry} days")
```

### Class Methods

#### `deactivate_expired_terms()`
Deactivate all terms with past end dates. Returns count of deactivated terms.
```python
count = Term.deactivate_expired_terms()
print(f"Deactivated {count} term(s)")
```

## 🛠️ Management Commands

### Deactivate Expired Terms

**Dry run (preview):**
```bash
python manage.py deactivate_expired_terms --dry-run
```

**Execute:**
```bash
python manage.py deactivate_expired_terms
```

### Output Example
```
Found 2 expired term(s):
  - Spring 2023 (ended 250 day(s) ago on 2024-03-31)
  - Summer 2023 (ended 180 day(s) ago on 2024-06-15)

✓ Successfully deactivated 2 expired term(s).
```

## 🧪 Testing

### Run Test Suite
```bash
cd backend
python test_term_management.py
```

### Manual Testing
```bash
python manage.py shell
```
```python
from terms.models import Term
from django.utils import timezone
from datetime import timedelta

# Test 1: Single active term
term1 = Term.objects.create(session_term="Test 1", start_date=timezone.now().date(), end_date=timezone.now().date() + timedelta(days=100), is_active=True)
term2 = Term.objects.create(session_term="Test 2", start_date=timezone.now().date(), end_date=timezone.now().date() + timedelta(days=100), is_active=True)
term1.refresh_from_db()
assert term1.is_active == False  # Should be deactivated
assert term2.is_active == True   # Should be active

# Cleanup
term1.delete()
term2.delete()
```

## 📚 Documentation

For detailed information, see:

1. **[TERM_MANAGEMENT_GUIDE.md](./TERM_MANAGEMENT_GUIDE.md)** - Complete implementation guide with:
   - Detailed business rules
   - API documentation with examples
   - Frontend integration guide
   - Troubleshooting section

2. **[TERM_MANAGEMENT_FLOWS.md](./TERM_MANAGEMENT_FLOWS.md)** - Visual diagrams showing:
   - Business rule flow
   - Auto-deactivation flow
   - Daily scheduled task flow
   - State transition diagram
   - API call flow

3. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference card with:
   - API endpoint summary
   - Code snippets
   - Common errors and fixes
   - Command reference

## 🔍 Common Issues

### Issue: Multiple Active Terms
**Cause:** Data inconsistency or manual database edit
**Solution:**
```bash
python manage.py deactivate_expired_terms
# Then manually activate the correct term
```

### Issue: Cannot Activate Valid Future Term
**Cause:** Another term is already active
**Solution:** Deactivate the current active term first, then activate the desired term

### Issue: Auto-deactivation Not Working
**Cause:** Scheduled task not set up or not running
**Solution:**
1. Check if scheduled task exists
2. Run manual deactivation: `python manage.py deactivate_expired_terms`
3. Re-run setup script: `.\setup_scheduled_task.ps1`

## 🔐 Permissions

- **List/Read:** All authenticated users
- **Create/Update/Delete:** Admin users (default DRF permissions)
- **Activate:** All authenticated users
- **Deactivate Expired:** Admin users only

## 📊 Validation Layers

The system validates data at three levels:

1. **Serializer Layer** - Format validation, date checks
2. **Model clean() Method** - Business rule validation
3. **Model save() Method** - Enforcement and auto-fixes

This multi-layer approach ensures data integrity at all times.

## 🔄 Integration

### With Course Folders
Terms are linked to course folders via foreign key:
```python
course_folder = CourseFolder.objects.get(id=1)
term = course_folder.term
if term.is_active:
    print("This folder is from the current term")
```

### With Course Allocations
Course allocations can reference terms:
```python
from courses.models import CourseAllocation
allocations = CourseAllocation.objects.filter(term=term)
```

## 📈 Future Enhancements

Potential future features:
- [ ] Email notifications when term is about to expire
- [ ] Bulk term creation (import from CSV)
- [ ] Term templates (reuse settings from previous terms)
- [ ] Academic calendar integration
- [ ] Term overlap detection and warnings

## 📞 Support

For issues or questions:
1. Check the documentation files in this directory
2. Run the test suite to verify functionality
3. Check Django admin for data inspection
4. Review scheduled task logs in Task Scheduler

## 📝 Change Log

### Version 1.0 (December 8, 2024)
- ✅ Implemented single active term enforcement
- ✅ Added past term activation prevention
- ✅ Implemented automatic deactivation on expiry
- ✅ Created management command for scheduled cleanup
- ✅ Added comprehensive documentation
- ✅ Added test suite
- ✅ Added setup scripts for scheduled tasks

---

**Status:** ✅ Production Ready  
**Last Updated:** December 8, 2024  
**Maintained By:** CFMS Development Team
