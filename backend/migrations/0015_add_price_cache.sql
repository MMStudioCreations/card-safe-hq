CREATE TABLE IF NOT EXISTS price_cache (
  id TEXT PRIMARY KEY,
  card_name TEXT NOT NULL,
  set_name TEXT,
  source TEXT NOT NULL,
  card_type TEXT NOT NULL,
  price_nm REAL,
  price_psa10 REAL,
  price_raw_json TEXT,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_cache_expires ON price_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_price_cache_source ON price_cache(source);
