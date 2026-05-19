#!/bin/bash

# Update system
sudo apt-get update && sudo apt-get upgrade -y

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
echo "Setup complete!"
echo "To start the application:"
echo "1. Build your frontend: npm run build"
echo "2. Copy 'dist' contents to 'frontend/' folder"
echo "3. Run: docker compose up -d"
echo "------------------------------------------------"
