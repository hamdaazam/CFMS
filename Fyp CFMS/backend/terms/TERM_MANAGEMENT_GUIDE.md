# Term Management - Implementation Guide

## Overview
This document describes the enhanced term management system that enforces business rules for academic terms.

## Business Rules Implemented

### 1. Single Active Term
- **Rule**: Only one term can be marked as active at any given time
- **Implementation**: When a term is activated, all other terms are automatically deactivated
- **Location**: `terms/models.py` - `Term.save()` method

### 2. Past Terms Cannot Be Activated
- **Rule**: Terms with end dates in the past cannot be marked as active
- **Implementation**: Validation in both model and serializer layers
- **Location**: 
  - `terms/models.py` - `Term.clean()` and `Term.save()` methods
  - `terms/serializers.py` - `TermSerializer.validate()` method

### 3. Automatic Deactivation
- **Rule**: Terms are automatically deactivated when their end date passes
- **Implementation**: 
  - On save: Terms with past end dates are auto-deactivated
  - Scheduled task: Management command to run daily
- **Location**: 
  - `terms/models.py` - `Term.save()` method
  - `terms/management/commands/deactivate_expired_terms.py`

## API Changes

### New Endpoints

#### 1. Activate a Specific Term
```http
POST /api/terms/{id}/activate/
```

**Response (Success)**:
```json
{
  "message": "Term \"Fall 2024\" activated successfully",
  "term": {
    "id": 1,
    "session_term": "Fall 2024",
    "start_date": "2024-09-01",
    "end_date": "2024-12-31",
    "is_active": true,
    "is_expired": false,
    "days_until_expiry": 23,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-12-08T14:20:00Z"
  }
}
```

**Response (Error - Past Term)**:
```json
{
  "error": "Cannot activate a term whose end date has already passed."
}
```

#### 2. Deactivate Expired Terms (Admin Only)
```http
POST /api/terms/deactivate_expired/
```

**Response**:
```json
{
  "message": "Deactivated 2 expired term(s)",
  "deactivated_count": 2
}
```

### Updated Response Fields

All term responses now include:
- `is_expired` (boolean): Whether the term's end date has passed
- `days_until_expiry` (integer): Days until expiry (negative if expired)

**Example**:
```json
{
  "id": 1,
  "session_term": "Fall 2024",
  "start_date": "2024-09-01",
  "end_date": "2024-12-31",
  "is_active": true,
  "is_expired": false,
  "days_until_expiry": 23,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-12-08T14:20:00Z"
}
```

### Query Parameters

Filter terms by active status:
```http
GET /api/terms/?is_active=true   # Get only active terms
GET /api/terms/?is_active=false  # Get only inactive terms
GET /api/terms/                  # Get all terms
```

## Management Command

### Deactivate Expired Terms

Run this command daily via a scheduled task to automatically deactivate expired terms.

#### Usage

**Dry Run** (preview without making changes):
```bash
python manage.py deactivate_expired_terms --dry-run
```

**Execute** (actually deactivate expired terms):
```bash
python manage.py deactivate_expired_terms
```

#### Output Examples

**No expired terms**:
```
No expired terms found.
```

**Expired terms found (dry run)**:
```
Found 2 expired term(s):
  - Spring 2023 (ended 250 day(s) ago on 2024-03-31)
  - Summer 2023 (ended 180 day(s) ago on 2024-06-15)

[DRY RUN] No changes made. Remove --dry-run to deactivate these terms.
```

**Successfully deactivated**:
```
Found 2 expired term(s):
  - Spring 2023 (ended 250 day(s) ago on 2024-03-31)
  - Summer 2023 (ended 180 day(s) ago on 2024-06-15)

✓ Successfully deactivated 2 expired term(s).
```

### Setting Up Scheduled Execution

#### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at midnight (00:00)
4. Action: Start a program
   - Program: `python`
   - Arguments: `manage.py deactivate_expired_terms`
   - Start in: `D:\Fyp Project Client\backend`

#### Linux/Mac (Cron)

Add to crontab:
```bash
0 0 * * * cd /path/to/backend && /path/to/venv/bin/python manage.py deactivate_expired_terms
```

## Model Methods

### Instance Methods

#### `is_expired` (property)
Returns whether the term has expired.
```python
term = Term.objects.get(id=1)
if term.is_expired:
    print("This term has ended")
```

#### `days_until_expiry` (property)
Returns days until term expires (negative if expired).
```python
term = Term.objects.get(id=1)
print(f"Days until expiry: {term.days_until_expiry}")
```

### Class Methods

#### `deactivate_expired_terms()`
Deactivate all terms with past end dates.
```python
from terms.models import Term

# Returns count of deactivated terms
count = Term.deactivate_expired_terms()
print(f"Deactivated {count} term(s)")
```

## Validation Rules

### Creating/Updating Terms

1. **End date must be after start date**
   ```json
   {"error": "End date must be after start date."}
   ```

2. **Minimum duration: 90 days**
   ```json
   {"error": "Term duration must be at least 90 days."}
   ```

3. **Cannot activate past terms**
   ```json
   {
     "is_active": ["Cannot activate a term whose end date has already passed."]
   }
   ```

4. **Only one active term**
   - Automatically enforced (other terms deactivated)

## Frontend Integration

### Checking Term Status

```typescript
import { termsAPI } from '@/services/api';

// Get active term
const activeTerms = await termsAPI.getAll({ is_active: true });
if (activeTerms.data.length > 0) {
  const activeTerm = activeTerms.data[0];
  
  if (activeTerm.is_expired) {
    console.warn('Active term has expired!');
  }
  
  if (activeTerm.days_until_expiry <= 7) {
    console.warn(`Term expires in ${activeTerm.days_until_expiry} days`);
  }
}
```

### Activating a Term

```typescript
import { termsAPI } from '@/services/api';

try {
  const response = await termsAPI.activate(termId);
  console.log(response.data.message);
  // "Term \"Fall 2024\" activated successfully"
} catch (error) {
  console.error(error.response.data.error);
  // "Cannot activate a term whose end date has already passed."
}
```

### Creating API Method

Add to `src/services/api.ts`:
```typescript
export const termsAPI = {
  // ... existing methods ...
  
  activate: (id: number) => 
    api.post(`/terms/${id}/activate/`),
  
  deactivateExpired: () => 
    api.post('/terms/deactivate_expired/'),
};
```

## Testing

### Manual Testing

1. **Test single active term**:
   ```bash
   # Create two terms
   # Activate term 1
   # Activate term 2
   # Verify term 1 is now inactive
   ```

2. **Test past term prevention**:
   ```bash
   # Create term with end_date in the past
   # Try to activate it
   # Verify error message
   ```

3. **Test auto-deactivation**:
   ```bash
   # Create term with end_date yesterday
   # Save/update the term
   # Verify it's automatically inactive
   ```

4. **Test management command**:
   ```bash
   python manage.py deactivate_expired_terms --dry-run
   python manage.py deactivate_expired_terms
   ```

## Migration Notes

- No database schema changes were required
- All changes are in business logic (Python code)
- No migration files needed
- Existing data is unaffected
- Validation will apply to all future create/update operations

## Troubleshooting

### Issue: Multiple active terms exist
**Solution**: Run management command to deactivate expired terms:
```bash
python manage.py deactivate_expired_terms
```

### Issue: Cannot activate a valid future term
**Check**: Ensure end_date is not in the past
**Check**: Verify timezone settings in Django settings

### Issue: Auto-deactivation not working
**Check**: Verify timezone configuration
**Check**: Ensure management command is scheduled properly
**Run**: Manual deactivation command

## Architecture

```
Term Model (models.py)
├── Validation (clean method)
│   └── Prevents activating past terms
├── Save Override
│   ├── Auto-deactivates expired terms
│   └── Enforces single active term
├── Properties
│   ├── is_expired
│   └── days_until_expiry
└── Class Methods
    └── deactivate_expired_terms()

TermSerializer (serializers.py)
├── Additional Fields
│   ├── is_expired (read-only)
│   └── days_until_expiry (read-only)
└── Validation
    └── Prevents activating past terms

TermViewSet (views.py)
├── Custom Actions
│   ├── activate (POST /{id}/activate/)
│   └── deactivate_expired (POST /deactivate_expired/)
└── Query Filtering
    └── ?is_active=true/false

Management Command
└── deactivate_expired_terms
    ├── --dry-run flag
    └── Daily scheduled execution
```

## Summary

The enhanced term management system ensures data integrity by:

1. ✅ Enforcing single active term constraint
2. ✅ Preventing activation of past terms
3. ✅ Automatically deactivating expired terms
4. ✅ Providing admin tools for maintenance
5. ✅ Adding helpful API endpoints and properties
6. ✅ Maintaining backward compatibility

All business rules are enforced at multiple layers (model, serializer, view) for robust validation.
