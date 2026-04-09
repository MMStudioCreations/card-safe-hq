-- Migration: 0011_sealed_tcgplayer_id
-- tcgplayer_product_id column was already added to sealed_products during
-- the initial 0010 table creation run. This migration is intentionally a
-- no-op so wrangler can mark it as applied without touching the schema.
SELECT 1;
