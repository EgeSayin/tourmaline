# syntax=docker/dockerfile:1

# Node 26 or later: the app uses the built-in Temporal API. Pinned to a release; bump it for security fixes.
ARG NODE_VERSION=26.10.0

FROM node:${NODE_VERSION}-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:cli

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone server serves `public` and `.next/static` itself once they sit beside it.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# For `node cli/migrate.mjs` and `node cli/reset-password.mjs <username>`.
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/dist/cli ./cli
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
