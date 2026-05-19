#!/bin/bash

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install prerequisites
sudo apt-get install -y curl git unzip lsof certbot

# Check resources
echo "Checking system resources..."
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
TOTAL_DISK=$(df -h / | awk '/\// {print $4}' | sed 's/G//')

echo "Total RAM: ${TOTAL_RAM}MB"
echo "Available Disk: ${TOTAL_DISK}GB"

if [ "$TOTAL_RAM" -lt 4000 ]; then
    echo "WARNING: Your VPS has less than 4GB RAM. Remotion rendering might be unstable."
fi

# Install Docker
if ! [ -x "$(command -v docker)" ]; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Fix for "Exit Code 100" / Apt failures in Docker
# This configures MTU to 1400 and sets DNS to 8.8.8.8 for all containers
echo "Configuring Docker network settings..."
sudo mkdir -p /etc/docker
cat <<EOF | sudo tee /etc/docker/daemon.json
{
  "mtu": 1400,
  "dns": ["8.8.8.8", "8.8.4.4"]
}
EOF
sudo systemctl restart docker

# Setup Swap File (Critical for low-RAM VPS rendering)
if [ ! -f /swapfile ]; then
    echo "Creating 4GB Swap file for stability..."
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Create shared storage
mkdir -p /tmp/mumantij
chmod 777 /tmp/mumantij

echo "------------------------------------------------"
echo "Basic Setup complete!"
echo ""
echo "NEXT STEPS FOR SSL (Mandatory for Vercel):"
echo "1. Point your subdomain (e.g. render.yourdomain.com) to this VPS IP."
echo "2. Run: chmod +x setup-ssl.sh && ./setup-ssl.sh"
echo "3. Finally run: docker compose up -d"
echo "------------------------------------------------"
