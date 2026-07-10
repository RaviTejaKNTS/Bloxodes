# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/extension/package.json ./apps/extension/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ARG BLOXODES_BUILD_SHA=unknown
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BLOXODES_BUILD_SHA=$BLOXODES_BUILD_SHA
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN set -eu; \
  sha="$BLOXODES_BUILD_SHA"; \
  if [ "$sha" = "unknown" ] && [ -f .git/HEAD ]; then \
    head="$(cat .git/HEAD)"; \
    case "$head" in \
      ref:\ *) \
        ref="${head#ref: }"; \
        if [ -f ".git/$ref" ]; then \
          sha="$(cat ".git/$ref")"; \
        elif [ -f .git/packed-refs ]; then \
          packed="$(awk -v ref="$ref" '$2 == ref { print $1; exit }' .git/packed-refs)"; \
          if [ -n "$packed" ]; then sha="$packed"; fi; \
        fi; \
        ;; \
      *) \
        sha="$head"; \
        ;; \
    esac; \
  fi; \
  printf '%s\n' "$sha" > /app/build-sha
RUN --mount=type=secret,id=production_env,required=false \
  node scripts/ops/run-with-production-build-env.mjs node scripts/ops/check-production-data-readiness.mjs
RUN --mount=type=secret,id=production_env,required=false \
  node scripts/ops/run-with-production-build-env.mjs npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ARG BLOXODES_BUILD_SHA=unknown
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV BLOXODES_BUILD_SHA=$BLOXODES_BUILD_SHA

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --no-create-home --shell /usr/sbin/nologin nextjs \
  && mkdir -p /app/apps/web/.next/cache \
  && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/build-sha ./build-sha

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((res)=>{if(!res.ok)process.exit(1);}).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
