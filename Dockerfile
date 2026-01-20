# ============================================================================
# churchukbptrade - Production Dockerfile
# ============================================================================
# Multi-stage build for optimized production image
# Uses Next.js standalone mode for server-side features (API routes)
#
# Build:  docker build -t churchukbptrade .
# Run:    docker run -p 3000:3000 -e TELEGRAM_BOT_TOKEN=xxx -e TELEGRAM_ADMIN_CHAT_ID=xxx churchukbptrade
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies for native modules (bcrypt requires build tools)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (rebuild native modules for Alpine)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the application (standalone mode)
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production Runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public

# Copy content directory with proper ownership for runtime writes
# This will be overridden when using volume mount
COPY --from=builder --chown=nextjs:nodejs /app/content ./content

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy bcrypt native module (standalone doesn't include native bindings correctly)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcrypt ./node_modules/bcrypt

# Create data directory for any additional runtime data
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check using the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start Next.js server
CMD ["node", "server.js"]
