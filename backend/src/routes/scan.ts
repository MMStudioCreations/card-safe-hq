import type { Env, User } from '../types';
import { queryOne, run } from '../lib/db';
import { badRequest, ok, serverError } from '../lib/json';
import { analyzeSheet } from '../lib/anthropic';
import { fetchEbayComps } from '../lib/ebay';

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
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}



export async function handleSheetScan(env: Env, request: Request, user: User): Promise<Response> {

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('Request must be multipart/form-data');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return badRequest('Missing "file" field in form data');
  }


  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return badRequest('Unsupported image type. Use JPEG, PNG, or WebP.');
  }
  const fileBuffer = await file.arrayBuffer();
  if (fileBuffer.byteLength === 0 || fileBuffer.byteLength > MAX_FILE_SIZE) {
    return badRequest('File must be between 1 byte and 20MB');
  }


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

  const sheetUrl = sheetKey;


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
      const ident = cardData.identification;
      const grading = cardData.grading;


      const cardName = ident.player_name || 'Unknown Card';
      const game = ident.sport || 'Unknown';
      const yearInt = ident.year ? parseInt(ident.year, 10) : null;
      const yearValue = yearInt && isFinite(yearInt) ? yearInt : null;


      const externalRef = [ident.manufacturer, ident.year, ident.card_number]
        .filter((v) => v && v.trim())
        .join(':') || null;


      const existingCard = await queryOne<{ id: number }>(
        env.DB,
        `SELECT id FROM cards
         WHERE card_name = ?
           AND game = ?
           AND COALESCE(set_name, '') = COALESCE(?, '')
           AND COALESCE(card_number, '') = COALESCE(?, '')
         LIMIT 1`,
        [cardName, game, ident.set_name || null, ident.card_number || null],
      );

      let cardId: number;

      if (existingCard) {
        cardId = existingCard.id;

        await run(
          env.DB,
          `UPDATE cards SET
             sport = COALESCE(sport, ?),
             player_name = COALESCE(player_name, ?),
             year = COALESCE(year, ?),
             variation = COALESCE(variation, ?),
             manufacturer = COALESCE(manufacturer, ?),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            ident.sport || null,
            ident.player_name || null,
            yearValue,
            ident.variation || null,
            ident.manufacturer || null,
            cardId,
          ],
        );
      } else {
        await run(
          env.DB,
          `INSERT INTO cards (game, set_name, card_name, card_number, rarity, image_url, external_ref, sport, player_name, year, variation, manufacturer)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
          [
            game,
            ident.set_name || null,
            cardName,
            ident.card_number || null,
            ident.variation || null,
            externalRef,
            ident.sport || null,
            ident.player_name || null,
            yearValue,
            ident.variation || null,
            ident.manufacturer || null,
          ],
        );

        const newCard = await queryOne<{ id: number }>(
          env.DB,
          'SELECT id FROM cards WHERE id = last_insert_rowid()',
        );
        if (!newCard) throw new Error('Failed to create card record');
        cardId = newCard.id;
      }

      const gradeParts = grading.estimated_grade_range.split('-').map(Number).filter(isFinite);
      const avgGrade = gradeParts.length > 0 ? gradeParts.reduce((a, b) => a + b, 0) / gradeParts.length : 7;
      const estimatedValueCents = Math.round(avgGrade * 200); // rough placeholder

      await run(
        env.DB,
        `INSERT INTO collection_items (user_id, card_id, quantity, condition_note, estimated_grade, estimated_value_cents, front_image_url)
         VALUES (?, ?, 1, ?, ?, ?, ?)`,
        [
          user.id,
          cardId,
          ident.condition_notes || null,
          grading.estimated_grade_range,
          estimatedValueCents,
          sheetUrl,
        ],
      );

      const newItem = await queryOne<{ id: number }>(
        env.DB,
        'SELECT id FROM collection_items WHERE id = last_insert_rowid()',
      );
      if (!newItem) throw new Error('Failed to create collection item');
      const collectionItemId = newItem.id;

      await run(
        env.DB,
        `INSERT INTO grading_estimates (collection_item_id, estimated_grade_range, centering_score, corners_score, edges_score, surface_score, confidence_score, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          collectionItemId,
          grading.estimated_grade_range,
          grading.centering_score,
          grading.corners_score,
          grading.edges_score,
          grading.surface_score,
          grading.confidence_score,
          grading.explanation,
        ],
      );

      if (env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) {
        const ebayClientId = env.EBAY_CLIENT_ID;
        const ebayClientSecret = env.EBAY_CLIENT_SECRET;
        const capturedCardId = cardId;

        fetchEbayComps(ebayClientId, ebayClientSecret, ident).then(async (comps) => {
          for (const comp of comps) {
            try {
              await run(
                env.DB,
                `INSERT INTO sales_comps (card_id, source, title, sold_price_cents, sold_date, sold_platform, listing_url, condition_text)
                 VALUES (?, 'ebay_sold', ?, ?, ?, 'eBay', ?, ?)`,
                [
                  capturedCardId,
                  comp.title,
                  comp.sold_price_cents,
                  comp.sold_date,
                  comp.listing_url,
                  comp.condition_text,
                ],
              );
            } catch (compErr) {
              console.error('Failed to save comp:', compErr);
            }
          }
        }).catch((err) => {
          console.error('eBay comps background task failed:', err);
        });
      }

        const fullItem = await queryOne<Record<string, unknown>>(
        env.DB,
        `SELECT ci.*, c.game, c.set_name, c.card_name, c.card_number, c.rarity,
                c.sport, c.player_name, c.year, c.variation, c.manufacturer
         FROM collection_items ci
         LEFT JOIN cards c ON ci.card_id = c.id
         WHERE ci.id = ?`,
        [collectionItemId],
      );

      if (fullItem) collectionItems.push({ ...fullItem, sheet_url: sheetUrl, bbox: cardData.bbox });
    } catch (err) {
      console.error(`Failed to process card at position ${cardData.position}:`, err);
      errors.push({
        position: cardData.position,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return ok({
    sheet_url: sheetUrl,
    cards_detected: analysis.card_count,
    collection_items: collectionItems,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
