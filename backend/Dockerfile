FROM node:20-bookworm

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Use a faster, more reliable mirror and handle flaky VPS network
RUN echo "deb http://deb.debian.org/debian bookworm main\ndeb http://deb.debian.org/debian-security bookworm-security main\ndeb http://deb.debian.org/debian bookworm-updates main" > /etc/apt/sources.list

# Combined update and install with retries
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates gnupg wget && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1-0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
# Use npm install --prefer-offline to speed up if possible, but mainly ensure it works
RUN npm install

# Copy all the remaining files
COPY . .

# Expose the backend port
EXPOSE 3005

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Command to run the backend
CMD ["npm", "run", "start"]
