import type { Env, User } from '../types';
import { queryAll, queryOne } from '../lib/db';
import { badRequest, forbidden, ok, serverError } from '../lib/json';
import { parseJsonBody } from '../lib/validation';

const ADMIN_EMAIL = 'michaelamarino16@gmail.com';

function requireAdmin(user: User): Response | null {
  if (user.email !== ADMIN_EMAIL) {
    return forbidden('Forbidden');
  }
  return null;
}

export async function handleAdminStats(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const [totalUsers, totalCards, totalItems, totalScans, avgConfidence] = await Promise.all([
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
    queryOne<{ avg: number | null }>(
      env.DB,
      `SELECT AVG(
         CAST(
           CASE
             WHEN grade_range LIKE '%-%' THEN
               (CAST(SUBSTR(grade_range, 1, INSTR(grade_range, '-') - 1) AS REAL) +
                CAST(SUBSTR(grade_range, INSTR(grade_range, '-') + 1) AS REAL)) / 2
             ELSE CAST(grade_range AS REAL)
           END
         AS REAL)
       ) as avg
       FROM grading_estimates`,
      [],
    ),
  ]);

  return ok({
    total_users: totalUsers?.count ?? 0,
    total_cards: totalCards?.count ?? 0,
    total_collection_items: totalItems?.count ?? 0,
    total_scans: totalScans?.count ?? 0,
    avg_confidence_score: avgConfidence?.avg ?? null,
  });
}

export async function handleAdminUsers(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  const rows = await queryAll<{
    id: number;
    email: string;
    username: string | null;
    created_at: string;
    collection_count: number;
  }>(
    env.DB,
    `SELECT u.id, u.email, u.username, u.created_at,
            COUNT(ci.id) as collection_count
     FROM users u
     LEFT JOIN collection_items ci ON ci.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    [],
  );

  return ok(rows);
}

export async function handleAdminCards(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

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
}

export async function handleAdminActivity(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

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
