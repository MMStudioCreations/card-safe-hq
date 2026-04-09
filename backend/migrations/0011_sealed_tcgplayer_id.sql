-- Migration: 0011_sealed_tcgplayer_id
-- Adds tcgplayer_product_id column to sealed_products if not already present
-- (safe to run even if 0010 already created the column)
ALTER TABLE sealed_products ADD COLUMN IF NOT EXISTS tcgplayer_product_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_sealed_tcgplayer_id ON sealed_products(tcgplayer_product_id);
