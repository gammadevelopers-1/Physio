# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time args for production environment variables
# Next.js inlines NEXT_PUBLIC_* vars at build time, so they must be set here
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRAPI_URL
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_TABBY_PUBLIC_KEY
ARG NEXT_PUBLIC_TABBY_MERCHANT_CODE
ARG NEXT_PUBLIC_TAMARA_PUBLIC_KEY
# Sentry — DSN is public (browser SDK), env tag controls Sentry environment.
# SENTRY_AUTH_TOKEN is build-only; it uploads source maps but is not baked
# into the runtime bundle (Next strips non-NEXT_PUBLIC_* at build).
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_SENTRY_RELEASE
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_STRAPI_URL=${NEXT_PUBLIC_STRAPI_URL}
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=${NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
ENV NEXT_PUBLIC_TABBY_PUBLIC_KEY=${NEXT_PUBLIC_TABBY_PUBLIC_KEY}
ENV NEXT_PUBLIC_TABBY_MERCHANT_CODE=${NEXT_PUBLIC_TABBY_MERCHANT_CODE}
ENV NEXT_PUBLIC_TAMARA_PUBLIC_KEY=${NEXT_PUBLIC_TAMARA_PUBLIC_KEY}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_SENTRY_RELEASE=${NEXT_PUBLIC_SENTRY_RELEASE}
ENV SENTRY_ORG=${SENTRY_ORG}
ENV SENTRY_PROJECT=${SENTRY_PROJECT}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# Copy package files and install all dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Copy the standalone build
# Next.js creates nested structure, we need to flatten it
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port (Cloud Run uses PORT env variable)
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
