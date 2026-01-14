# Quick Start Deployment Guide

This is a simplified guide for quickly deploying CFMS. For detailed instructions, see `DEPLOYMENT_GUIDE.md`.

## Option 1: Simple VPS Deployment (Recommended)

### Prerequisites
- Ubuntu 20.04/22.04 server
- Domain name (optional but recommended)
- SSH access to server

### Step 1: Server Setup

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-venv nginx postgresql git nodejs npm
```

### Step 2: Clone/Upload Project

```bash
# Create directory
sudo mkdir -p /var/www/cfms
sudo chown $USER:$USER /var/www/cfms
cd /var/www/cfms

# Option A: Clone from Git
git clone https://github.com/yourusername/cfms.git .

# Option B: Upload via SCP (from your local machine)
# scp -r "Fyp Project Client" user@server:/var/www/cfms/
```

### Step 3: Setup Backend

```bash
cd /var/www/cfms/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Create .env file
nano .env
```

Add to `.env`:
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,your-server-ip
DB_NAME=cfms_db
DB_USER=cfms_user
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432
```

```bash
# Setup database
sudo -u postgres psql
```

In PostgreSQL:
```sql
CREATE DATABASE cfms_db;
CREATE USER cfms_user WITH PASSWORD 'your-password';
ALTER ROLE cfms_user SET client_encoding TO 'utf8';
GRANT ALL PRIVILEGES ON DATABASE cfms_db TO cfms_user;
\q
```

```bash
# Run migrations
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

### Step 4: Setup Frontend

```bash
cd /var/www/cfms

# Install dependencies
npm install

# Create .env.production
echo "VITE_API_BASE_URL=https://yourdomain.com/api" > .env.production

# Build
npm run build
```

### Step 5: Configure Gunicorn

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
    --workers 4

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cfms-backend
sudo systemctl start cfms-backend
```

### Step 6: Configure Nginx

Create `/etc/nginx/sites-available/cfms`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/cfms/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /media {
        alias /var/www/cfms/backend/media;
    }

    location /static {
        alias /var/www/cfms/backend/staticfiles;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cfms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: SSL Certificate (Optional but Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 8: Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Done!** Your application should now be accessible at `https://yourdomain.com`

---

## Option 2: Docker Deployment (Easier)

### Prerequisites
- Docker and Docker Compose installed

### Steps

```bash
# Clone/upload project
cd /path/to/project

# Create .env file
cp .env.example .env
nano .env  # Edit with your values

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

**Done!** Application runs on `http://localhost`

---

## Option 3: Platform as a Service (Easiest)

### Railway.app

1. Sign up at [railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repository
4. Add PostgreSQL service
5. Set environment variables
6. Deploy!

### Render.com

1. Sign up at [render.com](https://render.com)
2. Create new Web Service
3. Connect repository
4. Set build command: `npm install && npm run build`
5. Set start command: `npm run preview` (or serve with nginx)
6. Add PostgreSQL database
7. Set environment variables
8. Deploy!

---

## Environment Variables Checklist

### Backend (.env)
- [ ] `SECRET_KEY` - Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` - Your domain(s)
- [ ] `DB_NAME` - Database name
- [ ] `DB_USER` - Database user
- [ ] `DB_PASSWORD` - Database password
- [ ] `DB_HOST` - Database host
- [ ] `DB_PORT` - Database port

### Frontend (.env.production)
- [ ] `VITE_API_BASE_URL` - Your backend API URL

---

## Quick Commands

```bash
# Restart backend
sudo systemctl restart cfms-backend

# View backend logs
sudo journalctl -u cfms-backend -f

# Restart nginx
sudo systemctl restart nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log

# Update and redeploy
cd /var/www/cfms
git pull  # or upload new files
./deploy.sh  # if using deployment script
```

---

## Troubleshooting

**502 Bad Gateway?**
- Check if backend is running: `sudo systemctl status cfms-backend`
- Check backend logs: `sudo journalctl -u cfms-backend -n 50`

**Static files not loading?**
- Run: `python manage.py collectstatic --noinput`
- Check file permissions: `sudo chown -R www-data:www-data /var/www/cfms/backend/staticfiles`

**CORS errors?**
- Update `CORS_ALLOWED_ORIGINS` in Django settings
- Check frontend API URL in `.env.production`

**Database connection errors?**
- Verify database is running: `sudo systemctl status postgresql`
- Check credentials in `.env`
- Test connection: `psql -U cfms_user -d cfms_db`

---

For detailed deployment instructions, see `DEPLOYMENT_GUIDE.md`.

