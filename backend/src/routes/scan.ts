import type { Env, User } from '../types';
import { queryOne, run } from '../lib/db';
import { badRequest, ok, serverError } from '../lib/json';
import { fetchEbayComps } from '../lib/ebay';
import { identifyCard as visionIdentifyCard, correctCardSet } from '../lib/vision';
import { lookupCardInCatalog } from '../lib/pokemon-reference';
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

// ─── Pokemon TCG card shape ───────────────────────────────────────────────────

interface TCGCard {
  id: string;
  name: string;
  number: string;
  set: { name: string; series: string; id: string };
  rarity: string;
  images: { small: string; large: string };
  tcgplayer?: { url?: string; prices?: Record<string, { market?: number }> };
}

// ─── Fixed-grid fallback bbox ─────────────────────────────────────────────────
// Used only when GPT-4o does not return a bbox for a position.
// Approximate card cell boundaries — accounts for binder page margins and pocket borders.
function getFixedBbox(position: number) {
  const col = (position - 1) % 3;
  const row = Math.floor((position - 1) / 3);
  const colStarts = [0.03, 0.36, 0.69];
  const rowStarts = [0.04, 0.36, 0.68];
  const cellWidth = 0.28;
  const cellHeight = 0.28;
  return {
    x: colStarts[col] * 100,
    y: rowStarts[row] * 100,
    width: cellWidth * 100,
    height: cellHeight * 100,
  };
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

  // Upload original sheet to R2 (kept for reference / legacy bbox fallback)
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
      ident = await visionIdentifyCard(env, dataUrl);
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
  //
  // NEW APPROACH (v2):
  // Step 1: Send full sheet to GPT-4o to detect bounding boxes for all 9 slots.
  //         GPT-4o returns percentage-based x/y/width/height for each card position.
  //         Falls back to fixed-grid math for any position GPT-4o misses.
  // Step 2: For each detected slot, crop the card out of the sheet server-side
  //         using lib/crop.ts (OffscreenCanvas, upscaled to ≥800px short side).
  //         Upload each crop as its own JPEG to R2.
  // Step 3: Send each cropped card image to GPT-4o individually for identification.
  //         This is the same high-accuracy path used for single-card scans.
  // Step 4: Catalog lookup + DB insert per card, same as before.
  //
  // Benefits:
  // - Each card gets full-resolution focus → far better OCR of card numbers
  // - Bottom-row cards are no longer missed (each slot processed independently)
  // - front_image_url is a clean per-card JPEG, not a full sheet reference
  // - CardCrop canvas hack is no longer needed for new scans

  // ── Step 1: GPT-4o bbox detection pass ──
  const BBOX_DETECTION_PROMPT = `You are analyzing a 9-pocket Pokémon card binder page photo. The page has a 3-column × 3-row grid of card slots (positions 1–9, left→right, top→bottom).

Your job: locate each card slot in the image and return its bounding box as a percentage of the full image dimensions.

For EVERY position 1–9:
- x: left edge of the card slot as a percentage of image width (0–100)
- y: top edge of the card slot as a percentage of image height (0–100)
- width: width of the card slot as a percentage of image width (0–100)
- height: height of the card slot as a percentage of image height (0–100)

Rules:
- Include ALL 9 positions. If a slot appears empty, still return its bounding box.
- Make the bounding box tight around the card (including the card border), not the pocket border.
- Percentages must be numbers, not strings.

Return ONLY a JSON object in this exact format:
{
  "slots": [
    { "position": 1, "x": 3.5, "y": 4.0, "width": 28.0, "height": 30.0 },
    { "position": 2, "x": 36.0, "y": 4.0, "width": 28.0, "height": 30.0 },
    ...
    { "position": 9, "x": 69.0, "y": 68.0, "width": 28.0, "height": 30.0 }
  ]
}`;

  interface SlotBbox {
    position: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }

  const sheetBase64 = arrayBufferToBase64(fileBuffer);
  const detectedBboxes = new Map<number, SlotBbox>();

  try {
    const bboxController = new AbortController();
    const bboxTimeout = setTimeout(() => bboxController.abort(), 45_000);

    const bboxResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${sheetBase64}`,
                  detail: 'high',
                },
              },
              { type: 'text', text: BBOX_DETECTION_PROMPT },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: bboxController.signal,
    });

    clearTimeout(bboxTimeout);

    if (bboxResponse.ok) {
      const bboxData = await bboxResponse.json() as { choices: Array<{ message: { content: string } }> };
      const rawText = bboxData.choices?.[0]?.message?.content ?? '';
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as { slots: SlotBbox[] };
      if (Array.isArray(parsed.slots)) {
        for (const slot of parsed.slots) {
          if (
            slot.position >= 1 && slot.position <= 9 &&
            typeof slot.x === 'number' && typeof slot.y === 'number' &&
            typeof slot.width === 'number' && typeof slot.height === 'number' &&
            slot.width > 1 && slot.height > 1 // sanity: must be non-trivial
          ) {
            detectedBboxes.set(slot.position, slot);
          }
        }
      }
      console.log(`[scan] GPT-4o detected ${detectedBboxes.size} slot bboxes`);
    } else {
      const errBody = await bboxResponse.text();
      console.error('[scan] GPT-4o bbox detection error:', bboxResponse.status, errBody);
    }
  } catch (err) {
    console.error('[scan] GPT-4o bbox detection failed:', err);
  }

  // Fill any missing positions with fixed-grid fallback
  for (let p = 1; p <= 9; p++) {
    if (!detectedBboxes.has(p)) {
      console.warn(`[scan] pos ${p}: no GPT-4o bbox — using fixed-grid fallback`);
      const fb = getFixedBbox(p);
      detectedBboxes.set(p, { position: p, ...fb });
    }
  }

  // ── Steps 2–4: Crop each slot, identify individually, insert ──
  const collectionItems: Record<string, unknown>[] = [];
  const errors: Array<{ position: number; error: string }> = [];

  for (let position = 1; position <= 9; position++) {
    try {
      const bbox = detectedBboxes.get(position)!;

      // Step 2: Crop the slot from the sheet
      const cropBuffer = await cropCardFromSheet(fileBuffer, file.type, {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });

      if (!cropBuffer) {
        console.warn(`[scan] pos ${position}: crop failed — skipping`);
        continue;
      }

      // Upload the crop to R2 as a standalone card image
      const cropKey = `cards/${user.id}/${timestamp}-sheet-pos${position}.jpg`;
      try {
        await env.BUCKET.put(cropKey, cropBuffer, {
          httpMetadata: { contentType: 'image/jpeg' },
        });
      } catch (uploadErr) {
        console.error(`[scan] pos ${position}: R2 crop upload failed:`, uploadErr);
        // Fall back to sheet reference if upload fails
      }

      // Step 3: Identify the cropped card image individually
      const cropBase64 = arrayBufferToBase64(cropBuffer);
      const cropDataUrl = `data:image/jpeg;base64,${cropBase64}`;

      let ident;
      try {
        ident = await visionIdentifyCard(env, cropDataUrl);
      } catch (identErr) {
        console.error(`[scan] pos ${position}: vision identification failed:`, identErr);
        continue;
      }

      const cardName = ident.card_name ?? ident.player_name ?? null;
      const collectorNumber = ident.card_number ?? null;

      // Skip genuinely empty/unreadable slots — don't insert Unknown Cards
      if (!cardName && !collectorNumber) {
        console.log(`[scan] pos ${position}: no card identified — skipping insert`);
        continue;
      }

      // Step 4: Catalog lookup
      const catalogCard = await lookupCardInCatalog(
        env.DB,
        cardName,
        collectorNumber,
        null, // HP not separately extracted in this path; vision ident handles it
      );
      console.log(`[scan] pos ${position}: ${cardName} ${collectorNumber} → catalog: ${catalogCard?.card_name} (${catalogCard?.set_name})`);

      const tcgCard: TCGCard | null = catalogCard ? {
        id: catalogCard.ptcg_id,
        name: catalogCard.card_name,
        number: catalogCard.card_number,
        set: {
          id: catalogCard.set_id,
          name: catalogCard.set_name,
          series: catalogCard.series ?? '',
        },
        rarity: catalogCard.rarity ?? '',
        images: {
          small: catalogCard.image_small ?? '',
          large: catalogCard.image_large ?? '',
        },
        tcgplayer: catalogCard.tcgplayer_url ? {
          url: catalogCard.tcgplayer_url,
          prices: catalogCard.tcgplayer_market_cents ? {
            holofoil: { market: catalogCard.tcgplayer_market_cents / 100 }
          } : undefined,
        } : undefined,
      } : null;

      const resolvedCardName = tcgCard?.name ?? cardName ?? 'Unknown Card';
      const game = ident.game ?? 'Pokemon';
      const setName = tcgCard?.set.name ?? ident.ptcg_set_name ?? ident.set_name ?? null;
      const numOnly = collectorNumber?.split('/')[0]?.trim() ?? null;
      const finalNumber = tcgCard?.number ?? numOnly ?? null;
      const externalRef: string | null = tcgCard?.id ?? ident.ptcg_id ?? null;
      const marketPrice = tcgCard?.tcgplayer?.prices
        ? Object.values(tcgCard.tcgplayer.prices)[0]?.market ?? null
        : (ident.price_market_cents ? ident.price_market_cents / 100 : null);
      const estimatedValueCents = marketPrice ? Math.round(marketPrice * 100) : 0;
      const confidence = tcgCard ? 95 : (ident.confidence ?? 50);

      // Upsert card record
      const existingCard = await queryOne<{ id: number }>(
        env.DB,
        `SELECT id FROM cards
         WHERE card_name = ?
           AND game = ?
           AND COALESCE(card_number, '') = COALESCE(?, '')
         LIMIT 1`,
        [resolvedCardName, game, finalNumber],
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
             updated_at    = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [setName, tcgCard?.rarity ?? ident.ptcg_rarity ?? null, tcgCard?.images.large ?? tcgCard?.images.small ?? ident.ptcg_image_large ?? null, externalRef, cardId],
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
            resolvedCardName,
            finalNumber,
            tcgCard?.rarity ?? ident.ptcg_rarity ?? null,
            tcgCard?.images.large ?? tcgCard?.images.small ?? ident.ptcg_image_large ?? null,
            externalRef,
            null, null, null, null, null,
          ],
        );

        const newCard = await queryOne<{ id: number }>(
          env.DB,
          'SELECT id FROM cards WHERE id = last_insert_rowid()',
        );
        if (!newCard) throw new Error('Failed to create card record');
        cardId = newCard.id;
      }

      // Insert collection item — front_image_url is the per-card crop, not the sheet
      // bbox_x/y/width/height are stored as null since the image is already cropped
      await run(
        env.DB,
        `INSERT INTO collection_items
           (user_id, card_id, quantity, condition_note, estimated_grade, estimated_value_cents,
            front_image_url, bbox_x, bbox_y, bbox_width, bbox_height, product_type)
         VALUES (?, ?, 1, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'single_card')`,
        [user.id, cardId, ident.condition_notes ?? null, null, estimatedValueCents, cropKey],
      );

      const newItem = await queryOne<{ id: number }>(
        env.DB,
        'SELECT id FROM collection_items WHERE id = last_insert_rowid()',
      );
      if (!newItem) throw new Error('Failed to create collection item');
      const collectionItemId = newItem.id;

      await run(
        env.DB,
        `INSERT INTO grading_estimates
           (collection_item_id, estimated_grade_range, centering_score, corners_score,
            edges_score, surface_score, confidence_score, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [collectionItemId, null, null, null, null, null, confidence, null],
      );

      // eBay comps in background (non-blocking)
      if (env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) {
        const ebayClientId = env.EBAY_CLIENT_ID;
        const ebayClientSecret = env.EBAY_CLIENT_SECRET;
        const capturedCardId = cardId;
        const catalogSetTotal = (catalogCard as any)?.set_printed_total ?? null;
        const cardNumFull = collectorNumber
          ?? (catalogSetTotal
            ? `${tcgCard?.number ?? finalNumber}/${catalogSetTotal}`
            : (tcgCard?.number ?? finalNumber ?? ''));

        const ebayIdent = {
          player_name: tcgCard?.name ?? resolvedCardName,
          card_number: cardNumFull,
          set_name: tcgCard?.set?.name ?? setName,
          variation: tcgCard?.rarity ?? null,
          year: null,
        };
        fetchEbayComps(ebayClientId, ebayClientSecret, ebayIdent).then(async (comps) => {
          for (const comp of comps) {
            try {
              await run(env.DB,
                `INSERT INTO sales_comps
                   (card_id, source, title, sold_price_cents, sold_date, sold_platform, listing_url, condition_text)
                 VALUES (?, 'ebay_sold', ?, ?, ?, 'eBay', ?, ?)`,
                [capturedCardId, comp.title, comp.sold_price_cents, comp.sold_date, comp.listing_url, comp.condition_text],
              );
            } catch (compErr) { console.error('Failed to save comp:', compErr); }
          }
        }).catch((err) => console.error('eBay comps background task failed:', err));
      }

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
          // Provide sheet_url + bbox for legacy CardCrop fallback (bbox is null for new crops)
          sheet_url: cropKey,
          bbox: null,
          ptcg_confirmed: tcgCard != null,
          ptcg_id: tcgCard?.id ?? ident.ptcg_id ?? null,
          ptcg_set_name: tcgCard?.set.name ?? ident.ptcg_set_name ?? null,
          ptcg_set_series: tcgCard?.set.series ?? null,
          ptcg_image_large: tcgCard?.images.large ?? ident.ptcg_image_large ?? null,
          ptcg_tcgplayer_url: tcgCard?.tcgplayer?.url ?? null,
          price_market_cents: marketPrice ? Math.round(marketPrice * 100) : null,
          price_low_cents: ident.price_low_cents ?? null,
          price_high_cents: ident.price_high_cents ?? null,
          price_psa9_cents: ident.price_psa9_cents ?? null,
          price_psa10_cents: ident.price_psa10_cents ?? null,
          price_source: marketPrice ? 'tcgplayer' : (ident.price_source ?? null),
          identification_confidence: confidence,
        });
      }
    } catch (err) {
      console.error(`Failed to process card at position ${position}:`, err);
      errors.push({ position, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return ok({
    sheet_url: sheetKey,
    cards_detected: collectionItems.length,
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
