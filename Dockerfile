# ============================================================================
# churchukbptrade - Production Dockerfile (multi-stage)
# ============================================================================
# Uses Next.js standalone mode for minimal production image.
#
# Build:  docker build -t churchukbptrade .
# Run:    docker run -p 3000:3000 -v ./data:/app/data --env-file .env churchukbptrade
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools for native modules (bcrypt)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install production + dev dependencies (dev needed for build step)
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

# Build the application (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production Runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets (no ownership change needed — read-only)
COPY --from=builder /app/public ./public

# Copy content directory (blueprints catalog — read-only at runtime)
COPY --from=builder /app/content ./content

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy bcrypt native module (standalone doesn't bundle native bindings)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcrypt ./node_modules/bcrypt

# Create ALL data directories for runtime persistence
# These will be overlaid by volume mounts but ensure the container
# can start even without a volume (first run / CI).
RUN mkdir -p /app/data/sellers /app/data/orders /app/data/chats /app/data/users /app/data/buyers && \
    chown -R nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
