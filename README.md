# Hostinger VPS Rendering Backend

This bundle contains the code to run your video rendering backend on a Hostinger VPS (or any Ubuntu VPS).

## File Structure
- `backend/`: The Node.js/Remotion rendering server.
- `nginx.conf`: Nginx configuration for proxying and SSL.
- `docker-compose.yml`: Docker setup for backend and SSL proxy.
- `setup-vps.sh`: Script to install Docker and prerequisites.
- `setup-ssl.sh`: Script to get SSL certificates for your subdomain.

## How to Deploy

### 1. Prepare the Bundle
Zip this entire `hostinger-vps` folder and upload it to your VPS.

### 2. Setup System
```bash
chmod +x setup-vps.sh && ./setup-vps.sh

# IMPORTANT: Open Firewall Ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 3. Setup Subdomain & SSL (Critical for Vercel)
Vercel requires HTTPS. You **must** use a subdomain for your rendering server.
1. Point your subdomain `api.mumantij-ai.com` to your VPS IP in your DNS settings (Hostinger or Cloudflare).
2. Verify it's pointing correctly: `nslookup api.mumantij-ai.com`
3. Run the SSL script:
```bash
chmod +x setup-ssl.sh && ./setup-ssl.sh
```
*Note: If this fails, make sure nothing is already listening on port 80.*

### 4. Start the Server
```bash
docker compose up -d --build
```

## How to Connect to Vercel
Once your VPS is running and accessible at `https://api.mumantij-ai.com`:

1. Go to your **Vercel Project Settings** -> **Environment Variables**.
2. Update `VITE_VPS_BACKEND_URL` to: `https://api.mumantij-ai.com`
3. Redeploy your Vercel app.

## Troubleshooting
### Site Can't Be Reached
1. **Firewall**: Ensure ports 80 and 443 are open (see step 2).
2. **Container Status**: Check if the containers are running:
   ```bash
   docker compose ps
   ```
3. **Logs**: If the frontend (Nginx) is not running, it's usually because the SSL certs weren't created correctly. Check logs:
   ```bash
   docker compose logs frontend
   ```
4. **SSL Files**: Ensure `/hostinger-vps/certs/fullchain.pem` exists before running docker-compose.

### Health Check
Visit `https://api.mumantij-ai.com/api/health` to verify the server is running. It should return `{"status":"ok"}`.
