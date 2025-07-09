# Multi-stage Dockerfile for Mechmate Self-Hosted
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    wget \
    dumb-init

# Create app directory and non-root user
RUN addgroup -g 1001 -S mechmate && \
    adduser -S mechmate -u 1001 -G mechmate

WORKDIR /app
RUN chown mechmate:mechmate /app

# =======================
# Build stage
# =======================
FROM base AS builder

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Copy environment file (use .env if exists, otherwise .env.example)
COPY .env ./

# Build the application
RUN npm run build

# =======================
# Production stage
# =======================
FROM base AS runner

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create data directories with proper permissions
RUN mkdir -p /app/data/backups /app/data/uploads && \
    chown -R mechmate:mechmate /app/data

# Copy built application and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/static ./static
COPY --from=builder /app/.env ./.env
RUN npm ci --omit=dev --prefer-offline --no-audit && \
    npm cache clean --force

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

# Switch to non-root user
USER mechmate

# Expose port
EXPOSE 3000

# Create volume for persistent data
VOLUME ["/app/data"]

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "build/index.js"]
