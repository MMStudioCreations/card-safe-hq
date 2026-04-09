-- Migration: 0010_sealed_products_catalog
-- Creates the sealed_products catalog table for storing TCGCSV-synced sealed products
-- This is a separate catalog table (not collection_items) for browsing/pricing sealed products

CREATE TABLE IF NOT EXISTS sealed_products (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  set_name              TEXT,
  set_id                TEXT,
  product_type          TEXT NOT NULL DEFAULT 'other',
  tcgplayer_url         TEXT,
  market_price_cents    INTEGER,
  release_date          TEXT,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, set_name)
);

CREATE INDEX IF NOT EXISTS idx_sealed_products_set_name     ON sealed_products(set_name);
CREATE INDEX IF NOT EXISTS idx_sealed_products_product_type ON sealed_products(product_type);
