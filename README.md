## Aide-mémoire

A notebook application that features rich text, user signup and login, tags, friends, public and private notes and lots more.

Check it out to learn more.
---

## Running it

Requires Node 22+ and pnpm (`corepack enable && corepack prepare pnpm@10.28.2 --activate`).

```bash
pnpm install
cp .env.example .env   # then fill it in
pnpm dev               # tsx watch, reads .env
```

| Script | What it does |
|---|---|
| `pnpm dev` | Watch mode on `src/index.ts` |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run the compiled build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Smoke tests (Vitest + in-memory Mongo replica set) |
| `pnpm openapi` | Regenerate `openapi.json` from the zod schemas |

`MONGODB_URL` must point at a **development** database. The API refuses to start
if any required variable is missing or malformed, and it waits for Mongo before
it listens.

The contract lives at `/openapi.json`; the frontend generates its types from it.
