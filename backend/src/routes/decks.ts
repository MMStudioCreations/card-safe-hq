import type { Env, User } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, notFound, ok } from '../lib/json';

export async function createDeck(env: Env, request: Request, user: User): Promise<Response> {
  const body = await request.json() as { name?: string; format?: string; description?: string };
  if (!body.name?.trim()) return badRequest('Deck name is required');
  await run(env.DB, 'INSERT INTO decks (user_id, name, format, description) VALUES (?, ?, ?, ?)', [
    user.id,
    body.name.trim(),
    body.format ?? null,
    body.description ?? null,
  ]);
  const deck = await queryOne(env.DB, 'SELECT * FROM decks WHERE id = last_insert_rowid()');
  return ok(deck, 201);
}

export async function listDecksV2(env: Env, user: User): Promise<Response> {
  const decks = await queryAll(env.DB, 'SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC', [user.id]);
  return ok(decks);
}

export async function getDeck(env: Env, user: User, deckId: number): Promise<Response> {
  const deck = await queryOne(env.DB, 'SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, user.id]);
  if (!deck) return notFound('Deck not found');
  const cards = await queryAll(env.DB, `SELECT dc.*, pc.card_name, pc.set_name, pc.card_number, pc.rarity, pc.image_small, pc.tcgplayer_market_cents
    FROM deck_cards dc LEFT JOIN pokemon_catalog pc ON pc.ptcg_id = dc.card_id
    WHERE dc.deck_id = ? ORDER BY dc.updated_at DESC`, [deckId]);
  return ok({ ...deck, cards });
}

export async function updateDeck(env: Env, request: Request, user: User, deckId: number): Promise<Response> {
  const body = await request.json() as { name?: string; format?: string | null; description?: string | null };
  const deck = await queryOne(env.DB, 'SELECT id FROM decks WHERE id = ? AND user_id = ?', [deckId, user.id]);
  if (!deck) return notFound('Deck not found');
  await run(env.DB, `UPDATE decks SET
    name = COALESCE(?, name),
    format = ?,
    description = ?,
    updated_at = datetime('now')
    WHERE id = ? AND user_id = ?`, [body.name ?? null, body.format ?? null, body.description ?? null, deckId, user.id]);
  return ok({ updated: true });
}

export async function deleteDeck(env: Env, user: User, deckId: number): Promise<Response> {
  const result = await run(env.DB, 'DELETE FROM decks WHERE id = ? AND user_id = ?', [deckId, user.id]);
  if (!result.success) return badRequest('Unable to delete deck');
  return ok({ deleted: true });
}

export async function upsertDeckCard(env: Env, request: Request, user: User, deckId: number): Promise<Response> {
  const body = await request.json() as { card_id?: string; quantity?: number };
  if (!body.card_id) return badRequest('card_id is required');
  const qty = Math.max(0, Math.min(99, Number(body.quantity ?? 1)));
  const deck = await queryOne(env.DB, 'SELECT id FROM decks WHERE id = ? AND user_id = ?', [deckId, user.id]);
  if (!deck) return notFound('Deck not found');

  if (qty === 0) {
    await run(env.DB, 'DELETE FROM deck_cards WHERE deck_id = ? AND card_id = ?', [deckId, body.card_id]);
  } else {
    await run(env.DB, `INSERT INTO deck_cards (deck_id, card_id, quantity)
      VALUES (?, ?, ?)
      ON CONFLICT(deck_id, card_id) DO UPDATE SET quantity = excluded.quantity, updated_at = datetime('now')`,
      [deckId, body.card_id, qty]);
  }
  await run(env.DB, "UPDATE decks SET updated_at = datetime('now') WHERE id = ?", [deckId]);
  return getDeck(env, user, deckId);
}
