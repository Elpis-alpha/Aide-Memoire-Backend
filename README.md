# Aide-mémoire — API

The backend for Aide-mémoire: rich-text notes organised into sections and tags,
with per-note public/private sharing.

**Express 5 · TypeScript · Mongoose 8 · zod at every boundary.**

The API owns the contract. Its zod schemas generate `openapi.json`, and the
frontend generates its TypeScript types from that file — which is what buys
type safety across two repositories without a monorepo.

## Running it

Requires Node 22+ and pnpm (`corepack enable && corepack prepare pnpm@10.28.2 --activate`).

```bash
pnpm install
cp .env.example .env   # then fill it in
pnpm dev               # tsx watch, reads .env
```

The API listens on `PORT` (5000 by default) and serves its own contract at
`/openapi.json`.

| Script | What it does |
|---|---|
| `pnpm dev` | Watch mode on `src/index.ts` |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run the compiled build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Smoke tests (Vitest + in-memory Mongo replica set) |
| `pnpm openapi` | Regenerate `openapi.json` from the zod schemas |

### Environment

Every variable is validated by zod at boot. The process **refuses to start** if
one is missing or malformed, rather than failing later on a request path, and
it waits for Mongo to connect before it listens.

`MONGODB_URL` must point at a **development** database. The cluster is shared
with unrelated projects, so scope anything destructive to this app's databases.

`TRUST_PROXY` is `0` when the API is run directly and `1` behind nginx, so rate
limiting keys on the real client IP rather than the proxy's. `REDIS_URL` is
optional: rate limiting uses Redis when it is set and in-process counters when
it is not, so the API runs locally without Redis.

See `.env.example` for the full list.

## Layout

```
src/
  app.ts        Express app: helmet, CORS allowlist, body limits, routers
  index.ts      Boot: validate env → connect Mongo → listen → graceful SIGTERM
  config/       zod-validated environment
  models/       Mongoose schemas, typed
  modules/      One folder per resource: router, service, zod schemas
    auth/ notes/ sections/ tags/ users/ media/ contact/ render/ health/
  openapi/      Generates openapi.json from the module schemas
  test/         Smoke tests
```

Routes are REST-shaped — `POST /api/notes`, `GET /api/users/me`, `/api/public/*`.
The pre-rewrite verb paths (`/api/note/create`) are gone.

## Notable decisions

**Auth.** Short-lived access tokens plus rotating refresh tokens. Refresh
tokens are opaque and stored hashed with a TTL index; replaying a rotated token
revokes the whole family. Cookies are `httpOnly`, `Secure` and `SameSite=Lax`.
`passwordChangedAt` invalidates tokens minted before a password change.

**Media.** No image bytes reach the API. `src/modules/media/` issues signed
direct-to-Cloudinary uploads scoped to a per-user folder, so there is no
multipart handler to get wrong and `sharp` is not a dependency.

**Mail.** Gmail's HTTPS API (`gmail.users.messages.send`), because VPS hosts
block SMTP. nodemailer is kept only as a MIME builder. Mail failure at startup
is logged and non-fatal — the API still listens.

**Data layer.** Sections and tags are refs rather than embedded copies, so a
rename cannot leave stale duplicates. Every list endpoint is cursor-paginated.
Search uses a weighted text index over `name` and `description` — **not** note
bodies, which are stored as sanitised HTML and would tokenise the markup along
with the prose.

**Sanitisation.** `sanitize-html` runs on note write *and* on render.

## Testing

```bash
pnpm test
```

A deliberately thin smoke layer — auth, note CRUD ownership, and the
public/private boundary — on Vitest, supertest and `mongodb-memory-server`
configured as a replica set so transactions work.

## Container and deploy

```bash
docker compose up --build
```

A four-stage Dockerfile; the runtime image carries only `dist/`, production
`node_modules`, templates and static assets, and runs as a non-root user with
no compiler and no package manager. `HEALTHCHECK` is wired to `/healthz`, and
`/readyz` reports database readiness.

Compose binds the API to `127.0.0.1:5004` and adds Redis. **There is no Mongo
service** — the database is external (Atlas). nginx terminates TLS and proxies
to that loopback port; `nginx/same-origin-api.conf` in the docs repo is the
preferred variant, proxying `yourdomain.com/api/*` so the auth cookie stays
same-origin.

CI runs typecheck → lint → smoke tests → OpenAPI drift check → image build.
The drift check regenerates `openapi.json` and fails if it differs from the
committed copy, so the contract cannot silently fall behind the schemas.

> The image is built in CI but **not pushed to a registry** yet. A registry and
> its credentials are the remaining piece before merge-to-`main` can deploy.
