-- Migration: 0004_sealed_products
-- Adds product_type to collection_items to support sealed product tracking

ALTER TABLE collection_items ADD COLUMN product_type TEXT NOT NULL DEFAULT 'single_card';
-- product_type values: 'single_card' | 'booster_pack' | 'booster_box' | 'etb' | 'tin' | 'bundle' | 'promo_pack' | 'other_sealed'

ALTER TABLE collection_items ADD COLUMN product_name TEXT;
-- For sealed products: the product name (e.g. "Scarlet & Violet Booster Box")

ALTER TABLE collection_items ADD COLUMN purchase_price_cents INTEGER;
-- What the user paid — separate from market estimated_value_cents
