# Term Management - Flow Diagrams

## Business Rule Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TERM ACTIVATION REQUEST                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │ Check: end_date < today?│
                └────────┬───────┬────────┘
                         │       │
                    YES  │       │  NO
                         │       │
                         ▼       ▼
              ┌──────────────┐  ┌─────────────────┐
              │ REJECT       │  │ Proceed         │
              │ ValidationError│  └────────┬────────┘
              └──────────────┘           │
                                          ▼
                            ┌─────────────────────────┐
                            │ Set is_active = True    │
                            └────────────┬────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │ Deactivate ALL other    │
                            │ terms in database       │
                            └────────────┬────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │ Save to database        │
                            └────────────┬────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │ SUCCESS                 │
                            │ Only this term is active│
                            └─────────────────────────┘
```

## Auto-Deactivation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TERM SAVE EVENT                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │ Check: end_date < today?│
                └────────┬───────┬────────┘
                         │       │
                    YES  │       │  NO
                         │       │
                         ▼       ▼
              ┌──────────────┐  ┌─────────────────┐
              │ Force        │  │ Keep original   │
              │ is_active=False│  │ is_active value │
              └──────┬───────┘  └────────┬────────┘
                     │                   │
                     └───────┬───────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Save to DB     │
                    └────────┬───────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ SUCCESS        │
                    └────────────────┘
```

## Daily Scheduled Task Flow

```
┌─────────────────────────────────────────────────────────────────┐
│         CRON/TASK SCHEDULER (Daily at 00:00)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
           ┌─────────────────────────────────────┐
           │ python manage.py                    │
           │ deactivate_expired_terms            │
           └─────────────┬───────────────────────┘
                         │
                         ▼
           ┌─────────────────────────────────────┐
           │ Query: Find all active terms        │
           │ WHERE end_date < today              │
           └─────────────┬───────────────────────┘
                         │
                         ▼
           ┌─────────────────────────────────────┐
           │ Found expired terms?                │
           └────────┬──────────┬─────────────────┘
                    │          │
              YES   │          │ NO
                    │          │
                    ▼          ▼
      ┌──────────────────┐  ┌──────────────────┐
      │ Batch UPDATE     │  │ Log: No expired  │
      │ SET is_active=0  │  │ terms found      │
      │ WHERE id IN (...)│  └──────────────────┘
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │ Log: Deactivated │
      │ N term(s)        │
      └──────────────────┘
```

## State Transition Diagram

```
                    ┌──────────────┐
            ┌───────│   INACTIVE   │◄──────┐
            │       │  (is_active=0)│      │
            │       └──────────────┘       │
            │                              │
            │ Admin activates              │ Auto-deactivate
            │ (if not expired)             │ (end_date < today)
            │                              │
            ▼                              │
      ┌──────────────┐              ┌─────────────┐
      │    ACTIVE    │──────────────►│  EXPIRED    │
      │ (is_active=1)│   Time passes │ (automatic) │
      └──────┬───────┘   end_date    └─────────────┘
             │           reached
             │
             │ Another term activated
             │ (single active rule)
             │
             ▼
      ┌──────────────┐
      │   INACTIVE   │
      │ (deactivated)│
      └──────────────┘
```

## API Call Flow

### Frontend → Backend → Database

```
┌─────────────────┐
│   FRONTEND      │
│  (React App)    │
└────────┬────────┘
         │ POST /api/terms/5/activate/
         │
         ▼
┌─────────────────┐
│   API Layer     │
│  (Django REST)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ TermViewSet     │
│ .activate()     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validation      │
│ (check expired) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Term Model      │
│ .save()         │
└────────┬────────┘
         │
         │ 1. Deactivate others
         │ 2. Save current
         │
         ▼
┌─────────────────┐
│   MySQL DB      │
│ (transactions)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response 200 OK │
│ { term data }   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FRONTEND       │
│ (Update UI)     │
└─────────────────┘
```

## Validation Layers

```
╔════════════════════════════════════════════════════════╗
║                  REQUEST RECEIVED                      ║
╚════════════════════════════════════════════════════════╝
                         │
                         ▼
         ┌───────────────────────────────┐
         │  Layer 1: Serializer          │
         │  - validate()                 │
         │  - Check date formats         │
         │  - Check end_date > start_date│
         │  - Check 90-day minimum       │
         │  - Check past activation      │
         └───────────┬───────────────────┘
                     │ PASS
                     ▼
         ┌───────────────────────────────┐
         │  Layer 2: Model (clean)       │
         │  - Additional validation      │
         │  - Business rule checks       │
         └───────────┬───────────────────┘
                     │ PASS
                     ▼
         ┌───────────────────────────────┐
         │  Layer 3: Model (save)        │
         │  - Enforce single active      │
         │  - Auto-deactivate expired    │
         │  - Database operations        │
         └───────────┬───────────────────┘
                     │ SUCCESS
                     ▼
         ┌───────────────────────────────┐
         │  Response: 200 OK             │
         └───────────────────────────────┘

         ANY LAYER FAILS
              │
              ▼
         ┌───────────────────────────────┐
         │  Response: 400 Bad Request    │
         │  { error: "..." }             │
         └───────────────────────────────┘
```

## Daily Maintenance Schedule

```
┌──────────────────────────────────────────────────────────┐
│                    24-Hour Cycle                         │
└──────────────────────────────────────────────────────────┘

00:00 ────► Scheduled Task Runs
            │
            ▼
         ┌──────────────────────┐
         │ deactivate_expired   │
         │ management command   │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Check all terms      │
         │ Deactivate expired   │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Log results          │
         └──────────────────────┘

01:00 to 23:59 ─► Normal Operations
                  │
                  ├─► User creates/updates terms
                  │   └─► Validation enforced
                  │
                  ├─► User activates terms
                  │   └─► Single active enforced
                  │
                  └─► Terms saved
                      └─► Auto-deactivate if expired

00:00 (next day) ─► Cycle repeats
```

## Error Handling

```
┌─────────────────────────────────────────┐
│         Error Scenarios                 │
└─────────────────────────────────────────┘

Scenario 1: Activate Past Term
├─ Input: term.end_date = 2024-01-01 (past)
├─ Input: term.is_active = True
├─ Action: term.save()
└─ Result: ❌ ValidationError
           "Cannot activate a term whose end date has already passed."

Scenario 2: Multiple Active Terms
├─ Input: term1.is_active = True (already saved)
├─ Input: term2.is_active = True
├─ Action: term2.save()
└─ Result: ✅ term2 active, term1 automatically inactive

Scenario 3: Update Expired Term
├─ Input: term.end_date = yesterday
├─ Input: term.is_active = True (trying to set)
├─ Action: term.save()
└─ Result: ❌ ValidationError
           "Cannot activate a term whose end date has already passed."

Scenario 4: Normal Update
├─ Input: term.session_term = "New Name"
├─ Input: term.is_active = unchanged
├─ Action: term.save()
└─ Result: ✅ Updated successfully
           (auto-deactivates if expired)
```
