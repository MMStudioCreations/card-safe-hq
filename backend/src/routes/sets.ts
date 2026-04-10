import type { Env, User } from '../types';
import { ok, badRequest } from '../lib/json';
import { getAllSets, getSetCards } from '../lib/pokemontcg';
import { queryAll, queryOne, run } from '../lib/db';
import { getUserTier } from '../lib/plan';

// GET /api/sets/pokemon
// Returns all Pokémon sets (modern by default)
export async function getPokemonSets(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';

  if (!env.POKEMON_TCG_API_KEY) {
    return ok({ sets: [], error: 'Pokemon TCG API key not configured' });
  }

  const sets = await getAllSets(env.POKEMON_TCG_API_KEY, !all);
  return ok({ sets });
}

// GET /api/sets/pokemon/:setId/checklist
// Returns full card checklist for a set with owned/missing status per user
export async function getSetChecklist(
  env: Env,
  setId: string,
  userId: number,
): Promise<Response> {
  if (!env.POKEMON_TCG_API_KEY) {
    return ok({ cards: [], owned: [], missing: [] });
  }

  // Get all cards in the set from PTCG API
  const { cards, totalCount } = await getSetCards(env.POKEMON_TCG_API_KEY, setId);

  // Get user's collection cards that match this set
  const owned = await queryAll<{
    card_name: string;
    card_number: string;
    external_ref: string;
    collection_item_id: number;
  }>(
    env.DB,
    `SELECT c.card_name, c.card_number, c.external_ref, ci.id as collection_item_id
     FROM collection_items ci
     JOIN cards c ON ci.card_id = c.id
     WHERE ci.user_id = ?
       AND (c.set_name LIKE ? OR c.external_ref LIKE ?)`,
    [userId, `%${setId}%`, `%${setId}%`],
  );

  // Build owned card number set for fast lookup
  const ownedNumbers = new Set(owned.map(o => o.card_number));
  const ownedByName = new Map(owned.map(o => [o.card_name.toLowerCase(), o]));

  // Annotate each card with owned status
  const annotated = cards.map(card => ({
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    image: card.images?.small,
    tcgplayer_price: card.tcgplayer?.prices?.holofoil?.market ??
                     card.tcgplayer?.prices?.normal?.market ?? null,
    owned: ownedNumbers.has(card.number) ||
           ownedByName.has(card.name.toLowerCase()),
    collection_item_id: ownedByName.get(card.name.toLowerCase())?.collection_item_id ?? null,
  }));

  const ownedCards = annotated.filter(c => c.owned);
  const missingCards = annotated.filter(c => !c.owned);

  return ok({
    set_id: setId,
    total_count: totalCount,
    owned_count: ownedCards.length,
    missing_count: missingCards.length,
    completion_pct: totalCount > 0
      ? Math.round((ownedCards.length / totalCount) * 100)
      : 0,
    cards: annotated,
  });
}

const FREE_DECK_CARD_LIMIT = 20;

// POST /api/decks
export async function saveDeck(env: Env, request: Request, user: User): Promise<Response> {
  const body = await request.json() as {
    name: string;
    game: string;
    format?: string;
    archetype?: string;
    cards_json: string;
    notes?: string;
  };

  // ── Free tier: limit deck size to 20 cards ─────────────────────────────────
  const tier = await getUserTier(env, user.id);
  if (tier === 'free' && body.cards_json) {
    try {
      const cards = JSON.parse(body.cards_json);
      const totalCards = Array.isArray(cards)
        ? cards.reduce((sum: number, c: { quantity?: number }) => sum + (c.quantity ?? 1), 0)
        : 0;
      if (totalCards > FREE_DECK_CARD_LIMIT) {
        return badRequest(`Free tier decks are limited to ${FREE_DECK_CARD_LIMIT} cards. Upgrade to Pro for full 60-card decks.`);
      }
    } catch {
      // Invalid JSON — let the insert fail naturally
    }
  }

  await run(
    env.DB,
    `INSERT INTO saved_decks (user_id, name, game, format, archetype, cards_json, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, body.name, body.game, body.format ?? null,
     body.archetype ?? null, body.cards_json, body.notes ?? null],
  );

  const created = await queryOne(
    env.DB,
    'SELECT id FROM saved_decks WHERE id = last_insert_rowid()',
  );
  return ok(created, 201);
}

// GET /api/decks
export async function listDecks(env: Env, user: User): Promise<Response> {
  const decks = await queryAll(
    env.DB,
    'SELECT * FROM saved_decks WHERE user_id = ? ORDER BY updated_at DESC',
    [user.id],
  );
  return ok(decks);
}
