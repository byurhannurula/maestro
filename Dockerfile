# syntax=docker/dockerfile:1

# ---- deps: install with the same pnpm + cooldown policy as local ----
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
# libc compat for native deps (sharp) on alpine
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder: produce the standalone server bundle ----
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- runner: minimal runtime image ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4544 \
    HOSTNAME=0.0.0.0

# Non-root by default; docker-compose overrides with the host PUID:PGID so the
# app can write to the shared /music and /trash volumes.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 4544
CMD ["node", "server.js"]
