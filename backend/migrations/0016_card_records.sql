CREATE TABLE IF NOT EXISTS card_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source TEXT NOT NULL,
  game TEXT NOT NULL,
  name TEXT NOT NULL,
  clean_name TEXT NOT NULL,
  set_name TEXT,
  set_code TEXT,
  card_number TEXT,
  rarity TEXT,
  type TEXT,
  subtype TEXT,
  attribute_or_color TEXT,
  cost_or_mana TEXT,
  attack TEXT,
  defense TEXT,
  description TEXT,
  image_url TEXT,
  market_price REAL,
  low_price REAL,
  mid_price REAL,
  high_price REAL,
  last_price REAL,
  drift_7d REAL,
  volatility_7d REAL,
  sharpe_ratio REAL,
  price_date TEXT,
  searchable_text TEXT,
  is_sealed INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_card_records_game ON card_records(game);
CREATE INDEX IF NOT EXISTS idx_card_records_clean_name ON card_records(clean_name);
CREATE INDEX IF NOT EXISTS idx_card_records_set_name ON card_records(set_name);
CREATE INDEX IF NOT EXISTS idx_card_records_card_number ON card_records(card_number);
