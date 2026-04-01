import type { Env, User } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, notFound, ok } from '../lib/json';
import { asInt, asString, parseJsonBody } from '../lib/validation';

interface CollectionItem {
  id: number;
  user_id: number;
  card_id: number | null;
  quantity: number;
  condition_note: string | null;
  estimated_grade: string | null;
  estimated_value_cents: number | null;
  front_image_url: string | null;
  back_image_url: string | null;
}

export async function listCollection(env: Env, user: User, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const unconfirmed = url.searchParams.get('unconfirmed') === '1';

  if (unconfirmed) {
    // Return only items that have an unconfirmed pending identification (latest one per item)
    const rows = await queryAll<Record<string, unknown>>(
      env.DB,
      `SELECT ci.*, c.game, c.set_name, c.card_name, c.card_number, c.rarity,
              pi.id as pending_id, pi.suggestions
       FROM collection_items ci
       LEFT JOIN cards c ON ci.card_id = c.id
       JOIN (
         SELECT collection_item_id, MAX(id) as id
         FROM pending_identifications
         WHERE confirmed = 0
         GROUP BY collection_item_id
       ) latest ON latest.collection_item_id = ci.id
       JOIN pending_identifications pi ON pi.id = latest.id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at DESC`,
      [user.id],
    );
    const parsed = rows.map((r) => ({
      ...r,
      suggestions: r.suggestions ? JSON.parse(r.suggestions as string) : null,
    }));
    return ok(parsed);
  }

  const rows = await queryAll(
    env.DB,
    `SELECT ci.*,
            ci.bbox_x, ci.bbox_y, ci.bbox_width, ci.bbox_height,
            c.game, c.set_name, c.card_name, c.card_number, c.rarity,
            c.sport, c.player_name, c.year, c.variation, c.manufacturer,
            (
              SELECT sold_price_cents
              FROM sales_comps
              WHERE card_id = ci.card_id AND source = 'ebay_sold'
              ORDER BY sold_date DESC
              LIMIT 1
            ) as latest_sold_price_cents
     FROM collection_items ci
     LEFT JOIN cards c ON ci.card_id = c.id
     WHERE ci.user_id = ?
     ORDER BY ci.created_at DESC`,
    [user.id],
  );
  return ok(rows);
}

export async function createCollectionItem(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const cardId = asInt(body.card_id, 'card_id', 1, 2_147_483_647);
    const quantity = asInt(body.quantity ?? 1, 'quantity', 1, 1000) ?? 1;
    const conditionNote = asString(body.condition_note, 'condition_note', 500);
    const estimatedGrade = asString(body.estimated_grade, 'estimated_grade', 20);
    const estimatedValue = asInt(body.estimated_value_cents, 'estimated_value_cents', 0, 10_000_000);

    if (cardId) {
      const card = await queryOne(env.DB, 'SELECT id FROM cards WHERE id = ?', [cardId]);
      if (!card) return badRequest('card_id does not exist');
    }

    await run(
      env.DB,
      `INSERT INTO collection_items (user_id, card_id, quantity, condition_note, estimated_grade, estimated_value_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, cardId, quantity, conditionNote, estimatedGrade, estimatedValue],
    );

    const created = await queryOne(env.DB, 'SELECT * FROM collection_items WHERE id = last_insert_rowid()');
    return ok(created, 201);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid collection item');
  }
}

export async function getCollectionItem(env: Env, user: User, id: number): Promise<Response> {
  const item = await queryOne(
    env.DB,
    `SELECT ci.*,
            ci.bbox_x, ci.bbox_y, ci.bbox_width, ci.bbox_height,
            c.game, c.set_name, c.card_name, c.card_number, c.rarity,
            c.sport, c.player_name, c.year, c.variation, c.manufacturer,
            c.image_url
     FROM collection_items ci
     LEFT JOIN cards c ON ci.card_id = c.id
     WHERE ci.id = ? AND ci.user_id = ?`,
    [id, user.id],
  );
  if (!item) return notFound('Collection item not found');
  return ok(item);
}

export async function updateCollectionItem(env: Env, request: Request, user: User, id: number): Promise<Response> {
  const existing = await queryOne<CollectionItem>(env.DB, 'SELECT * FROM collection_items WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!existing) return notFound('Collection item not found');

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const quantity = asInt(body.quantity ?? existing.quantity, 'quantity', 1, 1000, true);
    const conditionNote = asString(body.condition_note ?? existing.condition_note, 'condition_note', 500);
    const estimatedGrade = asString(body.estimated_grade ?? existing.estimated_grade, 'estimated_grade', 20);
    const estimatedValue = asInt(
      body.estimated_value_cents ?? existing.estimated_value_cents,
      'estimated_value_cents',
      0,
      10_000_000,
    );
    const frontImageUrl = asString(body.front_image_url ?? existing.front_image_url, 'front_image_url', 500);
    const backImageUrl = asString(body.back_image_url ?? existing.back_image_url, 'back_image_url', 500);

    await run(
      env.DB,
      `UPDATE collection_items
       SET quantity = ?, condition_note = ?, estimated_grade = ?, estimated_value_cents = ?, front_image_url = ?, back_image_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [quantity, conditionNote, estimatedGrade, estimatedValue, frontImageUrl, backImageUrl, id, user.id],
    );

    const updated = await queryOne(env.DB, 'SELECT * FROM collection_items WHERE id = ? AND user_id = ?', [id, user.id]);
    return ok(updated);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid update payload');
  }
}

export async function deleteCollectionItem(env: Env, user: User, id: number): Promise<Response> {
  const existing = await queryOne(env.DB, 'SELECT id FROM collection_items WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!existing) return notFound('Collection item not found');

  await run(env.DB, 'DELETE FROM collection_items WHERE id = ? AND user_id = ?', [id, user.id]);
  return ok({ deleted: true });
}
