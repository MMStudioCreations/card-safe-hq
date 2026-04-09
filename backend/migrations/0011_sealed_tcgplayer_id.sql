-- Migration: 0011_sealed_tcgplayer_id
-- Adds tcgplayer_product_id column and index to sealed_products
-- Note: SQLite/D1 does not support ADD COLUMN IF NOT EXISTS
-- This migration runs after 0010 which creates the table without this column
ALTER TABLE sealed_products ADD COLUMN tcgplayer_product_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_sealed_tcgplayer_id ON sealed_products(tcgplayer_product_id);
