"""
Activate all users in the database so they can login
Run: python activate_all_users.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import User

def activate_all_users():
    """Activate all users in the database"""
    print("\n" + "="*60)
    print("ACTIVATING ALL USERS")
    print("="*60)
    
    inactive_users = User.objects.filter(is_active=False)
    total_users = User.objects.count()
    
    print(f"\nTotal users in database: {total_users}")
    print(f"Inactive users: {inactive_users.count()}")
    
    if inactive_users.exists():
        inactive_users.update(is_active=True)
        print(f"\nSUCCESS: Activated {inactive_users.count()} user(s)!")
    else:
        print("\nAll users are already active!")
    
    print("\n" + "="*60)
    print("ALL USERS STATUS")
    print("="*60)
    users = User.objects.all().order_by('id')
    print(f"\n{'ID':<5} {'Name':<30} {'Email':<25} {'CNIC':<15} {'Role':<15} {'Active':<10}")
    print("-" * 100)
    
    for user in users:
        email_display = (user.email or 'No email')[:24]
        active_status = "Yes" if user.is_active else "No"
        print(f"{user.id:<5} {user.full_name[:29]:<30} {email_display:<25} {user.cnic:<15} {user.role:<15} {active_status:<10}")
    
    print("\n" + "="*60)
    print("Users can now login with:")
    print("- Email + Password")
    print("- CNIC + Password")
    print("="*60)

if __name__ == '__main__':
    activate_all_users()

