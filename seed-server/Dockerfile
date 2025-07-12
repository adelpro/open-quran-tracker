# Use a minimal Node.js image
FROM node:18-slim

LABEL maintainer="Adelpro <adelpro@gmail.com>"
LABEL name="open-quran-seeder"
LABEL version="1.1"

# Create app directory and set working directory
WORKDIR /app

# Create a non-root user for security
RUN useradd --system --create-home --uid 1000 seeder

# Copy package files and install deps as seeder user
COPY --chown=seeder:seeder package*.json ./
RUN npm ci --omit=dev

# Copy rest of the app with proper ownership
COPY --chown=seeder:seeder . .

# Ensure downloads directory exists and is writable
RUN mkdir -p /app/downloads && chown -R seeder:seeder /app

# Switch to non-root user
USER seeder

# Expose WebTorrent ports (if needed for DHT/peering)
EXPOSE 6881
EXPOSE 6881/udp

# Run the seed script
CMD ["node", "seed.mjs"]
