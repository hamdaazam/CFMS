# Term Management - Quick Reference

## 🎯 Business Rules

| Rule | Enforcement | Error Message |
|------|-------------|---------------|
| Only 1 active term | Automatic on save | None (other terms deactivated silently) |
| No past term activation | ValidationError raised | "Cannot activate a term whose end date has already passed." |
| Auto-deactivate expired | On save + scheduled task | None (automatic) |

## 🔌 API Endpoints

### Standard CRUD
```http
GET    /api/terms/              # List all terms
GET    /api/terms/?is_active=true    # Filter by status
GET    /api/terms/{id}/         # Get single term
POST   /api/terms/              # Create term
PUT    /api/terms/{id}/         # Update term
PATCH  /api/terms/{id}/         # Partial update
DELETE /api/terms/{id}/         # Delete term
```

### Custom Actions
```http
POST   /api/terms/{id}/activate/      # Activate term (deactivates others)
POST   /api/terms/deactivate_expired/ # Manual cleanup (admin only)
```

## 📊 Response Fields

```json
{
  "id": 1,
  "session_term": "Fall 2024",
  "start_date": "2024-09-01",
  "end_date": "2024-12-31",
  "is_active": true,
  "is_expired": false,           // NEW: Calculated field
  "days_until_expiry": 23,       // NEW: Calculated field
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-12-08T14:20:00Z"
}
```

## 💻 Frontend Usage

### Import API
```typescript
import { termsAPI } from '@/services/api';
```

### Get Active Term
```typescript
const response = await termsAPI.getAll({ is_active: true });
const activeTerm = response.data[0];
```

### Activate a Term
```typescript
try {
  const response = await termsAPI.activate(termId);
  console.log(response.data.message);
  // "Term \"Fall 2024\" activated successfully"
} catch (error) {
  console.error(error.response.data.error);
}
```

### Check Expiration
```typescript
const term = response.data;
if (term.is_expired) {
  alert('This term has expired');
}
if (term.days_until_expiry <= 7 && term.days_until_expiry > 0) {
  alert(`Term expires in ${term.days_until_expiry} days`);
}
```

## 🛠️ Management Commands

### Check Expired Terms (Dry Run)
```bash
cd backend
python manage.py deactivate_expired_terms --dry-run
```

### Deactivate Expired Terms
```bash
python manage.py deactivate_expired_terms
```

### Schedule Daily Task

**Windows (PowerShell - Run as Admin):**
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "D:\Fyp Project Client\backend\venv\Scripts\python.exe" -Argument "manage.py deactivate_expired_terms" -WorkingDirectory "D:\Fyp Project Client\backend"
$trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
Register-ScheduledTask -TaskName "CFMS-DeactivateExpiredTerms" -Action $action -Trigger $trigger -Description "Daily task to deactivate expired academic terms"
```

**Linux/Mac (Crontab):**
```bash
# Edit crontab
crontab -e

# Add line (runs daily at midnight):
0 0 * * * cd /path/to/backend && /path/to/venv/bin/python manage.py deactivate_expired_terms
```

## 🐍 Python Usage

### Check if Term is Expired
```python
from terms.models import Term

term = Term.objects.get(id=1)
if term.is_expired:
    print(f"Expired {abs(term.days_until_expiry)} days ago")
```

### Get Active Term
```python
active_term = Term.objects.filter(is_active=True).first()
```

### Deactivate Expired Terms
```python
count = Term.deactivate_expired_terms()
print(f"Deactivated {count} term(s)")
```

### Create Term (Safe)
```python
from django.utils import timezone
from datetime import timedelta

today = timezone.now().date()

term = Term.objects.create(
    session_term="Fall 2024",
    start_date=today,
    end_date=today + timedelta(days=120),
    is_active=True  # Will deactivate all other terms
)
```

## ⚠️ Common Errors

### Error 1: Cannot Activate Past Term
**Message:** `Cannot activate a term whose end date has already passed.`

**Fix:**
```python
# Check end date before activating
from django.utils import timezone
if term.end_date >= timezone.now().date():
    term.is_active = True
    term.save()
```

### Error 2: End Date Before Start Date
**Message:** `End date must be after start date.`

**Fix:**
```python
# Ensure proper date order
term.start_date = date(2024, 9, 1)
term.end_date = date(2024, 12, 31)  # Must be after start
```

### Error 3: Term Too Short
**Message:** `Term duration must be at least 90 days.`

**Fix:**
```python
from datetime import timedelta
term.start_date = date(2024, 9, 1)
term.end_date = term.start_date + timedelta(days=90)  # Minimum
```

## 🧪 Testing

### Run Test Suite
```bash
cd backend
python test_term_management.py
```

### Manual Testing Checklist
- [ ] Create two terms, activate second → first deactivates
- [ ] Try to activate past term → validation error
- [ ] Update expired term → auto-deactivates
- [ ] Run management command → expired terms deactivated

## 📁 File Locations

```
backend/
├── terms/
│   ├── models.py              # Core business logic
│   ├── serializers.py         # Validation + API fields
│   ├── views.py               # API endpoints
│   ├── urls.py                # Route configuration
│   ├── management/
│   │   └── commands/
│   │       └── deactivate_expired_terms.py  # Daily task
│   ├── TERM_MANAGEMENT_GUIDE.md        # Full documentation
│   └── TERM_MANAGEMENT_FLOWS.md        # Visual diagrams
├── test_term_management.py    # Test suite
└── TERM_MANAGEMENT_IMPLEMENTATION_SUMMARY.md  # Implementation summary

frontend/
└── src/
    └── services/
        └── api.ts             # API client (termsAPI)
```

## 🔍 Debugging

### Check Current Active Terms
```bash
cd backend
python manage.py shell
```
```python
from terms.models import Term
active = Term.objects.filter(is_active=True)
print(f"Active terms: {active.count()}")
for term in active:
    print(f"- {term.session_term} (expires in {term.days_until_expiry} days)")
```

### Force Deactivate All
```python
from terms.models import Term
Term.objects.update(is_active=False)
```

### Check Expired Terms
```python
from django.utils import timezone
expired = Term.objects.filter(end_date__lt=timezone.now().date())
print(f"Expired terms: {expired.count()}")
```

## 📞 Support

**Issue:** Multiple active terms exist
**Solution:** Run `python manage.py deactivate_expired_terms` and manually deactivate extras

**Issue:** Cannot activate valid future term
**Solution:** Check if another term is active first, deactivate it manually

**Issue:** Auto-deactivation not working
**Solution:** Verify scheduled task is running, check logs

---

**Version:** 1.0  
**Last Updated:** December 8, 2024  
**Status:** ✅ Production Ready
