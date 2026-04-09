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
  hp?: number | null,
): Promise<CatalogCard | null> {

  // Parse number — preserve letter prefixes (GG39, TG25, SWSH250, etc.)
  // "GG39/GG70" → rawFirst = "GG39", setTotal = "70"
  // "200/191"   → rawFirst = "200",  setTotal = "191"
  const rawFirst = collectorNumber?.split('/')[0]?.trim() ?? null
  const numOnly = rawFirst
  const setTotal = collectorNumber?.split('/')[1]?.trim()?.replace(/^[A-Z]+/, '') ?? null

  // Layer 1: name + number exact match (most precise)
  if (cardName && numOnly) {
    const r = await db.prepare(
      `SELECT * FROM pokemon_catalog
       WHERE card_name = ? AND card_number = ?
       ORDER BY rowid DESC LIMIT 1`
    ).bind(cardName, numOnly).first<CatalogCard>()
    if (r) return r
  }

  // Layer 1b: alphanumeric prefix normalization
  // Handles GPT misreading "GG39" as "39", or "TG25" as "25", and vice versa
  if (cardName && numOnly) {

    // Case A: GPT returned plain digits but actual number has a prefix
    // e.g. GPT says "39", actual is "GG39"
    if (/^\d+$/.test(numOnly)) {
      const prefixes = ['GG', 'TG', 'SWSH', 'SV', 'SVP', 'DP', 'BW', 'XY', 'SM']
      for (const prefix of prefixes) {
        const prefixed = `${prefix}${numOnly}`
        const r = await db.prepare(
          `SELECT * FROM pokemon_catalog
           WHERE card_name = ? AND card_number = ? LIMIT 1`
        ).bind(cardName, prefixed).first<CatalogCard>()
        if (r) {
          console.log(`[catalog] prefix-added: ${cardName} #${numOnly} → #${prefixed} (${r.set_name})`)
          return r
        }
      }
    }

    // Case B: GPT returned prefixed number correctly e.g. "GG39"
    // but exact match in Layer 1 failed — try stripping prefix
    if (/^[A-Z]{2,4}\d+$/.test(numOnly)) {
      const stripped = numOnly.replace(/^[A-Z]+/, '')
      const r = await db.prepare(
        `SELECT * FROM pokemon_catalog
         WHERE card_name = ? AND card_number = ? LIMIT 1`
      ).bind(cardName, stripped).first<CatalogCard>()
      if (r) {
        console.log(`[catalog] prefix-stripped: ${cardName} #${numOnly} → #${stripped} (${r.set_name})`)
        return r
      }
    }
  }

  // Layer 1c: fuzzy number — try ±3 on the parsed number (plain digits only)
  // Handles single-digit OCR misreads on illustration rares
  if (cardName && numOnly && /^\d+$/.test(numOnly)) {
    const numInt = parseInt(numOnly)
    const candidates = await db.prepare(
      `SELECT * FROM pokemon_catalog
       WHERE card_name = ?
         AND CAST(card_number AS INTEGER) BETWEEN ? AND ?
       ORDER BY ABS(CAST(card_number AS INTEGER) - ?) ASC
       LIMIT 5`
    ).bind(cardName, numInt - 3, numInt + 3, numInt).all<CatalogCard>()

    if (candidates.results.length === 1) {
      console.log(`[catalog] fuzzy number match: ${cardName} #${numOnly} → #${candidates.results[0].card_number} (${candidates.results[0].set_name})`)
      return candidates.results[0]
    }
    // If multiple candidates, prefer the one whose number is closest
    if (candidates.results.length > 1) {
      const closest = candidates.results[0] // already sorted by ABS distance
      console.log(`[catalog] fuzzy number (multi): ${cardName} #${numOnly} → #${closest.card_number} (${closest.set_name})`)
      return closest
    }
  }

  // Layer 2: number only (handles misread names)
  if (numOnly && collectorNumber?.includes('/')) {
    const total = setTotal
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

  // Layer 2b: number + HP — for Japanese cards or cards where GPT-4o can't read the name.
  // HP is printed in large text near the top-right and is reliably read even on foreign cards.
  if (numOnly && hp != null && hp > 0) {
    const hpStr = String(hp)
    // Try exact number + HP match first
    const exact = await db.prepare(
      `SELECT * FROM pokemon_catalog
       WHERE card_number = ? AND hp = ?
       ORDER BY rowid DESC LIMIT 2`
    ).bind(numOnly, hpStr).all<CatalogCard>()
    if (exact.results.length === 1) {
      console.log(`[catalog] number+HP match: #${numOnly} HP${hp} → ${exact.results[0].card_name} (${exact.results[0].set_name})`)
      return exact.results[0]
    }
    if (exact.results.length > 1) return exact.results[0]
    // Fuzzy: number ±2 + HP (handles OCR off-by-one on collector number)
    if (/^\d+$/.test(numOnly)) {
      const numInt = parseInt(numOnly)
      const fuzzy = await db.prepare(
        `SELECT * FROM pokemon_catalog
         WHERE CAST(card_number AS INTEGER) BETWEEN ? AND ?
           AND hp = ?
         ORDER BY ABS(CAST(card_number AS INTEGER) - ?) ASC
         LIMIT 3`
      ).bind(numInt - 2, numInt + 2, hpStr, numInt).all<CatalogCard>()
      if (fuzzy.results.length >= 1) {
        console.log(`[catalog] fuzzy number+HP match: #${numOnly} HP${hp} → ${fuzzy.results[0].card_name} (${fuzzy.results[0].set_name})`)
        return fuzzy.results[0]
      }
    }
  }

  // Layer 3: name only — with rarity-aware sort for high-number / prefixed cards
  if (cardName) {
    const r = await db.prepare(
      `SELECT * FROM pokemon_catalog
       WHERE card_name = ?
       ORDER BY rowid DESC LIMIT 20`
    ).bind(cardName).all<CatalogCard>()

    if (r.results.length === 0) return null

    // For high-number or prefixed cards (GG, TG, SWSH, 150+), prefer high-rarity variants
    const isHighNumber = numOnly && (
      /^[A-Z]/.test(numOnly) ||                                   // GG39, TG25, SWSH250
      parseInt(numOnly.replace(/\D/g, '')) >= 150                 // 150+ plain numbers
    )

    if (isHighNumber) {
      const RARITY_PRIORITY: Record<string, number> = {
        'Special Illustration Rare': 10,
        'Hyper Rare': 9,
        'Ultra Rare': 8,
        'Illustration Rare': 7,
        'Rare Ultra': 7,
        'Rare Holo V': 6,
        'Rare Rainbow': 6,
        'Double Rare': 5,
        'Rare Holo': 4,
        'Rare': 3,
        'Shiny Rare': 3,
        'Uncommon': 2,
        'Common': 1,
      }
      const sorted = [...r.results].sort((a, b) => {
        const pa = RARITY_PRIORITY[a.rarity ?? ''] ?? 0
        const pb = RARITY_PRIORITY[b.rarity ?? ''] ?? 0
        return pb - pa
      })
      console.log(`[catalog] name-only high: ${cardName} #${numOnly} → ${sorted[0].ptcg_id} ${sorted[0].rarity}`)
      return sorted[0]
    }

    // Standard: return most recent
    return r.results[0]
  }

  return null
}
