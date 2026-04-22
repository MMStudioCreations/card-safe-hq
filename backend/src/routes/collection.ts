import type { Env, User, ProductType } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, notFound, ok } from '../lib/json';
import { asInt, asString, parseJsonBody } from '../lib/validation';
import { isUserPro } from './billing';

// Free tier: max 1,000 collection items
const FREE_COLLECTION_LIMIT = 1_000;

const VALID_PRODUCT_TYPES = new Set<ProductType>([
  'single_card', 'booster_pack', 'booster_box', 'etb', 'elite_trainer_box',
  'tin', 'mini_tin', 'bundle', 'booster_bundle', 'promo_pack', 'other_sealed',
  'ultra_premium_collection', 'premium_collection', 'special_collection', 'super_premium_collection',
  'figure_collection', 'poster_collection', 'pin_collection', 'collection_box',
  'build_and_battle', 'battle_deck', 'theme_deck', 'blister_pack', 'gift_set',
  'binder_collection', 'world_championship_deck', 'ex_box',
]);

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
  product_type: string | null;
  product_name: string | null;
  purchase_price_cents: number | null;
  date_acquired: string | null;
  notes: string | null;
  is_sold: number;
  sold_at: string | null;
  sold_price_cents: number | null;
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
            c.sport, c.player_name, c.year, c.variation, c.manufacturer, c.image_url,
            (
              SELECT sold_price_cents
              FROM sales_comps
              WHERE card_id = ci.card_id
                AND source = 'ebay_sold'
              ORDER BY sold_date DESC, created_at DESC
              LIMIT 1
            ) as latest_sold_price_cents,
            (SELECT AVG(sold_price_cents)
              FROM sales_comps
              WHERE card_id = ci.card_id
                AND source = 'ebay_sold'
                AND created_at >= datetime('now', '-30 days')
            ) as avg_30d_sold_cents,
            (
              SELECT sold_price_cents
              FROM sales_comps
              WHERE card_id = ci.card_id
                AND source = 'ebay_sold'
              ORDER BY sold_date DESC, created_at DESC
              LIMIT 1 OFFSET 1
            ) as previous_sold_price_cents
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
    // ── Pro limit check: free users capped at 1,000 items ───────────────────────
    const pro = await isUserPro(env, user.id, user.email);
    if (!pro) {
      const countRow = await queryOne<{ cnt: number }>(
        env.DB,
        `SELECT COUNT(*) AS cnt FROM collection_items WHERE user_id = ?`,
        [user.id],
      );
      if ((countRow?.cnt ?? 0) >= FREE_COLLECTION_LIMIT) {
        return new Response(
          JSON.stringify({
            ok: false,
            code: 'pro_required',
            limit: FREE_COLLECTION_LIMIT,
            message: `Free accounts are limited to ${FREE_COLLECTION_LIMIT} collection items. Upgrade to Pro for unlimited storage.`,
          }),
          { status: 402, headers: { 'content-type': 'application/json' } },
        );
      }
    }
    // ──────────────────────────────────────────────────────────────────────────────────
    let cardId = asInt(body.card_id, 'card_id', 1, 2_147_483_647);
    const quantity = asInt(body.quantity ?? 1, 'quantity', 1, 1000) ?? 1;
    const conditionNote = asString(body.condition_note, 'condition_note', 500);
    const estimatedGrade = asString(body.estimated_grade, 'estimated_grade', 20);
    const estimatedValue = asInt(body.estimated_value_cents, 'estimated_value_cents', 0, 10_000_000);
    const rawProductType = asString(body.product_type, 'product_type', 50) ?? 'single_card';
    const productType = VALID_PRODUCT_TYPES.has(rawProductType as ProductType) ? rawProductType : 'single_card';
    const productName = asString(body.product_name, 'product_name', 500);
    const purchasePrice = asInt(body.purchase_price_cents, 'purchase_price_cents', 0, 100_000_000);
    const dateAcquired = asString(body.date_acquired, 'date_acquired', 20);
    const notes = asString(body.notes, 'notes', 2000);

    // ── Search-page fast path: ptcg_id provided ───────────────────────────────
    // When adding a card from search results, the frontend sends ptcg_id, card_name, set_name, etc.
    // We look up the card in the pokemon_catalog and create a cards row if needed.
    const ptcgId = asString(body.ptcg_id, 'ptcg_id', 100);
    if (ptcgId && !cardId) {
      const cardName = asString(body.card_name, 'card_name', 500);
      const setName = asString(body.set_name, 'set_name', 500);
      const cardNumber = asString(body.card_number, 'card_number', 50);
      const rarity = asString(body.rarity, 'rarity', 100);
      const imageUrl = asString(body.image_url, 'image_url', 500);

      // Try to find an existing cards row for this ptcg_id
      const existingCard = await queryOne<{ id: number }>(
        env.DB,
        `SELECT id FROM cards WHERE external_ref = ? OR (game = 'Pokemon' AND card_name = ? AND COALESCE(set_name,'') = COALESCE(?,'') AND COALESCE(card_number,'') = COALESCE(?,'')) LIMIT 1`,
        [ptcgId, cardName ?? '', setName ?? '', cardNumber ?? ''],
      );

      if (existingCard) {
        cardId = existingCard.id;
      } else {
        // Create a new cards row from catalog data
        await run(
          env.DB,
          `INSERT INTO cards (game, set_name, card_name, card_number, rarity, image_url, external_ref)
           VALUES ('Pokemon', ?, ?, ?, ?, ?, ?)`,
          [setName, cardName, cardNumber, rarity, imageUrl, ptcgId],
        );
        const newCard = await queryOne<{ id: number }>(env.DB, 'SELECT id FROM cards WHERE id = last_insert_rowid() LIMIT 1');
        if (!newCard) return badRequest('Failed to create card record');
        cardId = newCard.id;
      }
    }

    if (cardId) {
      const card = await queryOne(env.DB, 'SELECT id FROM cards WHERE id = ?', [cardId]);
      if (!card) return badRequest('card_id does not exist');
    }

    await run(
      env.DB,
      `INSERT INTO collection_items (user_id, card_id, quantity, condition_note, estimated_grade, estimated_value_cents, product_type, product_name, purchase_price_cents, date_acquired, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, cardId, quantity, conditionNote, estimatedGrade, estimatedValue, productType, productName, purchasePrice, dateAcquired, notes],
    );

    const created = await queryOne(env.DB, 'SELECT * FROM collection_items WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [user.id]);
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
            c.image_url,
            (
              SELECT sold_price_cents
              FROM sales_comps
              WHERE card_id = ci.card_id
                AND source = 'ebay_sold'
              ORDER BY sold_date DESC, created_at DESC
              LIMIT 1
            ) as latest_sold_price_cents,
            (
              SELECT AVG(sold_price_cents)
              FROM sales_comps
              WHERE card_id = ci.card_id
                AND source = 'ebay_sold'
                AND created_at >= datetime('now', '-30 days')
            ) as avg_30d_sold_cents
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
    const rawProductType = asString(body.product_type ?? existing.product_type, 'product_type', 50) ?? 'single_card';
    const productType = VALID_PRODUCT_TYPES.has(rawProductType as ProductType) ? rawProductType : 'single_card';
    const productName = asString(body.product_name ?? existing.product_name, 'product_name', 500);
    const purchasePrice = asInt(
      body.purchase_price_cents ?? existing.purchase_price_cents,
      'purchase_price_cents',
      0,
      100_000_000,
    );
    const dateAcquired = asString(body.date_acquired ?? existing.date_acquired, 'date_acquired', 20);
    const notes = asString(body.notes ?? existing.notes, 'notes', 2000);
    const isSold = body.is_sold !== undefined ? (body.is_sold ? 1 : 0) : existing.is_sold;
    const soldAt = isSold && !existing.sold_at ? (body.sold_at as string ?? new Date().toISOString()) : (existing.sold_at ?? null);
    const soldPriceCents = asInt(
      body.sold_price_cents ?? existing.sold_price_cents,
      'sold_price_cents',
      0,
      100_000_000,
    );

    const userPrefix = `user-${user.id}/`;
    if (frontImageUrl !== null && !frontImageUrl.startsWith(userPrefix)) {
      return badRequest('front_image_url is not a valid key for this user');
    }
    if (backImageUrl !== null && !backImageUrl.startsWith(userPrefix)) {
      return badRequest('back_image_url is not a valid key for this user');
    }

    await run(
      env.DB,
      `UPDATE collection_items
       SET quantity = ?, condition_note = ?, estimated_grade = ?, estimated_value_cents = ?, front_image_url = ?, back_image_url = ?, product_type = ?, product_name = ?, purchase_price_cents = ?, date_acquired = ?, notes = ?, is_sold = ?, sold_at = ?, sold_price_cents = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [quantity, conditionNote, estimatedGrade, estimatedValue, frontImageUrl, backImageUrl, productType, productName, purchasePrice, dateAcquired, notes, isSold, soldAt, soldPriceCents, id, user.id],
    );

    // If card identity fields changed, update the cards table and clear stale comps
    if ((body.card_name || body.set_name || body.card_number) && existing.card_id) {
      const updates: string[] = [];
      const params: unknown[] = [];
      if (body.card_name !== undefined) {
        updates.push('card_name = ?');
        params.push(asString(body.card_name, 'card_name', 500));
      }
      if (body.set_name !== undefined) {
        updates.push('set_name = ?');
        params.push(asString(body.set_name, 'set_name', 500));
      }
      if (body.card_number !== undefined) {
        updates.push('card_number = ?');
        params.push(asString(body.card_number, 'card_number', 50));
      }
      if (updates.length > 0) {
        params.push(existing.card_id);
        await run(env.DB, `UPDATE cards SET ${updates.join(', ')} WHERE id = ?`, params);
        await run(env.DB, 'DELETE FROM sales_comps WHERE card_id = ?', [existing.card_id]);
      }
    }

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

export async function batchDeleteCollectionItems(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<{ ids: unknown }>(request);
  if (body instanceof Response) return body;
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return badRequest('ids must be a non-empty array');
  }
  const ids = body.ids.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0);
  if (ids.length === 0) return badRequest('No valid ids provided');
  if (ids.length > 500) return badRequest('Cannot delete more than 500 items at once');
  // Only delete items that belong to this user
  const placeholders = ids.map(() => '?').join(',');
  await run(
    env.DB,
    `DELETE FROM collection_items WHERE id IN (${placeholders}) AND user_id = ?`,
    [...ids, user.id],
  );
  return ok({ deleted: ids });
}

// ── Wishlist routes ──────────────────────────────────────────────────────────

export async function listWishlist(env: Env, user: User): Promise<Response> {
  const items = await queryAll(
    env.DB,
    'SELECT * FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  return ok(items);
}

export async function addWishlistItem(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const ptcgId = asString(body.ptcg_id, 'ptcg_id', 100, true);
    const name = asString(body.name, 'name', 200, true);
    const setName = asString(body.set_name, 'set_name', 200);
    const setSeries = asString(body.set_series, 'set_series', 200);
    const cardNumber = asString(body.card_number, 'card_number', 50);
    const rarity = asString(body.rarity, 'rarity', 100);
    const imageUrl = asString(body.image_url, 'image_url', 500);
    const tcgPrice = asInt(body.tcgplayer_price_cents, 'tcgplayer_price_cents', 0, 10_000_000);
    const tcgUrl = asString(body.tcgplayer_url, 'tcgplayer_url', 500);

    await run(
      env.DB,
      `INSERT OR IGNORE INTO wishlist_items
         (user_id, ptcg_id, name, set_name, set_series, card_number, rarity, image_url, tcgplayer_price_cents, tcgplayer_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, ptcgId, name, setName, setSeries, cardNumber, rarity, imageUrl, tcgPrice, tcgUrl],
    );

    return ok({ added: true });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid wishlist item');
  }
}

export async function removeWishlistItem(env: Env, user: User, ptcgId: string): Promise<Response> {
  await run(
    env.DB,
    'DELETE FROM wishlist_items WHERE user_id = ? AND ptcg_id = ?',
    [user.id, ptcgId],
  );
  return ok({ removed: true });
}
