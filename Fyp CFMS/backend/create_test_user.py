"""
Quick script to create a test user for login testing
Run: python create_test_user.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import User

def create_test_user():
    """Create a test admin user"""
    print("\n" + "="*60)
    print("CREATE TEST USER")
    print("="*60)
    
    # Check if user already exists
    test_cnic = "1234567890123"
    test_email = "admin@test.com"
    
    user = User.objects.filter(cnic=test_cnic).first()
    
    if user:
        print(f"\nWARNING: User with CNIC {test_cnic} already exists!")
        print(f"   Name: {user.full_name}")
        print(f"   Email: {user.email or 'No email'}")
        print(f"   Active: {user.is_active}")
        
        choice = input("\nDo you want to reset the password? (y/n): ").strip().lower()
        if choice == 'y':
            password = input("Enter new password (min 8 chars): ").strip()
            if len(password) < 8:
                print("❌ Password must be at least 8 characters!")
                return
            user.set_password(password)
            user.is_active = True
            user.save()
            print(f"\nSUCCESS: Password reset! User is now active.")
            print(f"\nLogin credentials:")
            print(f"   CNIC: {user.cnic}")
            print(f"   Email: {user.email}")
            print(f"   Password: {password}")
            return user
        else:
            return user
    else:
        print("\nCreating new test admin user...")
        full_name = input("Enter full name (or press Enter for 'Test Admin'): ").strip() or "Test Admin"
        email = input(f"Enter email (or press Enter for '{test_email}'): ").strip() or test_email
        password = input("Enter password (min 8 chars): ").strip()
        
        if len(password) < 8:
            print("❌ Password must be at least 8 characters!")
            return None
        
        try:
            user = User.objects.create_superuser(
                cnic=test_cnic,
                full_name=full_name,
                email=email,
                password=password
            )
            print(f"\nSUCCESS: User created successfully!")
            print(f"\nLogin credentials:")
            print(f"   CNIC: {user.cnic}")
            print(f"   Email: {user.email}")
            print(f"   Password: {password}")
            print(f"   Role: {user.role}")
            print(f"   Active: {user.is_active}")
            return user
        except Exception as e:
            print(f"\nERROR: Error creating user: {e}")
            return None

def list_all_users():
    """List all users"""
    print("\n" + "="*60)
    print("ALL USERS IN DATABASE")
    print("="*60)
    users = User.objects.all()
    print(f"\nTotal users: {users.count()}\n")
    
    if users.exists():
        print(f"{'ID':<5} {'Name':<30} {'Email':<30} {'CNIC':<15} {'Role':<15} {'Active':<10}")
        print("-" * 105)
        for user in users:
            active_status = "Yes" if user.is_active else "No"
            print(f"{user.id:<5} {user.full_name[:28]:<30} {(user.email or 'No email')[:28]:<30} {user.cnic:<15} {user.role:<15} {active_status:<10}")
    else:
        print("No users found in database!")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'list':
        list_all_users()
    else:
        create_test_user()
        print("\n" + "="*60)
        print("To list all users, run: python create_test_user.py list")
        print("="*60)

