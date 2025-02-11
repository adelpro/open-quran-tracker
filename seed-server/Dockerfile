# Use Node.js base image
FROM node:18-slim

LABEL maintainer="Adelpro <contact@gmail.com>"
LABEL name="open-quran-tracker"
LABEL version="1.1"

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json with proper ownership
COPY --chown=node:node package*.json ./

RUN npm ci --omit=dev

# Copy all remaining files with correct ownership
COPY --chown=node:node . .

# Run as non-root user (security best practice)
RUN chown -R node:node /app
USER node

# Expose WebTorrent ports (optional, for WebRTC connections)
EXPOSE 6881
EXPOSE 6881/udp

# Switch to non-root user (already set via --chown above)
USER node

# Default command to run the seed script
CMD ["node", "seed.mjs"]
