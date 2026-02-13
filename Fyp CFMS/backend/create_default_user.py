"""
Create a default admin user for testing
Run: python create_default_user.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import User

def create_default_user():
    """Create a default admin user"""
    print("\n" + "="*60)
    print("CREATING DEFAULT ADMIN USER")
    print("="*60)
    
    # Default credentials
    cnic = "1234567890123"
    email = "admin@test.com"
    full_name = "Admin User"
    password = "admin1234"
    
    # Check if user exists
    user = User.objects.filter(cnic=cnic).first()
    
    if user:
        print(f"\nUser already exists!")
        print(f"   CNIC: {user.cnic}")
        print(f"   Email: {user.email or 'No email'}")
        print(f"   Active: {user.is_active}")
        
        # Reset password and activate
        user.set_password(password)
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.role = 'ADMIN'
        user.save()
        
        print(f"\nPassword reset and user activated!")
    else:
        print(f"\nCreating new admin user...")
        try:
            user = User.objects.create_superuser(
                cnic=cnic,
                full_name=full_name,
                email=email,
                password=password
            )
            print(f"SUCCESS: User created!")
        except Exception as e:
            print(f"ERROR: {e}")
            return
    
    print("\n" + "="*60)
    print("LOGIN CREDENTIALS")
    print("="*60)
    print(f"Email: {user.email}")
    print(f"CNIC: {user.cnic}")
    print(f"Password: {password}")
    print(f"Role: {user.role}")
    print(f"Active: {user.is_active}")
    print("="*60)
    print("\nYou can now login with these credentials!")

if __name__ == '__main__':
    create_default_user()

