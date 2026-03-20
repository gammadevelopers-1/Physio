# ===========================================
# Production Dockerfile
# ===========================================
# Multi-stage build for minimal image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install FFmpeg for video processing pipeline
RUN apk add --no-cache ffmpeg

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Copy certificate assets (fonts, logos) for PDF generation
COPY --from=builder --chown=nestjs:nodejs /app/src/modules/certificates/assets ./dist/src/modules/certificates/assets

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health/live || exit 1

# Start the application
CMD ["node", "dist/src/main"]
