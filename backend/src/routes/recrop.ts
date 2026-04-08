/**
 * recrop.ts — Admin endpoint to re-crop existing collection items
 *
 * When a collection item's front_image_url points to a full binder sheet
 * (key starts with "sheets/") but the item has bbox coordinates, this endpoint
 * fetches the sheet from R2, crops the individual card, uploads the crop,
 * and updates front_image_url to point to the cropped image.
 *
 * POST /api/admin/recrop
 * Body: { user_id?: number }  — omit to process all users
 */

import type { Env, User } from '../types';
import { queryAll, run } from '../lib/db';
import { badRequest, ok, serverError } from '../lib/json';
import { cropCardFromSheet } from '../lib/crop';

interface CollectionItemRow {
  id: number;
  user_id: number;
  front_image_url: string | null;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
}

const ADMIN_EMAIL = 'michaelamarino16@gmail.com';

export async function handleRecrop(env: Env, request: Request, user: User): Promise<Response> {
  if (user.email !== ADMIN_EMAIL) {
    return badRequest('Admin access required');
  }

  let targetUserId: number | null = null;
  try {
    const body = await request.json() as { user_id?: number };
    targetUserId = body.user_id ?? null;
  } catch {
    // no body — process all
  }

  // Find all collection items where front_image_url points to a sheet (not a card crop)
  // Sheet keys look like: sheets/{userId}/{timestamp}-sheet.jpg
  // Card crop keys look like: cards/{userId}/{timestamp}-card-{position}.jpg
  const query = targetUserId
    ? `SELECT id, user_id, front_image_url, bbox_x, bbox_y, bbox_width, bbox_height
       FROM collection_items
       WHERE user_id = ?
         AND front_image_url LIKE 'sheets/%'
         AND bbox_x IS NOT NULL
         AND bbox_y IS NOT NULL
         AND bbox_width IS NOT NULL
         AND bbox_height IS NOT NULL`
    : `SELECT id, user_id, front_image_url, bbox_x, bbox_y, bbox_width, bbox_height
       FROM collection_items
       WHERE front_image_url LIKE 'sheets/%'
         AND bbox_x IS NOT NULL
         AND bbox_y IS NOT NULL
         AND bbox_width IS NOT NULL
         AND bbox_height IS NOT NULL`;

  const items = await queryAll<CollectionItemRow>(
    env.DB,
    query,
    targetUserId ? [targetUserId] : [],
  );

  if (items.length === 0) {
    return ok({ message: 'No items need re-cropping', processed: 0, failed: 0 });
  }

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      if (!item.front_image_url) { failed++; continue; }

      // Fetch the sheet from R2
      const sheetObj = await env.BUCKET.get(item.front_image_url);
      if (!sheetObj) {
        errors.push(`Item ${item.id}: sheet not found in R2 (${item.front_image_url})`);
        failed++;
        continue;
      }

      const sheetBuffer = await sheetObj.arrayBuffer();
      const mimeType = sheetObj.httpMetadata?.contentType ?? 'image/jpeg';

      const bbox = {
        x: item.bbox_x!,
        y: item.bbox_y!,
        width: item.bbox_width!,
        height: item.bbox_height!,
      };

      const cropBuffer = await cropCardFromSheet(sheetBuffer, mimeType, bbox);
      if (!cropBuffer) {
        errors.push(`Item ${item.id}: crop failed`);
        failed++;
        continue;
      }

      // Upload the crop
      const timestamp = Date.now();
      const cropKey = `cards/${item.user_id}/${timestamp}-card-${item.id}-recrop.jpg`;
      await env.BUCKET.put(cropKey, cropBuffer, {
        httpMetadata: { contentType: 'image/jpeg' },
      });

      // Update the DB record
      await run(
        env.DB,
        'UPDATE collection_items SET front_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [cropKey, item.id],
      );

      processed++;
    } catch (err) {
      errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  return ok({
    message: `Re-crop complete`,
    total: items.length,
    processed,
    failed,
    ...(errors.length > 0 ? { errors: errors.slice(0, 20) } : {}),
  });
}
