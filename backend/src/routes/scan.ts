import type { Env, User } from '../types';
import { queryOne, run } from '../lib/db';
import { badRequest, ok, serverError } from '../lib/json';
import { analyzeSheet } from '../lib/anthropic';
import { fetchEbayComps } from '../lib/ebay';
import { identifyCard, correctCardSet } from '../lib/vision';
import { cropCardFromSheet } from '../lib/crop';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    default: return 'jpg';
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary);
}

// ─── Sheet Scan ───────────────────────────────────────────────────────────────

export async function handleSheetScan(env: Env, request: Request, user: User): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('Request must be multipart/form-data');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return badRequest('Missing "file" field in form data');
  if (!ALLOWED_MIME_TYPES.has(file.type)) return badRequest('Unsupported image type. Use JPEG, PNG, or WebP.');

  const fileBuffer = await file.arrayBuffer();
  if (fileBuffer.byteLength === 0 || fileBuffer.byteLength > MAX_FILE_SIZE) {
    return badRequest('File must be between 1 byte and 20MB');
  }

  // Upload sheet to R2
  const timestamp = Date.now();
  const ext = mimeToExt(file.type);
  const sheetKey = `sheets/${user.id}/${timestamp}-sheet.${ext}`;

  try {
    await env.BUCKET.put(sheetKey, fileBuffer, {
      httpMetadata: { contentType: file.type },
    });
  } catch (err) {
    console.error('R2 upload failed:', err);
    return serverError('Failed to upload sheet image');
  }

  const mode = (formData.get('mode') as string | null) ?? 'sheet';

  // ─── Single card scan path ────────────────────────────────────────────────
  if (mode === 'single') {
    const cardKey = `cards/${user.id}/${timestamp}-card.${ext}`;
    try {
      await env.BUCKET.put(cardKey, fileBuffer, {
        httpMetadata: { contentType: file.type },
      });
    } catch (err) {
      console.error('R2 upload failed (single card):', err);
      return serverError('Failed to upload card image');
    }

    let ident;
    try {
      const imageBase64 = arrayBufferToBase64(fileBuffer);
      const dataUrl = `data:${file.type};base64,${imageBase64}`;
      ident = await identifyCard(env, dataUrl);
    } catch (err) {
      console.error('Single card identification failed:', err);
      return serverError(`AI identification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    const cardName = ident.card_name ?? ident.player_name ?? 'Unknown Card';
    const game = ident.game ?? ident.sport ?? 'Unknown';
    const setName = ident.set_name_override ?? ident.ptcg_set_name ?? ident.set_name;
    const yearValue = ident.year && Number.isFinite(ident.year) ? ident.year : null;
    const externalRef = ident.ptcg_id ??
      ([ident.manufacturer, ident.year, ident.card_number].filter(Boolean).join(':') || null);

    const existingCard = await queryOne<{ id: number }>(
      env.DB,
      `SELECT id FROM cards
       WHERE card_name = ?
         AND game = ?
         AND COALESCE(card_number, '') = COALESCE(?, '')
       LIMIT 1`,
      [cardName, game, ident.card_number ?? null],
    );

    let cardId: number;
    if (existingCard) {
      cardId = existingCard.id;
      await run(
        env.DB,
        `UPDATE cards SET
           set_name      = COALESCE(set_name, ?),
           rarity        = COALESCE(rarity, ?),
           image_url     = COALESCE(image_url, ?),
           external_ref  = COALESCE(external_ref, ?),
           sport         = COALESCE(sport, ?),
           player_name   = COALESCE(player_name, ?),
           year          = COALESCE(year, ?),
           variation     = COALESCE(variation, ?),
           manufacturer  = COALESCE(manufacturer, ?),
           updated_at    = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          setName ?? null,
          ident.ptcg_rarity ?? null,
          ident.ptcg_image_large ?? ident.ptcg_image_small ?? null,
          externalRef,
          ident.sport ?? null,
          ident.player_name ?? null,
          yearValue,
          ident.variation ?? null,
          ident.manufacturer ?? null,
          cardId,
        ],
      );
    } else {
      await run(
        env.DB,
        `INSERT INTO cards
           (game, set_name, card_name, card_number, rarity, image_url, external_ref,
            sport, player_name, year, variation, manufacturer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          game,
          setName ?? null,
          cardName,
          ident.card_number ?? null,
          ident.ptcg_rarity ?? ident.variation ?? null,
          ident.ptcg_image_large ?? ident.ptcg_image_small ?? null,
          externalRef,
          ident.sport ?? null,
          ident.player_name ?? null,
          yearValue,
          ident.variation ?? null,
          ident.manufacturer ?? null,
        ],
      );
      const newCard = await queryOne<{ id: number }>(
        env.DB,
        'SELECT id FROM cards WHERE id = last_insert_rowid()',
      );
      if (!newCard) return serverError('Failed to create card record');
      cardId = newCard.id;
    }

    const estimatedValueCents = ident.price_market_cents ?? ident.price_mid_cents ?? 0;

    await run(
      env.DB,
      `INSERT INTO collection_items
         (user_id, card_id, quantity, condition_note, estimated_value_cents,
          front_image_url, product_type)
       VALUES (?, ?, 1, ?, ?, ?, 'single_card')`,
      [user.id, cardId, ident.condition_notes ?? null, estimatedValueCents, cardKey],
    );

    const newItem = await queryOne<{ id: number }>(
      env.DB,
      'SELECT id FROM collection_items WHERE id = last_insert_rowid()',
    );
    if (!newItem) return serverError('Failed to create collection item');

    const fullItem = await queryOne<Record<string, unknown>>(
      env.DB,
      `SELECT ci.*, c.game, c.set_name, c.card_name, c.card_number, c.rarity,
              c.sport, c.player_name, c.year, c.variation, c.manufacturer, c.image_url
       FROM collection_items ci
       LEFT JOIN cards c ON ci.card_id = c.id
       WHERE ci.id = ?`,
      [newItem.id],
    );

    return ok({
      card: {
        ...(fullItem ?? {}),
        ptcg_confirmed: ident.ptcg_confirmed,
        ptcg_id: ident.ptcg_id,
        ptcg_set_name: ident.ptcg_set_name,
        ptcg_image_large: ident.ptcg_image_large,
        ptcg_tcgplayer_url: ident.ptcg_tcgplayer_url,
        price_market_cents: ident.price_market_cents,
        price_low_cents: ident.price_low_cents,
        price_high_cents: ident.price_high_cents,
        price_psa9_cents: ident.price_psa9_cents,
        price_psa10_cents: ident.price_psa10_cents,
        price_source: ident.price_source,
        identification_confidence: ident.confidence,
        front_image_url: cardKey,
      },
    });
  }

  // ─── Sheet scan path ──────────────────────────────────────────────────────

  // Analyze sheet layout with GPT-4o (bounding boxes + identification)
  let analysis;
  try {
    const imageBase64 = arrayBufferToBase64(fileBuffer);
    analysis = await analyzeSheet(env.OPENAI_API_KEY, imageBase64, file.type);
  } catch (err) {
    console.error('Sheet analysis failed:', err);
    return serverError(`AI analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  const collectionItems: Record<string, unknown>[] = [];
  const errors: Array<{ position: number; error: string }> = [];

  for (const cardData of analysis.cards) {
    try {
      // ── Crop individual card from sheet ──
      let cardImageUrl: string = sheetKey; // fallback to sheet key
      const cropBuffer = await cropCardFromSheet(fileBuffer, file.type, cardData.bbox);
      if (cropBuffer) {
        const cropKey = `cards/${user.id}/${timestamp}-card-${cardData.position}.jpg`;
        try {
          await env.BUCKET.put(cropKey, cropBuffer, {
            httpMetadata: { contentType: 'image/jpeg' },
          });
          cardImageUrl = cropKey;
        } catch (cropUploadErr) {
          console.error(`[scan] Failed to upload crop for card ${cardData.position}:`, cropUploadErr);
          // cardImageUrl stays as sheetKey fallback
        }
      } else {
        console.error(`[scan] cropCardFromSheet returned null for card ${cardData.position} — bbox:`, cardData.bbox, '— falling back to sheet key');
      }

      // ── Identify card via GPT-4o → PTCG → PriceCharting pipeline ──
      // IMPORTANT: Pass the CROPPED card image (not the full sheet) so the AI
      // sees only the individual card and can accurately read the card number.
      let identImageBuffer: ArrayBuffer;
      let identMimeType: string;
      if (cropBuffer) {
        // Use the upscaled crop for identification
        identImageBuffer = cropBuffer;
        identMimeType = 'image/jpeg';
      } else {
        // Fallback: use the full sheet (less accurate)
        identImageBuffer = fileBuffer;
        identMimeType = file.type;
      }
      const identBase64 = arrayBufferToBase64(identImageBuffer);
      const dataUrl = `data:${identMimeType};base64,${identBase64}`;
      const ident = await identifyCard(env, dataUrl);

      // ── Resolve canonical card name and game ──
      const cardName = ident.card_name ?? ident.player_name ?? 'Unknown Card';
      const game = ident.game ?? ident.sport ?? 'Unknown';
      const setName = ident.set_name_override ?? ident.ptcg_set_name ?? ident.set_name;
      const yearValue = ident.year && Number.isFinite(ident.year) ? ident.year : null;
     const externalRef = ident.ptcg_id ??
    ([ident.manufacturer, ident.year, ident.card_number].filter(Boolean).join(':') || null);

      // ── Upsert card record ──
      const existingCard = await queryOne<{ id: number }>(
        env.DB,
        `SELECT id FROM cards
         WHERE card_name = ?
           AND game = ?
           AND COALESCE(card_number, '') = COALESCE(?, '')
         LIMIT 1`,
        [cardName, game, ident.card_number ?? null],
      );

      let cardId: number;

      if (existingCard) {
        cardId = existingCard.id;
        await run(
          env.DB,
          `UPDATE cards SET
             set_name      = COALESCE(set_name, ?),
             rarity        = COALESCE(rarity, ?),
             image_url     = COALESCE(image_url, ?),
             external_ref  = COALESCE(external_ref, ?),
             sport         = COALESCE(sport, ?),
             player_name   = COALESCE(player_name, ?),
             year          = COALESCE(year, ?),
             variation     = COALESCE(variation, ?),
             manufacturer  = COALESCE(manufacturer, ?),
             updated_at    = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            setName ?? null,
            ident.ptcg_rarity ?? null,
            ident.ptcg_image_large ?? ident.ptcg_image_small ?? null,
            externalRef,
            ident.sport ?? null,
            ident.player_name ?? null,
            yearValue,
            ident.variation ?? null,
            ident.manufacturer ?? null,
            cardId,
          ],
        );
      } else {
        await run(
          env.DB,
          `INSERT INTO cards
             (game, set_name, card_name, card_number, rarity, image_url, external_ref,
              sport, player_name, year, variation, manufacturer)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            game,
            setName ?? null,
            cardName,
            ident.card_number ?? null,
            ident.ptcg_rarity ?? ident.variation ?? null,
            ident.ptcg_image_large ?? ident.ptcg_image_small ?? null,
            externalRef,
            ident.sport ?? null,
            ident.player_name ?? null,
            yearValue,
            ident.variation ?? null,
            ident.manufacturer ?? null,
          ],
        );

        const newCard = await queryOne<{ id: number }>(
          env.DB,
          'SELECT id FROM cards WHERE id = last_insert_rowid()',
        );
        if (!newCard) throw new Error('Failed to create card record');
        cardId = newCard.id;
      }

      // ── Resolve estimated value from real pricing data ──
      // Priority: TCGPlayer market → PriceCharting loose → sheet AI estimate fallback
      const estimatedValueCents = ident.price_market_cents
        ?? ident.price_mid_cents
        ?? cardData.estimated_value_cents
        ?? 0;

      // ── Insert collection item ──
      // Store bbox so the frontend can still use CardCrop if needed,
      // but front_image_url now points to the pre-cropped card image key.
      await run(
        env.DB,
        `INSERT INTO collection_items
           (user_id, card_id, quantity, condition_note, estimated_grade, estimated_value_cents,
            front_image_url, bbox_x, bbox_y, bbox_width, bbox_height, product_type)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'single_card')`,
        [
          user.id,
          cardId,
          ident.condition_notes ?? null,
          cardData.estimated_grade,
          estimatedValueCents,
          cardImageUrl,
          cardData.bbox.x,
          cardData.bbox.y,
          cardData.bbox.width,
          cardData.bbox.height,
        ],
      );

      const newItem = await queryOne<{ id: number }>(
        env.DB,
        'SELECT id FROM collection_items WHERE id = last_insert_rowid()',
      );
      if (!newItem) throw new Error('Failed to create collection item');
      const collectionItemId = newItem.id;

      // ── Insert grading estimate ──
      // Sheet analysis provides a grade string; component scores are null (not available from sheet scan).
      await run(
        env.DB,
        `INSERT INTO grading_estimates
           (collection_item_id, estimated_grade_range, centering_score, corners_score,
            edges_score, surface_score, confidence_score, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          collectionItemId,
          cardData.estimated_grade,
          null,
          null,
          null,
          null,
          cardData.confidence,
          null,
        ],
      );

      // ── Fetch eBay comps in background (non-blocking) ──
      if (env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) {
        const ebayClientId = env.EBAY_CLIENT_ID;
        const ebayClientSecret = env.EBAY_CLIENT_SECRET;
        const capturedCardId = cardId;

        // Build eBay ident shape from our new identification
        const ebayIdent = {
          card_number: ident.card_number,
          player_name: ident.card_name ?? ident.player_name,
          year: ident.year,
          set_name: setName ?? null,
          variation: ident.variation,
        };

        fetchEbayComps(ebayClientId, ebayClientSecret, ebayIdent as any).then(async (comps) => {
          for (const comp of comps) {
            try {
              await run(
                env.DB,
                `INSERT INTO sales_comps
                   (card_id, source, title, sold_price_cents, sold_date, sold_platform, listing_url, condition_text)
                 VALUES (?, 'ebay_sold', ?, ?, ?, 'eBay', ?, ?)`,
                [capturedCardId, comp.title, comp.sold_price_cents, comp.sold_date, comp.listing_url, comp.condition_text],
              );
            } catch (compErr) {
              console.error('Failed to save comp:', compErr);
            }
          }
        }).catch((err) => console.error('eBay comps background task failed:', err));
      }

      // ── Pull full item for response ──
      const fullItem = await queryOne<Record<string, unknown>>(
        env.DB,
        `SELECT ci.*, c.game, c.set_name, c.card_name, c.card_number, c.rarity,
                c.sport, c.player_name, c.year, c.variation, c.manufacturer, c.image_url
         FROM collection_items ci
         LEFT JOIN cards c ON ci.card_id = c.id
         WHERE ci.id = ?`,
        [collectionItemId],
      );

      if (fullItem) {
        collectionItems.push({
          ...fullItem,
          sheet_url: sheetKey,
          bbox: cardData.bbox,
          // Include identification metadata for UI display
          ptcg_confirmed: ident.ptcg_confirmed,
          ptcg_id: ident.ptcg_id,
          ptcg_set_name: ident.ptcg_set_name,
          ptcg_set_series: ident.ptcg_set_series,
          ptcg_image_large: ident.ptcg_image_large,
          ptcg_tcgplayer_url: ident.ptcg_tcgplayer_url,
          price_market_cents: ident.price_market_cents,
          price_low_cents: ident.price_low_cents,
          price_high_cents: ident.price_high_cents,
          price_psa9_cents: ident.price_psa9_cents,
          price_psa10_cents: ident.price_psa10_cents,
          price_source: ident.price_source,
          identification_confidence: ident.confidence,
        });
      }
    } catch (err) {
      console.error(`Failed to process card at position ${cardData.position}:`, err);
      errors.push({
        position: cardData.position,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return ok({
    sheet_url: sheetKey,
    cards_detected: analysis.cards.length,
    collection_items: collectionItems,
    ...(errors.length > 0 ? { errors } : {}),
  });
}

// ─── Set Correction Endpoint ──────────────────────────────────────────────────
// Called when user manually updates the set for a card after scanning
// PATCH /api/scan/correct-set

export async function handleSetCorrection(env: Env, request: Request, user: User): Promise<Response> {
  let body: { collection_item_id: number; new_set_name: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.collection_item_id || !body.new_set_name?.trim()) {
    return badRequest('collection_item_id and new_set_name are required');
  }

  // Verify the collection item belongs to this user
  const item = await queryOne<{
    id: number;
    card_id: number;
    card_name: string;
    card_number: string | null;
  }>(
    env.DB,
    `SELECT ci.id, ci.card_id, c.card_name, c.card_number
     FROM collection_items ci
     JOIN cards c ON ci.card_id = c.id
     WHERE ci.id = ? AND ci.user_id = ?`,
    [body.collection_item_id, user.id],
  );

  if (!item) return badRequest('Collection item not found');

  // Re-run identification with new set name
  const corrected = await correctCardSet(
    env,
    item.card_name,
    item.card_number,
    body.new_set_name.trim(),
  );

  // Update the card record with corrected data
  await run(
    env.DB,
    `UPDATE cards SET
       set_name     = ?,
       rarity       = COALESCE(?, rarity),
       image_url    = COALESCE(?, image_url),
       external_ref = COALESCE(?, external_ref),
       updated_at   = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      corrected.ptcg_set_name ?? body.new_set_name,
      corrected.ptcg_rarity ?? null,
      corrected.ptcg_image_large ?? corrected.ptcg_image_small ?? null,
      corrected.ptcg_id ?? null,
      item.card_id,
    ],
  );

  // Update collection item estimated value if we got new pricing
  if (corrected.price_market_cents) {
    await run(
      env.DB,
      `UPDATE collection_items SET estimated_value_cents = ? WHERE id = ?`,
      [corrected.price_market_cents, item.id],
    );
  }

  return ok({
    success: true,
    collection_item_id: item.id,
    ptcg_confirmed: corrected.ptcg_confirmed ?? false,
    ptcg_set_name: corrected.ptcg_set_name ?? body.new_set_name,
    ptcg_id: corrected.ptcg_id ?? null,
    price_market_cents: corrected.price_market_cents ?? null,
    price_psa9_cents: corrected.price_psa9_cents ?? null,
    price_psa10_cents: corrected.price_psa10_cents ?? null,
    price_source: corrected.price_source ?? null,
  });
}
