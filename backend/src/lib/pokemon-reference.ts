import type { D1Database } from '@cloudflare/workers-types';

export interface CatalogCard {
  ptcg_id: string
  card_name: string
  card_number: string
  set_id: string
  set_name: string
  series: string | null
  rarity: string | null
  supertype: string | null
  subtypes: string | null
  hp: string | null
  image_small: string | null
  image_large: string | null
  tcgplayer_url: string | null
  tcgplayer_market_cents: number | null
}

export async function lookupCardInCatalog(
  db: D1Database,
  cardName: string | null,
  collectorNumber: string | null,
): Promise<CatalogCard | null> {

  // Parse number — strip total e.g. "196/197" → "196"
  const numOnly = collectorNumber?.split('/')[0]?.trim() ?? null

  // Layer 1: name + number (most precise)
  if (cardName && numOnly) {
    const r = await db.prepare(
      `SELECT * FROM pokemon_catalog
       WHERE card_name = ? AND card_number = ?
       ORDER BY rowid DESC LIMIT 1`
    ).bind(cardName, numOnly).first<CatalogCard>()
    if (r) return r
  }

  // Layer 2: number only (handles misread names)
  if (numOnly && collectorNumber?.includes('/')) {
    const total = collectorNumber.split('/')[1]?.trim()
    if (total) {
      // card_number in DB is stored without total, but set total helps narrow
      const r = await db.prepare(
        `SELECT pc.* FROM pokemon_catalog pc
         JOIN pokemon_catalog_sets pcs ON pc.set_id = pcs.set_id
         WHERE pc.card_number = ? AND pcs.total_cards = ?
         ORDER BY pc.rowid DESC LIMIT 1`
      ).bind(numOnly, parseInt(total)).first<CatalogCard>()
      if (r) return r
    }
  }

  // Layer 3: name only — most recent version
  if (cardName) {
    const r = await db.prepare(
      `SELECT * FROM pokemon_catalog
       WHERE card_name = ?
       ORDER BY rowid DESC LIMIT 1`
    ).bind(cardName).first<CatalogCard>()
    if (r) return r
  }

  return null
}
