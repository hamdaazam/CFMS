"""
Create multiple test users with different roles
Run: python create_multiple_users.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import User

def create_test_users():
    """Create multiple test users with different roles"""
    print("\n" + "="*60)
    print("CREATING TEST USERS")
    print("="*60)
    
    # Test users to create
    test_users = [
        {
            'cnic': '1234567890124',
            'email': 'faculty@test.com',
            'full_name': 'Faculty Member',
            'role': 'FACULTY',
            'password': 'test1234'
        },
        {
            'cnic': '1234567890125',
            'email': 'coordinator@test.com',
            'full_name': 'Course Coordinator',
            'role': 'COORDINATOR',
            'password': 'test1234'
        },
        {
            'cnic': '1234567890126',
            'email': 'convener@test.com',
            'full_name': 'Department Convener',
            'role': 'CONVENER',
            'password': 'test1234'
        },
        {
            'cnic': '1234567890127',
            'email': 'hod@test.com',
            'full_name': 'Head of Department',
            'role': 'HOD',
            'password': 'test1234'
        },
        {
            'cnic': '1234567890128',
            'email': 'audit@test.com',
            'full_name': 'Audit Member',
            'role': 'AUDIT_MEMBER',
            'password': 'test1234'
        },
    ]
    
    created = []
    updated = []
    
    for user_data in test_users:
        cnic = user_data['cnic']
        existing_user = User.objects.filter(cnic=cnic).first()
        
        if existing_user:
            # Update existing user
            existing_user.email = user_data['email']
            existing_user.full_name = user_data['full_name']
            existing_user.role = user_data['role']
            existing_user.set_password(user_data['password'])
            existing_user.is_active = True
            existing_user.save()
            updated.append(existing_user)
            print(f"Updated: {user_data['full_name']} ({user_data['role']})")
        else:
            # Create new user
            try:
                user = User.objects.create_user(
                    cnic=cnic,
                    full_name=user_data['full_name'],
                    email=user_data['email'],
                    role=user_data['role'],
                    password=user_data['password']
                )
                user.is_active = True
                user.save()
                created.append(user)
                print(f"Created: {user_data['full_name']} ({user_data['role']})")
            except Exception as e:
                print(f"ERROR creating {user_data['full_name']}: {e}")
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Created: {len(created)} user(s)")
    print(f"Updated: {len(updated)} user(s)")
    
    print("\n" + "="*60)
    print("LOGIN CREDENTIALS")
    print("="*60)
    print("\nAll users have password: test1234")
    print("\nUsers:")
    for user_data in test_users:
        print(f"  - {user_data['full_name']} ({user_data['role']})")
        print(f"    Email: {user_data['email']}")
        print(f"    CNIC: {user_data['cnic']}")
        print()

if __name__ == '__main__':
    create_test_users()

