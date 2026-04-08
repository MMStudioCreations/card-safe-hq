-- Comprehensive Pokémon card catalog for fast identification lookups.
-- Separate from the user-facing `cards` table to avoid polluting it with
-- 20,000+ rows that no user has scanned yet.
CREATE TABLE IF NOT EXISTS pokemon_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ptcg_id TEXT UNIQUE NOT NULL,        -- e.g. "sv3pt5-123"
  card_name TEXT NOT NULL,             -- e.g. "Salamence ex"
  card_number TEXT NOT NULL,           -- e.g. "123/197"
  set_id TEXT NOT NULL,                -- e.g. "sv3pt5"
  set_name TEXT NOT NULL,              -- e.g. "151"
  series TEXT,                         -- e.g. "Scarlet & Violet"
  rarity TEXT,
  supertype TEXT,                      -- Pokémon | Trainer | Energy
  subtypes TEXT,                       -- JSON array as text e.g. '["ex","Basic"]'
  hp TEXT,
  image_small TEXT,
  image_large TEXT,
  tcgplayer_url TEXT,
  tcgplayer_market_cents INTEGER,
  tcgplayer_low_cents INTEGER,
  legality_standard TEXT,
  legality_expanded TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pokemon_catalog_ptcg_id ON pokemon_catalog(ptcg_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_catalog_set_id  ON pokemon_catalog(set_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_catalog_name    ON pokemon_catalog(card_name);
CREATE INDEX IF NOT EXISTS idx_pokemon_catalog_number  ON pokemon_catalog(card_number);

-- Tracks which sets have been fully seeded so we can skip them on re-runs
CREATE TABLE IF NOT EXISTS pokemon_catalog_sets (
  set_id TEXT PRIMARY KEY,
  set_name TEXT NOT NULL,
  total_cards INTEGER NOT NULL DEFAULT 0,
  seeded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
