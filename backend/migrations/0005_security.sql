-- Migration: 0005_security
-- Rate limiting table and session security improvements

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Wishlist table (move from localStorage to DB for multi-user support)
CREATE TABLE IF NOT EXISTS wishlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ptcg_id TEXT NOT NULL,
  name TEXT NOT NULL,
  set_name TEXT,
  set_series TEXT,
  card_number TEXT,
  rarity TEXT,
  image_url TEXT,
  tcgplayer_price_cents INTEGER,
  tcgplayer_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ptcg_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
