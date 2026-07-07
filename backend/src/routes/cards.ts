import type { Card, Env, User } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, forbidden, notFound, ok } from '../lib/json';
import { asString, parseJsonBody } from '../lib/validation';

type CardRow = Card;

export async function listCards(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const game = url.searchParams.get('game');
  const setName = url.searchParams.get('set_name');
  const cardName = url.searchParams.get('card_name');

  const where: string[] = [];
  const params: unknown[] = [];

  if (game) {
    where.push('c.game = ?');
    params.push(game);
  }
  if (setName) {
    where.push('c.set_name LIKE ?');
    params.push(`%${setName}%`);
  }
  if (cardName) {
    where.push('c.card_name LIKE ?');
    params.push(`%${cardName}%`);
  }

  // Future enhancement: integrate external card catalogs and sync into this table.
  const sql = `SELECT c.*, COUNT(ci.id) as collection_count
               FROM cards c
               LEFT JOIN collection_items ci ON ci.card_id = c.id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               GROUP BY c.id
               ORDER BY c.created_at DESC LIMIT 200`;
  const cards = await queryAll<CardRow & { collection_count: number }>(env.DB, sql, params);
  return ok(cards);
}

export async function createCard(env: Env, request: Request, user: User): Promise<Response> {
  if (user.is_admin !== 1) return forbidden('Forbidden');

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const game = asString(body.game, 'game', 50, true);
    const set_name = asString(body.set_name, 'set_name', 100);
    const card_name = asString(body.card_name, 'card_name', 100, true);
    const card_number = asString(body.card_number, 'card_number', 20);
    const rarity = asString(body.rarity, 'rarity', 50);
    const image_url = asString(body.image_url, 'image_url', 500);
    const external_ref = asString(body.external_ref, 'external_ref', 100);

    await run(
      env.DB,
      `INSERT INTO cards (game, set_name, card_name, card_number, rarity, image_url, external_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [game, set_name, card_name, card_number, rarity, image_url, external_ref],
    );

    const created = await queryOne<CardRow>(env.DB, 'SELECT * FROM cards WHERE id = last_insert_rowid()');
    return ok(created, 201);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid card payload');
  }
}

export async function getCard(env: Env, id: number): Promise<Response> {
  const card = await queryOne<CardRow>(env.DB, 'SELECT * FROM cards WHERE id = ?', [id]);
  if (!card) return notFound('Card not found');
  return ok(card);
}

export async function updateCard(env: Env, request: Request, id: number, user: User): Promise<Response> {
  if (user.is_admin !== 1) return forbidden('Forbidden');

  const existing = await queryOne<CardRow>(env.DB, 'SELECT * FROM cards WHERE id = ?', [id]);
  if (!existing) return notFound('Card not found');

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const game = asString(body.game ?? existing.game, 'game', 50, true);
    const set_name = asString(body.set_name ?? existing.set_name, 'set_name', 100);
    const card_name = asString(body.card_name ?? existing.card_name, 'card_name', 100, true);
    const card_number = asString(body.card_number ?? existing.card_number, 'card_number', 20);
    const rarity = asString(body.rarity ?? existing.rarity, 'rarity', 50);
    const image_url = asString(body.image_url ?? existing.image_url, 'image_url', 500);
    const external_ref = asString(body.external_ref ?? existing.external_ref, 'external_ref', 100);

    await run(
      env.DB,
      `UPDATE cards SET game = ?, set_name = ?, card_name = ?, card_number = ?, rarity = ?, image_url = ?, external_ref = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [game, set_name, card_name, card_number, rarity, image_url, external_ref, id],
    );

    const updated = await queryOne<CardRow>(env.DB, 'SELECT * FROM cards WHERE id = ?', [id]);
    return ok(updated);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid update payload');
  }
}

export async function deleteCard(env: Env, id: number, user: User): Promise<Response> {
  if (user.is_admin !== 1) return forbidden('Forbidden');

  const existing = await queryOne(env.DB, 'SELECT id FROM cards WHERE id = ?', [id]);
  if (!existing) return notFound('Card not found');

  await run(env.DB, 'DELETE FROM cards WHERE id = ?', [id]);
  return ok({ deleted: true });
}
