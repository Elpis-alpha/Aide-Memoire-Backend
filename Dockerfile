# syntax=docker/dockerfile:1

# ---- Base -------------------------------------------------------------------
# Pinned major. corepack picks the pnpm version from package.json's
# "packageManager" field, so the build uses the same pnpm as local development.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
# mongodb-memory-server is a devDependency and its postinstall downloads an
# ~80MB Mongo binary. Nothing in this image ever needs it.
ENV MONGOMS_DISABLE_POSTINSTALL=1

# ---- Production dependencies ------------------------------------------------
# Resolved separately from the build so the runtime layer never inherits
# TypeScript, Vitest or the rest of the toolchain.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ---- Build ------------------------------------------------------------------
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# ---- Runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=5000

# Non-root. The image carries no compiler, no package manager cache and no
# source — only the compiled output and the packages it actually imports.
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps  --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
# hbs views for the transactional pages, and the static assets.
COPY --chown=app:app template ./template
COPY --chown=app:app public ./public

USER app
EXPOSE 5000

# Wired to the liveness endpoint, which deliberately does not touch Mongo —
# a database blip must not make the orchestrator restart a healthy container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/healthz >/dev/null 2>&1 || exit 1

# Exec form, no shell wrapper, so SIGTERM reaches node as PID 1 and the
# graceful shutdown in src/index.ts actually runs.
CMD ["node", "dist/index.js"]
