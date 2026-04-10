import type { Env, User } from '../types';
import { queryOne, run } from '../lib/db';
import { badRequest, notFound, ok, serverError } from '../lib/json';
import { asInt, asString, parseJsonBody } from '../lib/validation';
import { identifyCard, r2KeyToDataUrl, type CardIdentification } from '../lib/vision';

interface CollectionItemRow {
  id: number;
  user_id: number;
  front_image_url: string | null;
}

interface PendingIdentificationRow {
  id: number;
  collection_item_id: number;
  suggestions: string;
  confirmed: number;
}

// ── POST /api/vision/identify ─────────────────────────────────────────────────

interface CollectionItemFullRow extends CollectionItemRow {
  product_type: string | null;
  product_name: string | null;
}

export async function identifyCollectionItem(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<{ collectionItemId?: unknown }>(request);
  if (body instanceof Response) return body;

  const collectionItemId = Number(body.collectionItemId);
  if (!Number.isInteger(collectionItemId) || collectionItemId <= 0) {
    return badRequest('collectionItemId must be a positive integer');
  }

  const item = await queryOne<CollectionItemFullRow>(
    env.DB,
    'SELECT id, user_id, front_image_url, product_type, product_name FROM collection_items WHERE id = ? AND user_id = ?',
    [collectionItemId, user.id],
  );
  if (!item) return notFound('Collection item not found');

  // ── Sealed product fast-path: skip AI identification ──────────────────────
  // Sealed products (packs, boxes, ETBs, tins, bundles) don't need card AI.
  // Instead we create a minimal card record using the product_name and fetch
  // eBay comps to populate pricing.
  const SEALED_TYPES = new Set([
    'booster_pack', 'booster_box', 'etb', 'elite_trainer_box',
    'tin', 'mini_tin', 'bundle', 'booster_bundle', 'promo_pack', 'other_sealed',
    'ultra_premium_collection', 'premium_collection', 'special_collection', 'super_premium_collection',
    'figure_collection', 'poster_collection', 'pin_collection', 'collection_box',
    'build_and_battle', 'battle_deck', 'theme_deck', 'blister_pack', 'gift_set',
    'binder_collection', 'world_championship_deck', 'ex_box',
  ]);
  if (item.product_type && SEALED_TYPES.has(item.product_type)) {
    const productName = item.product_name ?? item.product_type ?? 'Sealed Product';

    // Upsert a card record for this sealed product
    const existingCard = await queryOne<{ id: number }>(
      env.DB,
      `SELECT id FROM cards WHERE card_name = ? AND game = 'sealed' LIMIT 1`,
      [productName],
    );
    let cardId: number;
    if (existingCard) {
      cardId = existingCard.id;
    } else {
      await run(
        env.DB,
        `INSERT INTO cards (game, card_name, set_name) VALUES ('sealed', ?, ?)`,
        [productName, item.product_type],
      );
      const newCard = await queryOne<{ id: number }>(env.DB, 'SELECT id FROM cards WHERE id = last_insert_rowid()');
      if (!newCard) return serverError('Failed to create sealed product card record');
      cardId = newCard.id;
    }

    // Link collection item to card record
    await run(
      env.DB,
      `UPDATE collection_items SET card_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [cardId, collectionItemId, user.id],
    );

    // Fetch eBay comps in background for sealed pricing
    if (env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) {
      const { fetchEbayComps } = await import('../lib/ebay');
      fetchEbayComps(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET, {
        player_name: productName,
        year: null,
        set_name: null,
        card_number: null,
        variation: null,
      } as any).then(async (comps) => {
        for (const comp of comps) {
          try {
            await run(
              env.DB,
              `INSERT INTO sales_comps (card_id, source, title, sold_price_cents, sold_date, sold_platform, listing_url, condition_text)
               VALUES (?, 'ebay_sold', ?, ?, ?, 'eBay', ?, ?)`,
              [cardId, comp.title, comp.sold_price_cents, comp.sold_date, comp.listing_url, comp.condition_text],
            );
          } catch { /* ignore comp insert errors */ }
        }
        // Update estimated value from first comp
        if (comps.length > 0) {
          const avgCents = Math.round(comps.reduce((s, c) => s + c.sold_price_cents, 0) / comps.length);
          await run(env.DB, `UPDATE collection_items SET estimated_value_cents = ? WHERE id = ?`, [avgCents, collectionItemId]);
        }
      }).catch((err) => console.error('[vision] sealed eBay comps failed:', err));
    }

    return ok({
      collection_item_id: collectionItemId,
      sealed: true,
      product_type: item.product_type,
      product_name: productName,
      card_id: cardId,
    }, 201);
  }

  // ── Single card AI identification path ────────────────────────────────────
  if (!item.front_image_url) return badRequest('Collection item has no front image — upload one first');

  // front_image_url is an R2 key; read bytes and encode as base64 data URL
  const dataUrl = await r2KeyToDataUrl(env, item.front_image_url);
  if (!dataUrl) return badRequest('Front image not found in storage — re-upload the image');

  const identification = await identifyCard(env, dataUrl);

  await run(
    env.DB,
    `INSERT INTO pending_identifications (collection_item_id, suggestions, confirmed)
     VALUES (?, ?, 0)`,
    [collectionItemId, JSON.stringify(identification)],
  );

  return ok({ collection_item_id: collectionItemId, identification }, 201);
}

// ── POST /api/vision/confirm/:collectionItemId ────────────────────────────────

export async function confirmIdentification(
  env: Env,
  request: Request,
  user: User,
  collectionItemId: number,
): Promise<Response> {
  const item = await queryOne<CollectionItemRow>(
    env.DB,
    'SELECT id FROM collection_items WHERE id = ? AND user_id = ?',
    [collectionItemId, user.id],
  );
  if (!item) return notFound('Collection item not found');

  const pending = await queryOne<PendingIdentificationRow>(
    env.DB,
    `SELECT id FROM pending_identifications
     WHERE collection_item_id = ? AND confirmed = 0
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [collectionItemId],
  );
  if (!pending) return notFound('No pending identification found for this item');

  const body = await parseJsonBody<Partial<CardIdentification>>(request);
  if (body instanceof Response) return body;

  try {
    const playerName    = asString(body.player_name,    'player_name',    200);
    const setName       = asString(body.set_name,       'set_name',       200);
    const cardNumber    = asString(body.card_number,    'card_number',     50);
    const sport         = asString(body.sport,          'sport',          100);
    const variation     = asString(body.variation,      'variation',      200);
    const manufacturer  = asString(body.manufacturer,   'manufacturer',   100);
    const conditionNote = asString(body.condition_notes,'condition_notes',1000);
    const year          = asInt(body.year,              'year',           1800, 2100);

    // Build the card_name from what we know: prefer player_name, fallback to set_name or generic
    const cardName = playerName ?? setName ?? 'Unknown Card';
    const game     = sport ?? 'Unknown';

    // Build a deduplication-friendly external_ref from the most stable identifiers
    const externalRef = [manufacturer, year != null ? String(year) : null, cardNumber]
      .filter(Boolean)
      .join(':') || null;

    // Try to find an existing card with the same logical identity to avoid duplicates
    const existingCard = await queryOne<{ id: number }>(
      env.DB,
      `SELECT id FROM cards
       WHERE card_name = ?
         AND game = ?
         AND COALESCE(set_name, '') = COALESCE(?, '')
         AND COALESCE(card_number, '') = COALESCE(?, '')
       LIMIT 1`,
      [cardName, game, setName, cardNumber],
    );

    let cardId: number;

    if (existingCard) {
      cardId = existingCard.id;
    } else {
      await run(
        env.DB,
        `INSERT INTO cards (game, set_name, card_name, card_number, rarity, image_url, external_ref)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
        [game, setName, cardName, cardNumber, variation, externalRef],
      );

      const newCard = await queryOne<{ id: number }>(
        env.DB,
        'SELECT id FROM cards WHERE id = last_insert_rowid()',
      );
      if (!newCard) return serverError('Failed to create card record');
      cardId = newCard.id;
    }

    // Link the collection item to the card and persist any condition notes
    await run(
      env.DB,
      `UPDATE collection_items
       SET card_id = ?, condition_note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [cardId, conditionNote, collectionItemId, user.id],
    );

    // Mark all unconfirmed pending identifications for this item as confirmed
    await run(
      env.DB,
      `UPDATE pending_identifications
       SET confirmed = 1
       WHERE collection_item_id = ? AND confirmed = 0`,
      [collectionItemId],
    );

    return ok({ card_id: cardId, collection_item_id: collectionItemId, confirmed: true });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid confirmation payload');
  }
}
