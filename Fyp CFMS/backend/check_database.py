"""
Check database connection and user count
"""
import os
import sys

# Initialize PyMySQL BEFORE Django setup
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cfms_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.conf import settings
from users.models import User

print("\n" + "="*60)
print("DATABASE INFORMATION")
print("="*60)

db = settings.DATABASES['default']
print(f"\nDatabase Engine: {db['ENGINE']}")
print(f"Database Name: {db['NAME']}")
print(f"Database Host: {db.get('HOST', 'N/A')}")

print("\n" + "="*60)
print("USERS IN DATABASE")
print("="*60)

total_users = User.objects.count()
active_users = User.objects.filter(is_active=True).count()
inactive_users = User.objects.filter(is_active=False).count()

print(f"\nTotal users: {total_users}")
print(f"Active users: {active_users}")
print(f"Inactive users: {inactive_users}")

if total_users > 0:
    print("\n" + "="*60)
    print("SAMPLE USERS (First 10)")
    print("="*60)
    print(f"\n{'ID':<5} {'Name':<30} {'Email':<25} {'CNIC':<15} {'Role':<15} {'Active':<10}")
    print("-" * 100)
    for user in User.objects.all()[:10]:
        email_display = (user.email or 'No email')[:24]
        active_status = "Yes" if user.is_active else "No"
        print(f"{user.id:<5} {user.full_name[:29]:<30} {email_display:<25} {user.cnic:<15} {user.role:<15} {active_status:<10}")
else:
    print("\nNo users found in database!")

print("\n" + "="*60)

