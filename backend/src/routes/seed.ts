/**
 * POST /api/admin/seed/pokemon
 *
 * Seeds the pokemon_catalog table with every card from every Pokémon TCG set.
 * Runs incrementally — already-seeded sets are skipped unless ?force=1 is passed.
 * Designed to be called once (or periodically) by an admin to keep the catalog fresh.
 *
 * The catalog is used by the vision/identification pipeline to do exact lookups
 * by card number + set instead of relying solely on AI guessing.
 */

import type { Env, User } from '../types';
import { ok, badRequest, serverError } from '../lib/json';
import { run, queryOne, queryAll } from '../lib/db';
import { getAllSets, getSetCards, extractTCGPlayerPrice } from '../lib/pokemontcg';
import type { PokemonTCGCard } from '../lib/pokemontcg';

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardToRow(card: PokemonTCGCard) {
  const price = extractTCGPlayerPrice(card);
  return {
    ptcg_id: card.id,
    card_name: card.name,
    card_number: card.number,
    set_id: card.set.id,
    set_name: card.set.name,
    series: card.set.series ?? null,
    rarity: card.rarity ?? null,
    supertype: card.supertype ?? null,
    subtypes: card.subtypes ? JSON.stringify(card.subtypes) : null,
    hp: card.hp ?? null,
    image_small: card.images?.small ?? null,
    image_large: card.images?.large ?? null,
    tcgplayer_url: price.url,
    tcgplayer_market_cents: price.market,
    tcgplayer_low_cents: price.low,
    legality_standard: card.legalities?.standard ?? null,
    legality_expanded: card.legalities?.expanded ?? null,
  };
}

async function upsertCard(db: D1Database, card: PokemonTCGCard): Promise<void> {
  const r = cardToRow(card);
  await run(
    db,
    `INSERT INTO pokemon_catalog (
       ptcg_id, card_name, card_number, set_id, set_name, series,
       rarity, supertype, subtypes, hp, image_small, image_large,
       tcgplayer_url, tcgplayer_market_cents, tcgplayer_low_cents,
       legality_standard, legality_expanded, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(ptcg_id) DO UPDATE SET
       card_name = excluded.card_name,
       card_number = excluded.card_number,
       set_name = excluded.set_name,
       series = excluded.series,
       rarity = excluded.rarity,
       supertype = excluded.supertype,
       subtypes = excluded.subtypes,
       hp = excluded.hp,
       image_small = excluded.image_small,
       image_large = excluded.image_large,
       tcgplayer_url = excluded.tcgplayer_url,
       tcgplayer_market_cents = excluded.tcgplayer_market_cents,
       tcgplayer_low_cents = excluded.tcgplayer_low_cents,
       legality_standard = excluded.legality_standard,
       legality_expanded = excluded.legality_expanded,
       updated_at = CURRENT_TIMESTAMP`,
    [
      r.ptcg_id, r.card_name, r.card_number, r.set_id, r.set_name, r.series,
      r.rarity, r.supertype, r.subtypes, r.hp, r.image_small, r.image_large,
      r.tcgplayer_url, r.tcgplayer_market_cents, r.tcgplayer_low_cents,
      r.legality_standard, r.legality_expanded,
    ],
  );
}

// ── Seed a single set ─────────────────────────────────────────────────────────

async function seedSet(
  db: D1Database,
  apiKey: string,
  setId: string,
  setName: string,
): Promise<number> {
  let page = 1;
  let totalSeeded = 0;

  while (true) {
    const { cards, totalCount } = await getSetCards(apiKey, setId, page);
    if (cards.length === 0) break;

    // Batch upserts — D1 supports up to 100 statements per batch
    const BATCH = 50;
    for (let i = 0; i < cards.length; i += BATCH) {
      const chunk = cards.slice(i, i + BATCH);
      // Use individual awaited upserts (D1 batch has size limits)
      for (const card of chunk) {
        await upsertCard(db, card);
      }
    }

    totalSeeded += cards.length;
    if (totalSeeded >= totalCount || cards.length < 250) break;
    page++;
  }

  // Mark set as seeded
  await run(
    db,
    `INSERT INTO pokemon_catalog_sets (set_id, set_name, total_cards, seeded_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(set_id) DO UPDATE SET
       total_cards = excluded.total_cards,
       seeded_at = CURRENT_TIMESTAMP`,
    [setId, setName, totalSeeded],
  );

  return totalSeeded;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function seedPokemonCatalog(
  env: Env,
  request: Request,
  user: User,
): Promise<Response> {
  // Admin-only guard
  const ADMIN_EMAIL = env.ADMIN_EMAIL ?? 'michaelamarino16@gmail.com';
  if (user.email !== ADMIN_EMAIL) {
    return badRequest('Admin access required');
  }

  if (!env.POKEMON_TCG_API_KEY) {
    return badRequest('POKEMON_TCG_API_KEY not configured');
  }

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const setFilter = url.searchParams.get('set'); // optional: seed only one set
  const allSets = url.searchParams.get('all') === '1'; // include vintage sets

  try {
    // Get all sets (modern by default, all if ?all=1)
    const sets = await getAllSets(env.POKEMON_TCG_API_KEY, !allSets);

    if (sets.length === 0) {
      return badRequest('No sets returned from PTCG API — check POKEMON_TCG_API_KEY');
    }

    // Get already-seeded set IDs
    const seededRows = await queryAll<{ set_id: string }>(
      env.DB,
      'SELECT set_id FROM pokemon_catalog_sets',
      [],
    );
    const seededIds = new Set(seededRows.map((r) => r.set_id));

    // Filter to only the sets we need to seed
    const toSeed = sets.filter((s) => {
      if (setFilter && s.id !== setFilter) return false;
      if (!force && seededIds.has(s.id)) return false;
      return true;
    });

    if (toSeed.length === 0) {
      return ok({
        message: 'All sets already seeded. Pass ?force=1 to re-seed.',
        total_sets: sets.length,
        already_seeded: seededIds.size,
        seeded_now: 0,
        total_cards: 0,
      });
    }

    let totalCards = 0;
    const results: Array<{ set_id: string; set_name: string; cards: number }> = [];

    for (const set of toSeed) {
      try {
        const count = await seedSet(env.DB, env.POKEMON_TCG_API_KEY, set.id, set.name);
        totalCards += count;
        results.push({ set_id: set.id, set_name: set.name, cards: count });
        console.log(`[seed] Seeded ${count} cards for ${set.name} (${set.id})`);
      } catch (err) {
        console.error(`[seed] Failed to seed set ${set.id}:`, err);
        results.push({ set_id: set.id, set_name: set.name, cards: -1 });
      }
    }

    return ok({
      message: `Seeded ${totalCards} cards across ${results.filter((r) => r.cards >= 0).length} sets`,
      total_sets: sets.length,
      already_seeded: seededIds.size,
      seeded_now: results.filter((r) => r.cards >= 0).length,
      total_cards: totalCards,
      results,
    });
  } catch (err) {
    console.error('[seed] seedPokemonCatalog error:', err);
    return serverError();
  }
}

// ── GET /api/admin/seed/pokemon/status ────────────────────────────────────────

export async function getSeedStatus(env: Env, user: User): Promise<Response> {
  const ADMIN_EMAIL = env.ADMIN_EMAIL ?? 'michaelamarino16@gmail.com';
  if (user.email !== ADMIN_EMAIL) {
    return badRequest('Admin access required');
  }

  const seededSets = await queryAll<{
    set_id: string;
    set_name: string;
    total_cards: number;
    seeded_at: string;
  }>(env.DB, 'SELECT * FROM pokemon_catalog_sets ORDER BY seeded_at DESC', []);

  const totalCatalogCards = await queryOne<{ cnt: number }>(
    env.DB,
    'SELECT COUNT(*) as cnt FROM pokemon_catalog',
    [],
  );

  return ok({
    total_catalog_cards: totalCatalogCards?.cnt ?? 0,
    seeded_sets: seededSets.length,
    sets: seededSets,
  });
}

// ── GET /api/catalog/pokemon/lookup ──────────────────────────────────────────
// Public endpoint for the vision pipeline to look up a card by number + set

export async function lookupPokemonCard(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const name = url.searchParams.get('name')?.trim();
  const number = url.searchParams.get('number')?.trim();
  const setId = url.searchParams.get('set_id')?.trim();
  const setName = url.searchParams.get('set_name')?.trim();

  if (!name && !number) {
    return badRequest('Provide at least name or number');
  }

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (number) {
    conditions.push('card_number = ?');
    params.push(number);
  }
  if (setId) {
    conditions.push('set_id = ?');
    params.push(setId);
  }
  if (setName) {
    conditions.push('set_name LIKE ?');
    params.push(`%${setName}%`);
  }
  if (name && conditions.length === 0) {
    // Fallback: name-only search
    conditions.push('card_name LIKE ?');
    params.push(`%${name}%`);
  } else if (name) {
    conditions.push('card_name LIKE ?');
    params.push(`%${name}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await queryAll<{
    ptcg_id: string;
    card_name: string;
    card_number: string;
    set_id: string;
    set_name: string;
    series: string;
    rarity: string;
    image_small: string;
    image_large: string;
    tcgplayer_url: string;
    tcgplayer_market_cents: number;
    legality_standard: string;
    legality_expanded: string;
  }>(env.DB, `SELECT * FROM pokemon_catalog ${where} LIMIT 10`, params);

  return ok({ results: rows, count: rows.length });
}
