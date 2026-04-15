-- Migration 0014: Add purchase details and sold tracking to collection_items
-- Adds: date_acquired, notes, is_sold, sold_at, sold_price_cents
-- purchase_price_cents already exists from earlier migrations

ALTER TABLE collection_items ADD COLUMN date_acquired DATE;
ALTER TABLE collection_items ADD COLUMN notes TEXT;
ALTER TABLE collection_items ADD COLUMN is_sold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collection_items ADD COLUMN sold_at DATETIME;
ALTER TABLE collection_items ADD COLUMN sold_price_cents INTEGER;
