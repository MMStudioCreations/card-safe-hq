import type { Env, User } from '../types';
import { queryOne, run } from '../lib/db';
import { badRequest, ok, serverError } from '../lib/json';
import { fetchEbayComps } from '../lib/ebay';
import { identifyCard as visionIdentifyCard, correctCardSet } from '../lib/vision';
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

// ─── Pokemon TCG API types + lookup helpers ───────────────────────────────────

// Known attack/ability words that are NOT card names
const NOT_A_CARD_NAME = [
  'smack', 'filch', 'tackle', 'scratch', 'growl', 'ability',
  'whirlwind', 'razor', 'wing', 'draw', 'energy', 'trainer',
  'supporter', 'item', 'stadium', 'basic', 'stage',
];

const SET_NAME_TO_ID: Record<string, string> = {
  'phantasmal flames': 'sv8pt5',
  'surging sparks': 'sv8',
  'stellar crown': 'sv7',
  'twilight masquerade': 'sv6',
  'temporal forces': 'sv5',
  'paradox rift': 'sv4',
  'obsidian flames': 'sv3',
  'paldea evolved': 'sv2',
  'scarlet & violet': 'sv1',
  'brilliant stars': 'swsh9',
  'crown zenith': 'swsh12pt5',
  'lost origin': 'swsh11',
  'silver tempest': 'swsh12',
};

interface TCGCard {
  id: string;
  name: string;
  number: string;
  set: { name: string; series: string; id: string };
  rarity: string;
  images: { small: string; large: string };
  tcgplayer?: { url?: string; prices?: Record<string, { market?: number }> };
}

async function lookupBySetNumber(
  cardName: string | null,
  setNumber: string | null,
  apiKey: string,
  setNameHint?: string | null,
): Promise<TCGCard | null> {
  if (!setNumber && !cardName) return null;

  // Extract just the number portion (e.g. "171" from "171/167")
  const numOnly = setNumber?.split('/')[0]?.trim();

  let query = '';
  if (cardName && numOnly) {
    query = `name:"${cardName}" number:${numOnly}`;
  } else if (numOnly) {
    query = `number:${numOnly}`;
  } else if (cardName) {
    query = `name:"${cardName}"`;
  }

  // Narrow search by set ID if we can map the set name
  if (setNameHint) {
    const setId = SET_NAME_TO_ID[setNameHint.toLowerCase()];
    if (setId) query += ` set.id:${setId}`;
  }

  try {
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=3&orderBy=set.releaseDate`;
    const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } });
    if (!res.ok) return null;
    const data = await res.json() as { data: TCGCard[] };
    if (!data.data?.length) return null;

    // Prefer exact name + number match
    if (cardName && numOnly) {
      const exact = data.data.find(
        (c) => c.name.toLowerCase() === cardName.toLowerCase() && c.number === numOnly,
      );
      if (exact) return exact;
    }

    return data.data[0];
  } catch {
    return null;
  }
}

async function lookupByNameOnly(
  cardName: string,
  apiKey: string,
): Promise<TCGCard | null> {
  try {
    const url = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"&pageSize=1&orderBy=-set.releaseDate`;
    const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } });
    if (!res.ok) return null;
    const data = await res.json() as { data: TCGCard[] };
    return data.data?.[0] ?? null;
  } catch {
    return null;
  }
}

// Fixed-grid bbox for a standard 9-pocket binder page (3×3 grid).
// Uses math instead of GPT-4o estimates — positions are always correct.
function getFixedBbox(position: number) {
  // position 1-9, left to right, top to bottom
  const col = (position - 1) % 3;  // 0, 1, 2
  const row = Math.floor((position - 1) / 3);  // 0, 1, 2

  // Approximate card cell boundaries — accounts for binder page margins and pocket borders
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
  // Step 1: Send FULL sheet to GPT-4o once — identify all 9 cards at full resolution.
  // Step 2: For each position, lookup in Pokemon TCG API.
  // Step 3: Crop each position using fixed grid math.
  // Step 4: Upload crop to R2 and INSERT collection item.

  const FULL_SHEET_PROMPT = `You are analyzing a high-resolution scan of a
9-pocket Pokemon card binder page. The cards are arranged in a 3x3 grid.

Examine the FULL image carefully. For each of the 9 card positions
(left to right, top to bottom, positions 1-9):

Read the text printed on each card:
- Card name: large bold text at the TOP of each card
- Collector number: small text at the BOTTOM of each card (format: "168/162")
- HP: number at top-right of each card

You MUST return all 9 positions. If a slot appears empty return null values.

Return ONLY this JSON:
{
  "cards": [
    {
      "position": 1,
      "card_name": "exact name printed at top",
      "collector_number": "168/162",
      "hp": 50
    },
    ... 9 total entries
  ]
}

Read what is literally printed. Do not guess from artwork.
The collector number is critical — read it exactly.`;

  interface SheetCardResult {
    position: number;
    card_name: string | null;
    collector_number: string | null;
    hp: number | null;
  }

  // ── Step 1: GPT-4o full sheet identification ──
  const sheetBase64 = arrayBufferToBase64(fileBuffer);
  const gptController = new AbortController();
  const gptTimeout = setTimeout(() => gptController.abort(), 60_000);

  let sheetCards: SheetCardResult[] = [];

  try {
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              { type: 'text', text: FULL_SHEET_PROMPT },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: gptController.signal,
    });

    if (gptResponse.ok) {
      const gptData = await gptResponse.json() as { choices: Array<{ message: { content: string } }> };
      const rawText = gptData.choices?.[0]?.message?.content ?? '';
      const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText) as { cards: SheetCardResult[] };
      sheetCards = Array.isArray(parsed.cards) ? parsed.cards : [];
    } else {
      const errBody = await gptResponse.text();
      console.error('[scan] GPT-4o full sheet error:', gptResponse.status, errBody);
    }
  } catch (err) {
    console.error('[scan] GPT-4o full sheet call failed:', err);
  } finally {
    clearTimeout(gptTimeout);
  }

  console.log('[scan] GPT-4o full sheet result:', JSON.stringify(sheetCards));

  // Build position map — fill any missing positions with nulls
  const cardsByPosition = new Map<number, SheetCardResult>();
  for (const c of sheetCards) {
    if (c.position >= 1 && c.position <= 9) cardsByPosition.set(c.position, c);
  }
  for (let p = 1; p <= 9; p++) {
    if (!cardsByPosition.has(p)) {
      cardsByPosition.set(p, { position: p, card_name: null, collector_number: null, hp: null });
    }
  }

  const collectionItems: Record<string, unknown>[] = [];
  const errors: Array<{ position: number; error: string }> = [];

  for (let position = 1; position <= 9; position++) {
    try {
      const gptCard = cardsByPosition.get(position)!;
      const { card_name, collector_number } = gptCard;

      // Extract just the number portion (e.g. "168/162" → "168")
      const numOnly = collector_number?.split('/')[0]?.trim() ?? null;

      // ── Step 2: TCG API lookup ──
      let tcgCard: TCGCard | null = null;
      if (card_name || numOnly) {
        tcgCard = await lookupBySetNumber(card_name, collector_number, env.POKEMON_TCG_API_KEY ?? '');
      }
      if (!tcgCard && numOnly) {
        tcgCard = await lookupBySetNumber(null, numOnly, env.POKEMON_TCG_API_KEY ?? '');
      }
      if (!tcgCard && card_name) {
        tcgCard = await lookupByNameOnly(card_name, env.POKEMON_TCG_API_KEY ?? '');
      }

      console.log(`[scan] pos ${position}: ${card_name} ${collector_number} → TCG: ${tcgCard?.name}`);

      // ── Step 3: Crop using fixed grid math ──
      const fixedBbox = getFixedBbox(position);
      const cropBuffer = await cropCardFromSheet(fileBuffer, file.type, fixedBbox);

      const cropKey = `cards/${user.id}/${timestamp}-card-${position}.jpg`;
      let cardImageUrl: string = sheetKey;
      if (cropBuffer) {
        try {
          await env.BUCKET.put(cropKey, cropBuffer, {
            httpMetadata: { contentType: 'image/jpeg' },
          });
          cardImageUrl = cropKey;
        } catch (cropUploadErr) {
          console.error(`[scan] Failed to upload crop for card ${position}:`, cropUploadErr);
        }
      } else {
        console.error(`[scan] cropCardFromSheet returned null for position ${position}`);
      }

      console.log(`[scan] pos ${position}: saving crop key: ${cardImageUrl}`);

      // ── Step 4: Resolve card data and INSERT ──
      const cardName = tcgCard?.name ?? card_name ?? 'Unknown Card';
      const game = 'Pokemon';
      const setName = tcgCard?.set.name ?? null;
      const finalNumber = tcgCard?.number ?? numOnly ?? null;
      const externalRef: string | null = tcgCard?.id ?? null;
      const marketPrice = tcgCard?.tcgplayer?.prices
        ? Object.values(tcgCard.tcgplayer.prices)[0]?.market ?? null
        : null;
      const estimatedValueCents = marketPrice ? Math.round(marketPrice * 100) : 0;
      const confidence = tcgCard ? 95 : 50;

      // Upsert card record
      const existingCard = await queryOne<{ id: number }>(
        env.DB,
        `SELECT id FROM cards
         WHERE card_name = ?
           AND game = ?
           AND COALESCE(card_number, '') = COALESCE(?, '')
         LIMIT 1`,
        [cardName, game, finalNumber],
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
          [setName, tcgCard?.rarity ?? null, tcgCard?.images.large ?? tcgCard?.images.small ?? null, externalRef, cardId],
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
            finalNumber,
            tcgCard?.rarity ?? null,
            tcgCard?.images.large ?? tcgCard?.images.small ?? null,
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

      await run(
        env.DB,
        `INSERT INTO collection_items
           (user_id, card_id, quantity, condition_note, estimated_grade, estimated_value_cents,
            front_image_url, bbox_x, bbox_y, bbox_width, bbox_height, product_type)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'single_card')`,
        [user.id, cardId, null, null, estimatedValueCents, cardImageUrl, fixedBbox.x, fixedBbox.y, fixedBbox.width, fixedBbox.height],
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
        const ebayIdent = { card_number: finalNumber, player_name: cardName, year: null, set_name: setName, variation: null };
        fetchEbayComps(ebayClientId, ebayClientSecret, ebayIdent as any).then(async (comps) => {
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
          sheet_url: sheetKey,
          bbox: fixedBbox,
          ptcg_confirmed: tcgCard != null,
          ptcg_id: tcgCard?.id ?? null,
          ptcg_set_name: tcgCard?.set.name ?? null,
          ptcg_set_series: tcgCard?.set.series ?? null,
          ptcg_image_large: tcgCard?.images.large ?? null,
          ptcg_tcgplayer_url: tcgCard?.tcgplayer?.url ?? null,
          price_market_cents: marketPrice ? Math.round(marketPrice * 100) : null,
          price_low_cents: null,
          price_high_cents: null,
          price_psa9_cents: null,
          price_psa10_cents: null,
          price_source: marketPrice ? 'tcgplayer' : null,
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
