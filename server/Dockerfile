# ═══════════════════════════════════════════════════════════════════
# Listifys — API Server (Production)
# Multi-stage build: install → prune dev deps → slim runtime image
# ═══════════════════════════════════════════════════════════════════

# ---------- Stage 1 : install dependencies ----------
FROM node:22-alpine AS deps

# vips runtime needed by sharp prebuilt binary
RUN apk add --no-cache vips

WORKDIR /app

COPY package.json package-lock.json ./

# Use npm ci for deterministic, reproducible installs.
# If lockfile has Windows-specific optional deps, npm ci handles
# platform resolution correctly on Alpine linux-musl.
RUN npm ci --no-audit --no-fund

# ---------- Stage 1.5 : prune to production deps ----------
FROM deps AS prod-deps

RUN npm prune --omit=dev

# ---------- Stage 2 : production image ----------
FROM node:22-alpine AS runner

LABEL maintainer="Listifys <dev@listify.app>"
LABEL description="Listifys API production image"

# Security: run as non-root
RUN addgroup -S listify && adduser -S listify -G listify

# sharp runtime dependency + curl for healthcheck
RUN apk add --no-cache vips curl

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Remove dev/test files that shouldn't be in production
RUN rm -rf tests/ .env .env.* nodemon.json

# Create logs directory (writable by app user)
RUN mkdir -p /app/logs && chown -R listify:listify /app/logs

# Switch to non-root user
USER listify

# Express listens on 5000
EXPOSE 5000

# Health check — server exposes GET /health
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD curl -sf http://127.0.0.1:5000/health || exit 1

# Graceful shutdown (SIGTERM → server.close → mongoose.close)
STOPSIGNAL SIGTERM

# Production: use cluster.js for multi-core (falls back to server.js if WEB_CONCURRENCY=1)
CMD ["node", "--max-old-space-size=1536", "--max-semi-space-size=64", "cluster.js"]
