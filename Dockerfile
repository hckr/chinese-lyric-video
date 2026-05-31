# 1. Use a tiny Debian-slim image instead of the heavy Playwright base
FROM node:22-bookworm-slim

# 2. Install only the specific system libraries needed for headless Chrome + Chinese fonts
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. Copy files and install NPM dependencies
COPY package*.json ./
RUN npm ci

# 4. Download ONLY the lightweight "Chrome Headless Shell" inside the container
RUN npx remotion browser ensure

# 5. Copy the rest of the project
COPY . .