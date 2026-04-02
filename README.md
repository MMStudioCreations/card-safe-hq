# Card Safe HQ

A mobile-first sports and trading card collection manager. Upload card photos, let Claude Vision identify them, review AI suggestions, and track eBay market prices — all in one place.

**Stack:** React + Vite (frontend) · Cloudflare Workers + D1 + R2 (backend) · Claude claude-sonnet-4-5 Vision (card identification) · eBay HTML scraping (comps)

---

## Local dev setup

### 1. Clone and install
```bash
git clone https://github.com/your-org/card-safe-hq.git
cd card-safe-hq
npm install        # installs all workspace dependencies
```

### 2. Configure environment
```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```
VITE_API_URL=http://localhost:8787
```

For the backend, create `backend/.dev.vars` (gitignored):
```
ANTHROPIC_API_KEY=sk-ant-...
CORS_ORIGIN=http://localhost:5173
```

### 3. Apply database migrations
```bash
cd backend
npx wrangler d1 create card-safe-hq
# copy the database_id into backend/wrangler.toml
npx wrangler d1 execute card-safe-hq --local --file=migrations/0001_init.sql
npx wrangler d1 execute card-safe-hq --local --file=migrations/0002_vision.sql
```

### 4. Run locally
```bash
# Terminal 1 — backend (runs on http://localhost:8787)
cd backend && npx wrangler dev

# Terminal 2 — frontend (runs on http://localhost:5173)
cd frontend && npm run dev
```

Open http://localhost:5173 — register an account, upload a card, confirm the AI identification, and check eBay comps.

---

## Cloudflare deployment

### One-time setup
```bash
# Create D1 database
npx wrangler d1 create card-safe-hq

# Create R2 bucket
npx wrangler r2 bucket create card-safe-hq-images

# Set API key secret
npx wrangler secret put ANTHROPIC_API_KEY
```

Update `backend/wrangler.toml` with your D1 database_id, then:

```bash
# Deploy backend
cd backend && npx wrangler deploy

# Deploy frontend
cd frontend && npm run build
npx wrangler pages deploy dist --project-name=card-safe-hq
```

---

## Environment variables

| Variable | Location | Description |
|---|---|---|
| ANTHROPIC_API_KEY | backend/.dev.vars / wrangler secret | Claude Vision API key |
| CORS_ORIGIN | backend/.dev.vars / wrangler vars | Allowed frontend origin |
| VITE_API_URL | frontend/.env | Backend URL for local dev |

---

## Features

- **Scan & upload** — drag and drop, camera, or flatbed scanner images (JPEG/PNG/WEBP, up to 8MB)
- **AI identification** — Claude Vision identifies player, year, set, card number, sport, variation
- **Review queue** — confirm or edit AI suggestions before saving to your vault
- **eBay comps** — real sold listings with price range (low/avg/high) and market liquidity
- **AI grading** — estimated grade range with centering, corners, edges, surface scores
- **Collection dashboard** — filter by sport, sort by value, search by player name
- **Multi-user** — each user has a private vault, session-based auth with 30-day cookies

---

## GitHub Pages deployment (frontend only)

This repository deploys only the Vite frontend to GitHub Pages from `frontend/dist` using the workflow in `.github/workflows/deploy.yml`.

### Required repository settings

1. Open **GitHub → Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to **`gh-pages`** and folder to **`/ (root)`**.
4. Save.

The workflow builds `frontend` and publishes `frontend/dist` to the `gh-pages` branch. Since `index.html` is emitted at the root of `frontend/dist`, GitHub Pages serves the app instead of repository markdown files.
