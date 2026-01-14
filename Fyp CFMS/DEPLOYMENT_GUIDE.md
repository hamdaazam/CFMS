# Deployment Guide for CUST CFMS

This guide covers deploying the Course Folder Management System (CFMS) to production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Backend Deployment (Django)](#backend-deployment-django)
4. [Frontend Deployment (React/Vite)](#frontend-deployment-reactvite)
5. [Database Setup](#database-setup)
6. [Environment Variables](#environment-variables)
7. [Production Configuration](#production-configuration)
8. [Server Setup (VPS/Cloud)](#server-setup-vpscloud)
9. [Quick Deployment Scripts](#quick-deployment-scripts)

---

## Prerequisites

### Required Software
- **Python 3.9+** (for Django backend)
- **Node.js 18+** and **npm** (for React frontend)
- **PostgreSQL** (recommended) or **MySQL** (for production database)
- **Nginx** (web server and reverse proxy)
- **Gunicorn** or **uWSGI** (WSGI server for Django)
- **SSL Certificate** (Let's Encrypt recommended)

### Server Requirements
- **Minimum**: 2 CPU cores, 4GB RAM, 20GB storage
- **Recommended**: 4 CPU cores, 8GB RAM, 50GB storage
- **OS**: Ubuntu 20.04/22.04 LTS or similar Linux distribution

---

## Deployment Options

### Option 1: VPS/Cloud Server (Recommended)
- **DigitalOcean**, **AWS EC2**, **Linode**, **Vultr**, **Azure**
- Full control, scalable, cost-effective

### Option 2: Platform as a Service (PaaS)
- **Heroku** (easy but limited)
- **Railway** (modern, easy)
- **Render** (free tier available)
- **AWS Elastic Beanstalk**

### Option 3: Containerized (Docker)
- **Docker** + **Docker Compose**
- Deploy to any cloud provider

---

## Backend Deployment (Django)

### Step 1: Prepare Production Settings

Create a production settings file:

```python
# backend/cfms_backend/settings_production.py
from .settings import *
import os

DEBUG = False
ALLOWED_HOSTS = ['yourdomain.com', 'www.yourdomain.com', 'your-server-ip']

# Database Configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'cfms_db'),
        'USER': os.environ.get('DB_USER', 'cfms_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Static Files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Security Settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# CORS Settings (Update with your frontend domain)
CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
]

# Email Configuration (for production)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
```

### Step 2: Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install gunicorn  # Add to requirements.txt
```

### Step 3: Database Migration

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### Step 4: Run with Gunicorn

```bash
# Test locally first
gunicorn cfms_backend.wsgi:application --bind 0.0.0.0:8000

# Production (with multiple workers)
gunicorn cfms_backend.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

### Step 5: Create Systemd Service

Create `/etc/systemd/system/cfms-backend.service`:

```ini
[Unit]
Description=CFMS Django Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/cfms/backend
Environment="PATH=/var/www/cfms/backend/venv/bin"
ExecStart=/var/www/cfms/backend/venv/bin/gunicorn \
    cfms_backend.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 120

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable cfms-backend
sudo systemctl start cfms-backend
sudo systemctl status cfms-backend
```

---

## Frontend Deployment (React/Vite)

### Step 1: Build for Production

```bash
cd "Fyp Project Client"
npm install
npm run build
```

This creates a `dist/` folder with optimized production files.

### Step 2: Update API Base URL

Update `src/services/api.ts` to use production API:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.yourdomain.com';
```

### Step 3: Environment Variables

Create `.env.production`:

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Step 4: Serve with Nginx

Create `/etc/nginx/sites-available/cfms-frontend`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend
    root /var/www/cfms/frontend/dist;
    index index.html;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
    
    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }
    
    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Media files
    location /media {
        alias /var/www/cfms/backend/media;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Static files
    location /static {
        alias /var/www/cfms/backend/staticfiles;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/cfms-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Database Setup

### PostgreSQL (Recommended)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE cfms_db;
CREATE USER cfms_user WITH PASSWORD 'your_secure_password';
ALTER ROLE cfms_user SET client_encoding TO 'utf8';
ALTER ROLE cfms_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE cfms_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE cfms_db TO cfms_user;
\q
```

### MySQL Alternative

```bash
sudo apt install mysql-server
sudo mysql_secure_installation
```

```sql
CREATE DATABASE cfms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cfms_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON cfms_db.* TO 'cfms_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## Environment Variables

Create `.env` file in `backend/` directory:

```env
# Django
SECRET_KEY=your-secret-key-here-generate-with-openssl-rand-hex-32
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
DB_NAME=cfms_db
DB_USER=cfms_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com
```

Generate secret key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Production Configuration

### Update Django Settings

Modify `backend/cfms_backend/settings.py`:

```python
import os
from pathlib import Path

# Load environment variables
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='').split(',')

# ... rest of settings
```

### Security Checklist

- [ ] Set `DEBUG = False`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Use strong `SECRET_KEY`
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set secure cookie flags
- [ ] Use environment variables for secrets
- [ ] Enable database backups
- [ ] Configure firewall (UFW)
- [ ] Set up log rotation

---

## Server Setup (VPS/Cloud)

### Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y python3-pip python3-venv nginx postgresql git curl

# Create application user
sudo adduser --disabled-password --gecos "" cfms
sudo usermod -aG sudo cfms

# Switch to application user
sudo su - cfms
```

### Deploy Application

```bash
# Create application directory
mkdir -p /var/www/cfms
cd /var/www/cfms

# Clone repository (or upload files)
git clone https://github.com/yourusername/cfms.git .

# Or use SCP to upload files
# scp -r "Fyp Project Client" user@server:/var/www/cfms/
```

### Setup Backend

```bash
cd /var/www/cfms/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# Create .env file
nano .env
# (Add environment variables)

# Run migrations
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### Setup Frontend

```bash
cd /var/www/cfms
npm install
npm run build

# Copy dist to nginx directory
sudo cp -r dist /var/www/cfms/frontend/
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Firewall Configuration

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Quick Deployment Scripts

### deploy.sh (Full Deployment)

```bash
#!/bin/bash
set -e

echo "Starting deployment..."

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart cfms-backend

# Frontend
cd ..
npm install
npm run build
sudo cp -r dist/* /var/www/cfms/frontend/

# Restart services
sudo systemctl reload nginx

echo "Deployment complete!"
```

Make executable:
```bash
chmod +x deploy.sh
```

### update.sh (Quick Update)

```bash
#!/bin/bash
cd /var/www/cfms
git pull
./deploy.sh
```

---

## Docker Deployment (Alternative)

### Dockerfile (Backend)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
EXPOSE 8000

CMD ["gunicorn", "cfms_backend.wsgi:application", "--bind", "0.0.0.0:8000"]
```

### Dockerfile (Frontend)

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: cfms_db
      POSTGRES_USER: cfms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    command: gunicorn cfms_backend.wsgi:application --bind 0.0.0.0:8000
    volumes:
      - ./backend:/app
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "8000:8000"
    depends_on:
      - db
    environment:
      - DB_HOST=db
      - DB_NAME=cfms_db
      - DB_USER=cfms_user
      - DB_PASSWORD=${DB_PASSWORD}

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  static_volume:
  media_volume:
```

---

## Monitoring & Maintenance

### Logs

```bash
# Backend logs
sudo journalctl -u cfms-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Django logs
tail -f /var/www/cfms/backend/logs/django.log
```

### Backup Script

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/cfms"

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U cfms_user cfms_db > $BACKUP_DIR/db_$DATE.sql

# Media files backup
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/cfms/backend/media

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /var/www/cfms/backup.sh
```

---

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if Gunicorn is running: `sudo systemctl status cfms-backend`
   - Check logs: `sudo journalctl -u cfms-backend -n 50`

2. **Static files not loading**
   - Run: `python manage.py collectstatic --noinput`
   - Check Nginx configuration for static file paths

3. **CORS errors**
   - Update `CORS_ALLOWED_ORIGINS` in settings.py
   - Check frontend API URL configuration

4. **Database connection errors**
   - Verify database credentials in `.env`
   - Check PostgreSQL/MySQL service: `sudo systemctl status postgresql`

---

## Support

For issues or questions:
- Check logs first
- Review Django/Nginx error logs
- Verify environment variables
- Test API endpoints with curl/Postman

---

**Last Updated**: 2024
**Version**: 1.0


