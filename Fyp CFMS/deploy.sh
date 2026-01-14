#!/bin/bash
# Deployment script for CFMS
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting CFMS Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root${NC}"
   exit 1
fi

# Backend Deployment
echo -e "${YELLOW}📦 Deploying Backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing/updating dependencies..."
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo -e "${GREEN}✅ Backend deployment complete${NC}"

# Frontend Deployment
echo -e "${YELLOW}📦 Deploying Frontend...${NC}"
cd ..

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

echo "Building frontend..."
npm run build

echo -e "${GREEN}✅ Frontend build complete${NC}"

# Restart services
echo -e "${YELLOW}🔄 Restarting services...${NC}"
if systemctl is-active --quiet cfms-backend; then
    sudo systemctl restart cfms-backend
    echo -e "${GREEN}✅ Backend service restarted${NC}"
fi

if systemctl is-active --quiet nginx; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx reloaded${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"


