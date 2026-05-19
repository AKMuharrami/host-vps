#!/bin/bash

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install prerequisites
sudo apt-get install -y curl git unzip lsof certbot

# Install Docker
if ! [ -x "$(command -v docker)" ]; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Install Docker Compose
sudo apt-get install -y docker-compose-plugin

echo "------------------------------------------------"
echo "Basic Setup complete!"
echo ""
echo "NEXT STEPS FOR SSL (Mandatory for Vercel):"
echo "1. Point your subdomain (e.g. render.yourdomain.com) to this VPS IP."
echo "2. Run: chmod +x setup-ssl.sh && ./setup-ssl.sh"
echo "3. Finally run: docker compose up -d"
echo "------------------------------------------------"
