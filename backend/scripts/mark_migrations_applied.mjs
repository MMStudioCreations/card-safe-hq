/**
 * mark_migrations_applied.mjs
 *
 * Wrangler tracks which migrations have been applied in a table called
 * `d1_migrations` inside the D1 database.  If that table is missing or
 * incomplete (e.g. the database was set up manually before wrangler was
 * used for migrations) wrangler will try to re-run already-applied
 * migrations and fail with "duplicate column" errors.
 *
 * This script inserts rows for every migration that is already applied
 * in the live database but not yet recorded in d1_migrations.
 * It is safe to run multiple times — INSERT OR IGNORE means already-
 * recorded migrations are silently skipped.
 *
 * Usage (called from GitHub Actions before `wrangler d1 migrations apply`):
 *   node backend/scripts/mark_migrations_applied.mjs
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   D1_DATABASE_ID
 */

const ACCOUNT_ID   = process.env.CLOUDFLARE_ACCOUNT_ID
const API_TOKEN    = process.env.CLOUDFLARE_API_TOKEN
const DATABASE_ID  = process.env.D1_DATABASE_ID

if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID) {
  console.error('Missing required env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID')
  process.exit(1)
}

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`

async function d1Query(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors)}`)
  }
  return json
}

// These are the migrations that were already applied to the live database
// before wrangler migration tracking was set up.  Adjust this list if your
// database has more or fewer pre-existing migrations.
const ALREADY_APPLIED = [
  '0001_init.sql',
  '0002_vision.sql',
  '0003_cards_extended.sql',
  '0004_sealed_products.sql',
  '0005_security.sql',
  '0006_trades.sql',
  '0007_pokemon_catalog.sql',
  '0008_pokemon_catalog_seed.sql',
  '0009_email_billing.sql',
]

async function main() {
  console.log('Ensuring d1_migrations tracking table exists...')

  // Create the tracking table if it does not already exist
  // (wrangler creates this automatically, but we need it before we can insert)
  await d1Query(`
    CREATE TABLE IF NOT EXISTS d1_migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log('Marking pre-existing migrations as applied...')
  for (const name of ALREADY_APPLIED) {
    await d1Query(
      `INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)`,
      [name]
    )
    console.log(`  ✓ ${name}`)
  }

  console.log('Done. Wrangler will now only apply new migrations.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
