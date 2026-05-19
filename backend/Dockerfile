FROM node:20-slim

# Install system dependencies for Chromium and FFmpeg with retries
RUN apt-get update --fix-missing && apt-get install -y --no-install-recommends \
    ffmpeg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libphi-dev \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-noto-color-emoji \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variables
ENV PORT=3005
ENV NODE_ENV=production

EXPOSE 3005

CMD ["npm", "run", "start:prod"]
