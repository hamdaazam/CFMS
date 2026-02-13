"""
Quick script to check and fix user login issues.
Run: python fix_user_login.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import User

def list_all_users():
    """List all users and their status"""
    print("\n" + "="*80)
    print("ALL USERS IN DATABASE")
    print("="*80)
    users = User.objects.all().order_by('id')
    
    if not users.exists():
        print("\n❌ No users found in database!")
        print("\nTo create users, you can:")
        print("1. Use Django admin: http://127.0.0.1:8000/admin/")
        print("2. Use the register API: POST /api/auth/register/")
        print("3. Use Django shell: python manage.py shell")
        return
    
    print(f"\nTotal users: {users.count()}\n")
    print(f"{'ID':<5} {'Name':<30} {'Email':<30} {'CNIC':<15} {'Role':<15} {'Active':<10}")
    print("-" * 105)
    
    inactive_users = []
    for user in users:
        active_status = "✅ Yes" if user.is_active else "❌ No"
        print(f"{user.id:<5} {user.full_name[:28]:<30} {(user.email or 'No email')[:28]:<30} {user.cnic:<15} {user.role:<15} {active_status:<10}")
        if not user.is_active:
            inactive_users.append(user)
    
    if inactive_users:
        print(f"\n⚠️  Found {len(inactive_users)} inactive user(s). These users cannot login!")
        print("\nTo activate users, run:")
        print("  python manage.py shell")
        print("  >>> from users.models import User")
        print(f"  >>> User.objects.filter(id__in={[u.id for u in inactive_users]}).update(is_active=True)")
    
    print("\n" + "="*80)

def activate_all_users():
    """Activate all users"""
    inactive_count = User.objects.filter(is_active=False).count()
    if inactive_count > 0:
        User.objects.filter(is_active=False).update(is_active=True)
        print(f"\n✅ Activated {inactive_count} user(s)!")
    else:
        print("\n✅ All users are already active!")

def create_test_user():
    """Create a test user for each role"""
    print("\n" + "="*80)
    print("CREATE TEST USERS")
    print("="*80)
    
    test_users = [
        {'cnic': '1234567890123', 'full_name': 'Test Admin', 'email': 'admin@test.com', 'role': 'ADMIN', 'password': 'test1234'},
        {'cnic': '1234567890124', 'full_name': 'Test Faculty', 'email': 'faculty@test.com', 'role': 'FACULTY', 'password': 'test1234'},
        {'cnic': '1234567890125', 'full_name': 'Test Coordinator', 'email': 'coordinator@test.com', 'role': 'COORDINATOR', 'password': 'test1234'},
    ]
    
    created = []
    for user_data in test_users:
        cnic = user_data['cnic']
        if User.objects.filter(cnic=cnic).exists():
            print(f"⚠️  User with CNIC {cnic} already exists, skipping...")
            continue
        
        try:
            if user_data['role'] == 'ADMIN':
                user = User.objects.create_superuser(
                    cnic=cnic,
                    full_name=user_data['full_name'],
                    email=user_data['email'],
                    password=user_data['password']
                )
            else:
                user = User.objects.create_user(
                    cnic=cnic,
                    full_name=user_data['full_name'],
                    email=user_data['email'],
                    role=user_data['role'],
                    password=user_data['password']
                )
            created.append(user)
            print(f"✅ Created {user_data['role']}: {user_data['full_name']} (CNIC: {cnic})")
        except Exception as e:
            print(f"❌ Error creating {user_data['role']}: {e}")
    
    if created:
        print(f"\n✅ Created {len(created)} test user(s)!")
        print("\nLogin credentials:")
        for user in created:
            print(f"  Email: {user.email} | CNIC: {user.cnic} | Password: test1234")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'activate':
            activate_all_users()
        elif command == 'create':
            create_test_user()
        else:
            print(f"Unknown command: {command}")
            print("Usage: python fix_user_login.py [activate|create]")
    else:
        list_all_users()
        print("\n" + "="*80)
        print("QUICK FIXES")
        print("="*80)
        print("\nTo activate all users: python fix_user_login.py activate")
        print("To create test users: python fix_user_login.py create")

