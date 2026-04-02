# Card Safe HQ Backend MVP (Cloudflare Workers + D1 + R2)

Production-minded MVP backend foundation for a mobile-first trading card collector app.

## What this backend includes

- Cloudflare Worker API routing with JSON responses.
- D1-backed auth/session foundation with hashed passwords.
- Card catalog CRUD.
- User collection CRUD.
- R2 direct image upload endpoint for front/back card photos.
- Sales comps architecture with a mock provider and refresh flow.
- Release calendar endpoints with filter support.
- Deterministic placeholder **AI Estimated Grade** endpoint and persistence.
- SQL migration and seed files.

## Files created

- `src/index.ts` – Worker entry, route matching, auth checks.
- `src/types.ts` – environment and model types.
- `src/lib/json.ts` – API response helpers.
- `src/lib/db.ts` – D1 query helpers.
- `src/lib/validation.ts` – body/field validation helpers.
- `src/lib/auth.ts` – register/login/logout/session helpers.
- `src/lib/r2.ts` – upload key + image validation + R2 helpers.
- `src/lib/comps.ts` – comps provider abstraction + mock provider.
- `src/lib/grading.ts` – deterministic grading estimate generator.
- `src/routes/*.ts` – route handlers by feature.
- `migrations/0001_init.sql` – database schema + indexes.
- `seed/seed.sql` – cards, releases, and comps seed records.

## Required Cloudflare bindings

The Worker expects these binding names exactly:

- D1: `DB`
- R2: `BUCKET`

In Cloudflare dashboard (or `wrangler.toml`) ensure your Worker has these bindings attached.

## API routes

### Health
- `GET /api/health`

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Cards
- `GET /api/cards`
- `POST /api/cards`
- `GET /api/cards/:id`
- `PATCH /api/cards/:id`
- `DELETE /api/cards/:id`

### Collection (auth required)
- `GET /api/collection`
- `POST /api/collection`
- `GET /api/collection/:id`
- `PATCH /api/collection/:id`
- `DELETE /api/collection/:id`

### Uploads (auth required)
- `POST /api/uploads/direct`
  - multipart form-data fields:
    - `file`: image file (jpeg/png/webp)
    - `collectionItemId`: number
    - `side`: `front` or `back`

### Releases
- `GET /api/releases`
  - optional query params: `game`, `type`, `from`, `to`
- `POST /api/releases`
- `GET /api/releases/:id`

### Sales comps
- `GET /api/comps/:cardId`
- `POST /api/comps/refresh/:cardId`

### Grading estimate (auth required)
- `POST /api/grading/estimate`
- `GET /api/grading/:collectionItemId`

## Response conventions

Success:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": "message" }
```

## D1 setup and seeding (Cloudflare dashboard workflow)

1. Open your D1 database in Cloudflare dashboard.
2. Run SQL from `migrations/0001_init.sql`.
3. (Optional) Run `seed/seed.sql` for sample cards/releases/comps.

Using Wrangler CLI, equivalent commands are:

```bash
npx wrangler d1 execute <DB_NAME> --file migrations/0001_init.sql
npx wrangler d1 execute <DB_NAME> --file seed/seed.sql
```

## GitHub + Cloudflare workflow notes

1. Push this repository to GitHub.
2. Connect GitHub repo to Cloudflare Workers.
3. Configure Worker bindings (`DB`, `BUCKET`) in Cloudflare.
4. Deploy from GitHub integration or `wrangler deploy`.
5. Frontend/mobile app can call these JSON endpoints directly.

### Worker deploy configuration (important)

- Worker entry file: `src/index.ts` (configured via `main` in `wrangler.toml`).
- Static asset directory for Worker deploys: `docs/` (configured via `assets.directory` in `wrangler.toml`).
- Do **not** use repository root (`.`) as Worker assets, because it can accidentally upload non-public files (for example `node_modules`) and exceed Cloudflare's Worker asset limits.

## GitHub Pages frontend (no build required)

- GitHub Pages entry file is `docs/index.html`.
- The page is plain HTML/CSS/JS and renders immediately without any framework build step.
- Set Worker URL in `docs/index.html` by assigning `window.WORKER_BASE_URL` (or by storing `CARD_VAULT_WORKER_URL` in `localStorage`).
  - Example: `https://cardsafehq-api.<your-subdomain>.workers.dev`
- Frontend buttons call:
  - `GET /api/health`
  - `GET /api/cards`
  against the configured Worker base URL.

## CORS configuration

- The Worker returns CORS headers on success and error responses, including preflight `OPTIONS`.
- By default:
  - Uses `env.CORS_ORIGIN` if configured.
  - Otherwise reflects `.github.io` request origins.
  - Falls back to `*` for MVP compatibility.

## Notes on MVP scope

- Grading output is intentionally labeled **AI Estimated Grade** and is non-official.
- Mock sales comps provider is intentionally used first for deterministic testing.
- Comments in the code identify where future marketplace, catalog, OAuth, and CV/ML integrations should be added.
