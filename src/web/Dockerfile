# Stage 1: Dependencies
FROM node:18.17.1-alpine3.18 AS deps
LABEL stage=builder

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@8.6.12 --activate

# Set working directory with proper permissions
WORKDIR /app
RUN chown -R node:node /app

# Copy package files with strict permissions
COPY --chown=node:node package.json pnpm-lock.yaml ./
USER node

# Install dependencies with security flags
RUN pnpm install --frozen-lockfile --prod \
    --unsafe-perm=false \
    --security-level=high \
    --strict-peer-dependencies \
    --no-optional

# Stage 2: Builder
FROM node:18.17.1-alpine3.18 AS builder
LABEL stage=builder

# Set build environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app
RUN chown -R node:node /app

# Copy dependencies and source code
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.6.12 --activate

USER node

# Build application with optimization flags
RUN pnpm build \
    --no-source-maps \
    --experimental-minify \
    --no-lint

# Stage 3: Production Runtime
FROM node:18.17.1-alpine3.18 AS runner
LABEL maintainer="Porfin Development Team" \
    version="1.0.0" \
    description="Porfin Web Frontend" \
    security.lgpd.compliant="true" \
    security.healthcare.ready="true" \
    com.porfin.build.date=${BUILD_DATE} \
    com.porfin.commit.sha=${GIT_SHA} \
    com.porfin.version=${VERSION}

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

# Install necessary security packages
RUN apk add --no-cache \
    wget \
    curl \
    tini \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001 \
    && chown -R nextjs:nodejs /app

# Copy necessary files with strict permissions
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Security hardening
RUN chmod -R 755 /app \
    && chmod -R 644 /app/.next/static \
    && chmod 644 /app/next.config.js

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Switch to non-root user
USER nextjs

# Configure security options
RUN mkdir -p /tmp/nextjs/cache \
    && chown -R nextjs:nodejs /tmp/nextjs

# Expose port
EXPOSE ${PORT}

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "server.js"]

# Security configurations
VOLUME ["/tmp"]
STOPSIGNAL SIGTERM

# Read-only root filesystem
VOLUME ["/app/node_modules", "/app/.next"]