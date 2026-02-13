#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --no-input

# Run database migrations
python manage.py migrate

# Create default admin user if none exists
python manage.py shell -c "
from users.models import User
if not User.objects.filter(role='ADMIN').exists():
    user = User.objects.create_superuser(
        cnic='0000000000000',
        full_name='Admin',
        email='admin@cfms.com',
        password='Cust123',
        role='ADMIN'
    )
    print('Default admin user created: CNIC=0000000000000, Password=Cust123')
else:
    print('Admin user already exists, skipping creation.')
"

