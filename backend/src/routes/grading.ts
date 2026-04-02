import type { Env, User } from '../types';
import { queryOne, run } from '../lib/db';
import { buildAIGradingEstimate, buildDeterministicFallback } from '../lib/grading';
import { badRequest, notFound, ok } from '../lib/json';
import { parseJsonBody } from '../lib/validation';
import { r2KeyToDataUrl } from '../lib/vision';

export async function estimateGrade(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<{ collectionItemId?: unknown }>(request);
  if (body instanceof Response) return body;

  const collectionItemId = Number(body.collectionItemId);
  if (!Number.isInteger(collectionItemId) || collectionItemId <= 0) {
    return badRequest('collectionItemId must be a positive integer');
  }

  const item = await queryOne<{ id: number; front_image_url: string | null }>(
    env.DB,
    'SELECT id, front_image_url FROM collection_items WHERE id = ? AND user_id = ?',
    [collectionItemId, user.id],
  );
  if (!item) return notFound('Collection item not found');

  let estimate;

  if (item.front_image_url && env.OPENAI_API_KEY) {
    const dataUrl = await r2KeyToDataUrl(env, item.front_image_url);
    estimate = dataUrl
      ? await buildAIGradingEstimate(env, dataUrl)
      : buildDeterministicFallback();
  } else {
    estimate = buildDeterministicFallback();
  }

  await run(
    env.DB,
    `INSERT INTO grading_estimates
       (collection_item_id, estimated_grade_range, centering_score, corners_score,
        edges_score, surface_score, confidence_score, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      collectionItemId,
      estimate.estimated_grade_range,
      estimate.centering.score,
      estimate.corners.score,
      estimate.edges.score,
      estimate.surface.score,
      estimate.confidence,
      estimate.explanation,
    ],
  );

  await run(
    env.DB,
    'UPDATE collection_items SET estimated_grade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [estimate.estimated_grade_range, collectionItemId, user.id],
  );

  return ok(estimate, 201);
}

export async function getLatestGrade(env: Env, collectionItemId: number, user: User): Promise<Response> {
  const owned = await queryOne(
    env.DB,
    'SELECT id FROM collection_items WHERE id = ? AND user_id = ?',
    [collectionItemId, user.id],
  );
  if (!owned) return notFound('Collection item not found');

  const latest = await queryOne<any>(
    env.DB,
    `SELECT * FROM grading_estimates
     WHERE collection_item_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [collectionItemId],
  );
  if (!latest) return notFound('No grading estimate found');

  return ok({
    label: 'AI Estimated Grade',
    non_official: true,
    ...latest,
  });
}
