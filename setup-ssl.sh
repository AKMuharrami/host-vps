#!/bin/bash

# Configuration
EMAIL="akzmuharrami@gmail.com" # Updated with your email
DOMAIN="api.mumantij-ai.com" # Updated with your subdomain

echo "Setting up SSL for $DOMAIN..."

# Check if domain is provided
if [ "$DOMAIN" == "render.yourdomain.com" ]; then
    echo "Please edit this script and set your DOMAIN and EMAIL."
    exit 1
fi

# Stop anything on port 80
sudo lsof -t -i:80 | xargs sudo kill -9 2>/dev/null

# Get certificate
sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

# Create certs directory in the project
mkdir -p ./certs

# Copy certs (Nginx needs access)
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./certs/fullchain.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./certs/privkey.pem
sudo chown $USER:$USER ./certs/*.pem

echo "------------------------------------------------"
echo "SSL Setup complete for $DOMAIN"
echo "Certs are copied to ./certs/"
echo "Update your nginx.conf to use these certs."
echo "------------------------------------------------"
