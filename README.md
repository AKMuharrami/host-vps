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

# IMPORTANT: If Docker build previously failed, this script 
# updated your Docker config (MTU/DNS). Restarting system is recommended.

# Open Firewall Ports
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
# Recommendation: Clear old cache before first build
docker system prune -a -f

# Build and start
docker compose up -d --build
```

## Fresh Start (If anything fails)
If you encounter errors during build or the site is unreachable:
1. **Clean everything**:
   ```bash
   docker compose down
   docker system prune -a --volumes -f
   ```
2. **Re-run setup**:
   ```bash
   ./setup-vps.sh
   ```
3. **Build again**:
   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

## Troubleshooting
### Docker Build Fails (apt-get error 100)
If `docker compose up --build` fails at the `apt-get` step:
1. **Network Fix applied**: The `setup-vps.sh` script now automatically sets MTU to 1400 and DNS to 8.8.8.8 in `/etc/docker/daemon.json`. This is the most common fix for Hostinger/OVH networking issues in Docker.
2. **Swap File**: The script also creates a 4GB swap file. Rendering (Chromium) is memory intensive; without swap, the process may be killed by the system (OOM).
3. **Re-run Setup**: Re-run `./setup-vps.sh` and then **RESTART** your VPS for all network changes to take full effect.
4. **No Cache**: Try building with no cache:
   ```bash
   docker compose build --no-cache
   ```

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
