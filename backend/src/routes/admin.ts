import type { Env, User } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, forbidden, notFound, ok, serverError } from '../lib/json';
import { asInt, asString, parseJsonBody } from '../lib/validation';

function requireAdmin(user: User): Response | null {
  if (user.is_admin !== 1) {
    return forbidden('Forbidden');
  }
  return null;
}

export async function handleAdminStats(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  try {
    const [totalUsers, totalCards, totalItems, totalScans, subStats] = await Promise.all([
      queryOne<{ count: number }>(env.DB, 'SELECT COUNT(*) as count FROM users', []),
      queryOne<{ count: number }>(env.DB, 'SELECT COUNT(*) as count FROM cards', []),
      queryOne<{ count: number }>(env.DB, 'SELECT COUNT(*) as count FROM collection_items', []),
      queryOne<{ count: number }>(
        env.DB,
        `SELECT COUNT(DISTINCT source_image_url) as count
         FROM collection_items
         WHERE source_image_url IS NOT NULL`,
        [],
      ),
      queryOne<{ free_count: number; monthly_count: number; yearly_count: number; mrr_cents: number }>(
        env.DB,
        `SELECT
           SUM(CASE WHEN s.plan = 'free' OR s.id IS NULL THEN 1 ELSE 0 END) as free_count,
           SUM(CASE WHEN s.plan = 'monthly' AND s.status = 'active' THEN 1 ELSE 0 END) as monthly_count,
           SUM(CASE WHEN s.plan = 'yearly' AND s.status = 'active' THEN 1 ELSE 0 END) as yearly_count,
           SUM(CASE WHEN s.plan = 'monthly' AND s.status = 'active' THEN 1000
                    WHEN s.plan = 'yearly' AND s.status = 'active' THEN 834
                    ELSE 0 END) as mrr_cents
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id`,
        [],
      ),
    ]);

    return ok({
      total_users: totalUsers?.count ?? 0,
      total_cards: totalCards?.count ?? 0,
      total_collection_items: totalItems?.count ?? 0,
      total_scans: totalScans?.count ?? 0,
      avg_confidence_score: null,
      free_users: subStats?.free_count ?? 0,
      monthly_subscribers: subStats?.monthly_count ?? 0,
      yearly_subscribers: subStats?.yearly_count ?? 0,
      mrr_cents: subStats?.mrr_cents ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stats query failed';
    return serverError(message);
  }
}

export async function handleAdminUsers(env: Env, user: User, request: Request): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') ?? '100', 10) || 100));
  const offset = (page - 1) * limit;

  try {
    const [countRow, rows] = await Promise.all([
      queryOne<{ total: number }>(env.DB, 'SELECT COUNT(*) as total FROM users', []),
      queryAll<{
        id: number;
        email: string;
        username: string | null;
        created_at: string;
        collection_count: number;
        plan: string | null;
        status: string | null;
        current_period_end: string | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
      }>(
        env.DB,
        `SELECT u.id, u.email, u.username, u.created_at,
                COUNT(ci.id) as collection_count,
                s.plan,
                s.status,
                s.current_period_end,
                s.stripe_customer_id,
                s.stripe_subscription_id
         FROM users u
         LEFT JOIN collection_items ci ON ci.user_id = u.id
         LEFT JOIN subscriptions s ON s.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
    ]);

    return ok({ data: rows, total_count: countRow?.total ?? 0, page, limit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Users query failed';
    return serverError(message);
  }
}

export async function handleAdminUserCollection(
  env: Env,
  user: User,
  userId: number,
  request: Request,
): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const targetUser = await queryOne<{ id: number }>(env.DB, 'SELECT id FROM users WHERE id = ?', [userId]);
  if (!targetUser) return notFound('User not found');

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    const [countRow, rows] = await Promise.all([
      queryOne<{ total: number }>(env.DB, 'SELECT COUNT(*) as total FROM collection_items WHERE user_id = ?', [userId]),
      queryAll<{
        id: number;
        card_id: number | null;
        card_name: string | null;
        set_name: string | null;
        condition_note: string | null;
        estimated_grade: string | null;
        estimated_value_cents: number | null;
        front_image_url: string | null;
        back_image_url: string | null;
        created_at: string;
      }>(
        env.DB,
        `SELECT ci.id, ci.card_id, c.card_name, c.set_name,
                ci.condition_note, ci.estimated_grade, ci.estimated_value_cents,
                ci.front_image_url, ci.back_image_url, ci.created_at
         FROM collection_items ci
         LEFT JOIN cards c ON ci.card_id = c.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
      ),
    ]);

    return ok({ data: rows, total_count: countRow?.total ?? 0, page, limit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Collection query failed';
    return serverError(message);
  }
}

export async function handleAdminImage(env: Env, user: User, request: Request): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key || key.includes('..') || !/^user-\d+\//.test(key)) {
    return badRequest('Invalid key');
  }

  const object = await env.BUCKET.get(key);
  if (!object) return notFound('Image not found');

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function handleAdminCards(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  try {
    const rows = await queryAll<{
      id: number;
      card_name: string;
      set_name: string | null;
      game: string | null;
      collection_count: number;
      avg_estimated_value_cents: number | null;
      ptcg_confirmed_count: number;
      ptcg_confirmed_rate: number | null;
    }>(
      env.DB,
      `SELECT c.id, c.card_name, c.set_name, c.game,
              COUNT(ci.id) as collection_count,
              AVG(ci.estimated_value_cents) as avg_estimated_value_cents,
              SUM(CASE WHEN ci.confirmed_at IS NOT NULL THEN 1 ELSE 0 END) as ptcg_confirmed_count,
              CASE WHEN COUNT(ci.id) > 0
                THEN ROUND(100.0 * SUM(CASE WHEN ci.confirmed_at IS NOT NULL THEN 1 ELSE 0 END) / COUNT(ci.id), 1)
                ELSE NULL
              END as ptcg_confirmed_rate
       FROM cards c
       JOIN collection_items ci ON ci.card_id = c.id
       GROUP BY c.id
       ORDER BY collection_count DESC
       LIMIT 50`,
      [],
    );

    return ok(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cards query failed';
    return serverError(message);
  }
}

export async function handleAdminActivity(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  try {
    const rows = await queryAll<{ date: string; scan_count: number }>(
      env.DB,
      `SELECT date(created_at) as date,
              COUNT(*) as scan_count
       FROM collection_items
       WHERE created_at >= date('now', '-30 days')
       GROUP BY date(created_at)
       ORDER BY date ASC`,
      [],
    );

    return ok(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Activity query failed';
    return serverError(message);
  }
}

export async function handleAdminScans(env: Env, user: User, request: Request): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  if (!['pending', 'confirmed', 'all'].includes(status)) {
    return badRequest('status must be pending, confirmed, or all');
  }
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const where = status === 'pending' ? 'WHERE pi.confirmed = 0'
    : status === 'confirmed' ? 'WHERE pi.confirmed = 1'
    : '';

  try {
    const [countRow, rows] = await Promise.all([
      queryOne<{ total: number }>(
        env.DB,
        `SELECT COUNT(*) as total FROM pending_identifications pi ${where}`,
        [],
      ),
      queryAll<{
        id: number;
        collection_item_id: number;
        confirmed: number;
        created_at: string;
        confidence_score: number | null;
        suggested_card_name: string | null;
        suggested_set_name: string | null;
        user_email: string;
        card_id: number | null;
        confirmed_card_name: string | null;
      }>(
        env.DB,
        `SELECT pi.id, pi.collection_item_id, pi.confirmed, pi.created_at,
                json_extract(pi.suggestions, '$.confidence') as confidence_score,
                json_extract(pi.suggestions, '$.card_name') as suggested_card_name,
                json_extract(pi.suggestions, '$.set_name') as suggested_set_name,
                u.email as user_email,
                ci.card_id,
                c.card_name as confirmed_card_name
         FROM pending_identifications pi
         JOIN collection_items ci ON ci.id = pi.collection_item_id
         JOIN users u ON u.id = ci.user_id
         LEFT JOIN cards c ON c.id = ci.card_id
         ${where}
         ORDER BY confidence_score ASC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      ),
    ]);

    return ok({ data: rows, total_count: countRow?.total ?? 0, page, limit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scans query failed';
    return serverError(message);
  }
}

export async function handleDeleteAdminScan(env: Env, user: User, pendingId: number): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const existing = await queryOne<{ id: number; collection_item_id: number }>(
    env.DB,
    'SELECT id, collection_item_id FROM pending_identifications WHERE id = ?',
    [pendingId],
  );
  if (!existing) return notFound('Pending identification not found');

  await run(env.DB, 'DELETE FROM pending_identifications WHERE id = ?', [pendingId]);
  return ok({ deleted: true, collection_item_id: existing.collection_item_id });
}

export async function handleAdminGetCollectionItem(env: Env, user: User, itemId: number): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const item = await queryOne(
    env.DB,
    `SELECT ci.id, ci.user_id, ci.card_id, ci.condition_note, ci.estimated_grade, ci.estimated_value_cents,
            ci.front_image_url, ci.back_image_url, ci.created_at,
            u.email as user_email,
            c.card_name, c.set_name, c.game, c.card_number, c.rarity, c.image_url, c.external_ref,
            (SELECT COUNT(*) FROM collection_items WHERE card_id = ci.card_id) as card_collection_count
     FROM collection_items ci
     JOIN users u ON u.id = ci.user_id
     LEFT JOIN cards c ON c.id = ci.card_id
     WHERE ci.id = ?`,
    [itemId],
  );
  if (!item) return notFound('Collection item not found');
  return ok(item);
}

export async function handleAdminUpdateCollectionItem(
  env: Env,
  user: User,
  itemId: number,
  request: Request,
): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const existing = await queryOne<{ id: number }>(env.DB, 'SELECT id FROM collection_items WHERE id = ?', [itemId]);
  if (!existing) return notFound('Collection item not found');

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    let cardIdChanged = false;

    if (body.condition_note !== undefined) {
      updates.push('condition_note = ?');
      params.push(asString(body.condition_note, 'condition_note', 500));
    }
    if (body.estimated_grade !== undefined) {
      updates.push('estimated_grade = ?');
      params.push(asString(body.estimated_grade, 'estimated_grade', 20));
    }
    if (body.estimated_value_cents !== undefined) {
      updates.push('estimated_value_cents = ?');
      params.push(asInt(body.estimated_value_cents, 'estimated_value_cents', 0, 10_000_000));
    }
    if (body.card_id !== undefined) {
      const cardId = asInt(body.card_id, 'card_id', 1, 2_147_483_647);
      if (cardId) {
        const card = await queryOne(env.DB, 'SELECT id FROM cards WHERE id = ?', [cardId]);
        if (!card) return badRequest('Card not found');
      }
      updates.push('card_id = ?');
      params.push(cardId);
      cardIdChanged = true;
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(itemId);
      await run(env.DB, `UPDATE collection_items SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (cardIdChanged) {
      await run(env.DB, 'UPDATE pending_identifications SET confirmed = 1 WHERE collection_item_id = ?', [itemId]);
    }

    const updated = await queryOne(
      env.DB,
      `SELECT ci.*, c.card_name, c.set_name
       FROM collection_items ci
       LEFT JOIN cards c ON ci.card_id = c.id
       WHERE ci.id = ?`,
      [itemId],
    );
    return ok(updated);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid update payload');
  }
}

export async function handleAdminUpdateCard(
  env: Env,
  user: User,
  cardId: number,
  request: Request,
): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const existing = await queryOne<{
    card_name: string;
    set_name: string | null;
    game: string;
    card_number: string | null;
    rarity: string | null;
    image_url: string | null;
    external_ref: string | null;
  }>(env.DB, 'SELECT card_name, set_name, game, card_number, rarity, image_url, external_ref FROM cards WHERE id = ?', [cardId]);
  if (!existing) return notFound('Card not found');

  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const cardName = asString(body.card_name ?? existing.card_name, 'card_name', 100, true);
    const setName = asString(body.set_name ?? existing.set_name, 'set_name', 100);
    const game = asString(body.game ?? existing.game, 'game', 50, true);
    const cardNumber = asString(body.card_number ?? existing.card_number, 'card_number', 20);
    const rarity = asString(body.rarity ?? existing.rarity, 'rarity', 50);
    const imageUrl = asString(body.image_url ?? existing.image_url, 'image_url', 500);
    const externalRef = asString(body.external_ref ?? existing.external_ref, 'external_ref', 100);

    await run(
      env.DB,
      `UPDATE cards SET card_name = ?, set_name = ?, game = ?, card_number = ?, rarity = ?, image_url = ?, external_ref = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [cardName, setName, game, cardNumber, rarity, imageUrl, externalRef, cardId],
    );

    const affectedRow = await queryOne<{ count: number }>(
      env.DB,
      'SELECT COUNT(*) as count FROM collection_items WHERE card_id = ?',
      [cardId],
    );

    return ok({ updated: true, affected_collections: affectedRow?.count ?? 0 });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid update payload');
  }
}

function validateItemIds(itemIds: unknown): number[] {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error('itemIds must be a non-empty array');
  }
  if (itemIds.length > 500) {
    throw new Error('Maximum 500 items per batch operation');
  }
  if (!itemIds.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    throw new Error('itemIds must contain only positive integers');
  }
  return itemIds as number[];
}

export async function handleAdminBatchDeleteCollection(env: Env, user: User, request: Request): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const body = await parseJsonBody<{ itemIds: unknown }>(request);
  if (body instanceof Response) return body;

  let itemIds: number[];
  try {
    itemIds = validateItemIds(body.itemIds);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid itemIds');
  }

  try {
    const placeholders = itemIds.map(() => '?').join(',');
    const rows = await queryAll<{ id: number; front_image_url: string | null; back_image_url: string | null }>(
      env.DB,
      `SELECT id, front_image_url, back_image_url FROM collection_items WHERE id IN (${placeholders})`,
      itemIds,
    );
    const foundIds = new Set(rows.map((r) => r.id));
    const skipped = itemIds.filter((id) => !foundIds.has(id));

    if (rows.length > 0) {
      await env.DB.batch(rows.map((r) => env.DB.prepare('DELETE FROM collection_items WHERE id = ?').bind(r.id)));

      for (const r of rows) {
        for (const key of [r.front_image_url, r.back_image_url]) {
          if (!key) continue;
          try {
            await env.BUCKET.delete(key);
          } catch (err) {
            console.error('Failed to delete R2 object', key, err);
          }
        }
      }
    }

    return ok({ deleted: rows.length, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch delete failed';
    return serverError(message);
  }
}

export async function handleAdminBatchReassignCollection(env: Env, user: User, request: Request): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const body = await parseJsonBody<{ itemIds: unknown; cardId: unknown }>(request);
  if (body instanceof Response) return body;

  let itemIds: number[];
  let cardId: number;
  try {
    itemIds = validateItemIds(body.itemIds);
    cardId = asInt(body.cardId, 'cardId', 1, 2_147_483_647, true) as number;
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid request body');
  }

  const card = await queryOne(env.DB, 'SELECT id FROM cards WHERE id = ?', [cardId]);
  if (!card) return badRequest('Card not found');

  try {
    const placeholders = itemIds.map(() => '?').join(',');
    const rows = await queryAll<{ id: number }>(
      env.DB,
      `SELECT id FROM collection_items WHERE id IN (${placeholders})`,
      itemIds,
    );
    const foundIds = new Set(rows.map((r) => r.id));
    const skipped = itemIds.filter((id) => !foundIds.has(id));

    if (rows.length > 0) {
      await env.DB.batch(rows.map((r) =>
        env.DB.prepare('UPDATE collection_items SET card_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(cardId, r.id),
      ));
      await env.DB.batch(rows.map((r) =>
        env.DB.prepare('UPDATE pending_identifications SET confirmed = 1 WHERE collection_item_id = ?').bind(r.id),
      ));
    }

    return ok({ reassigned: rows.length, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch reassign failed';
    return serverError(message);
  }
}

export async function handleAdminQuery(env: Env, user: User, request: Request): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const body = await parseJsonBody<{ sql: string }>(request);
  if (body instanceof Response) return body;

  const { sql } = body;
  if (typeof sql !== 'string' || !sql.trim()) {
    return badRequest('sql is required');
  }

  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return badRequest('Only SELECT queries are permitted');
  }

  // Reject anything with semicolons that could be statement chaining
  if (sql.includes(';')) {
    return badRequest('Multiple statements are not permitted');
  }

  try {
    const result = await env.DB.prepare(sql).all();
    return ok({ rows: result.results, meta: result.meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return serverError(message);
  }
}
