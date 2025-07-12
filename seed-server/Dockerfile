FROM node:18-slim

LABEL maintainer="Adelpro <adelpro@gmail.com>"
LABEL name="open-quran-seeder"
LABEL version="1.1"

WORKDIR /app

# Create a non-root user
RUN useradd --system --create-home --uid 1000 seeder

# Copy package files and install dependencies as seeder user
COPY --chown=seeder:seeder package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the app files with correct ownership
COPY --chown=seeder:seeder . .

# Create downloads directory (if not existing) and fix ownership
RUN mkdir -p /app/downloads \
    && chown -R seeder:seeder /app/downloads

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER seeder

EXPOSE 6881
EXPOSE 6881/udp

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "seed.mjs"]
