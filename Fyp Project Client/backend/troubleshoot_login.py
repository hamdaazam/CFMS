"""
Troubleshooting script for admin login issues.
Run this script to diagnose and fix login problems.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import User
from django.contrib.auth import authenticate

def check_admin_users():
    """Check if any admin users exist"""
    print("\n" + "="*60)
    print("CHECKING ADMIN USERS")
    print("="*60)
    
    admin_users = User.objects.filter(role='ADMIN')
    superusers = User.objects.filter(is_superuser=True)
    
    print(f"\nTotal users with role='ADMIN': {admin_users.count()}")
    print(f"Total superusers: {superusers.count()}")
    
    if admin_users.exists():
        print("\nAdmin users found:")
        for user in admin_users:
            print(f"  - ID: {user.id}")
            print(f"    Name: {user.full_name}")
            print(f"    Email: {user.email or 'No email'}")
            print(f"    CNIC: {user.cnic}")
            print(f"    is_staff: {user.is_staff}")
            print(f"    is_superuser: {user.is_superuser}")
            print(f"    is_active: {user.is_active}")
            print(f"    Role: {user.role}")
            print()
    else:
        print("\n❌ No admin users found!")
        return False
    
    return True

def test_login(cnic=None, email=None, password=None):
    """Test login with provided credentials"""
    print("\n" + "="*60)
    print("TESTING LOGIN")
    print("="*60)
    
    if not password:
        print("\n⚠️  No password provided. Cannot test login.")
        return False
    
    user = None
    
    # Try CNIC login
    if cnic:
        print(f"\nTrying CNIC login: {cnic}")
        user = authenticate(username=cnic, password=password)
        if user:
            print(f"✅ Login successful with CNIC!")
            print(f"   User: {user.full_name} ({user.email})")
            return True
        else:
            print("❌ CNIC login failed")
    
    # Try email login
    if email:
        print(f"\nTrying email login: {email}")
        try:
            user_obj = User.objects.get(email=email)
            if user_obj.check_password(password):
                print(f"✅ Login successful with email!")
                print(f"   User: {user_obj.full_name} (CNIC: {user_obj.cnic})")
                return True
            else:
                print("❌ Email login failed - password incorrect")
        except User.DoesNotExist:
            print(f"❌ Email login failed - user not found")
    
    return False

def fix_admin_user():
    """Fix or create admin user"""
    print("\n" + "="*60)
    print("FIXING ADMIN USER")
    print("="*60)
    
    # Get first admin user or create one
    admin_user = User.objects.filter(role='ADMIN').first()
    
    if not admin_user:
        print("\nNo admin user found. Creating new admin user...")
        print("\nPlease provide details:")
        cnic = input("CNIC (13 digits): ").strip()
        full_name = input("Full Name: ").strip()
        email = input("Email: ").strip()
        password = input("Password: ").strip()
        
        try:
            admin_user = User.objects.create_superuser(
                cnic=cnic,
                full_name=full_name,
                email=email,
                password=password
            )
            print(f"\n✅ Admin user created successfully!")
            print(f"   CNIC: {admin_user.cnic}")
            print(f"   Email: {admin_user.email}")
            return admin_user
        except Exception as e:
            print(f"\n❌ Error creating admin user: {e}")
            return None
    else:
        print(f"\nFound existing admin user: {admin_user.full_name}")
        print(f"   CNIC: {admin_user.cnic}")
        print(f"   Email: {admin_user.email or 'No email'}")
        
        choice = input("\nDo you want to reset the password? (y/n): ").strip().lower()
        if choice == 'y':
            new_password = input("Enter new password: ").strip()
            admin_user.set_password(new_password)
            admin_user.save()
            print("✅ Password reset successfully!")
            
            # Ensure admin has correct permissions
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.role = 'ADMIN'
            admin_user.is_active = True
            admin_user.save()
            print("✅ Admin permissions verified!")
            
            return admin_user
    
    return admin_user

def main():
    print("\n" + "="*60)
    print("ADMIN LOGIN TROUBLESHOOTER")
    print("="*60)
    
    # Step 1: Check admin users
    has_admin = check_admin_users()
    
    # Step 2: Ask what to do
    print("\n" + "="*60)
    print("OPTIONS")
    print("="*60)
    print("1. Test login with existing credentials")
    print("2. Fix/Create admin user")
    print("3. List all users")
    print("4. Exit")
    
    choice = input("\nEnter choice (1-4): ").strip()
    
    if choice == '1':
        print("\nEnter login credentials:")
        login_method = input("Login with (cnic/email): ").strip().lower()
        identifier = input(f"Enter {login_method}: ").strip()
        password = input("Enter password: ").strip()
        
        if login_method == 'cnic':
            test_login(cnic=identifier, password=password)
        else:
            test_login(email=identifier, password=password)
    
    elif choice == '2':
        admin_user = fix_admin_user()
        if admin_user:
            print(f"\n✅ Admin user ready!")
            print(f"\nYou can now login with:")
            print(f"   CNIC: {admin_user.cnic}")
            if admin_user.email:
                print(f"   Email: {admin_user.email}")
    
    elif choice == '3':
        print("\n" + "="*60)
        print("ALL USERS")
        print("="*60)
        users = User.objects.all()
        print(f"\nTotal users: {users.count()}\n")
        for user in users:
            print(f"ID: {user.id} | {user.full_name} | {user.email or 'No email'} | CNIC: {user.cnic} | Role: {user.role} | Active: {user.is_active}")
    
    elif choice == '4':
        print("\nExiting...")
        return
    
    print("\n" + "="*60)
    print("TROUBLESHOOTING COMPLETE")
    print("="*60)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

