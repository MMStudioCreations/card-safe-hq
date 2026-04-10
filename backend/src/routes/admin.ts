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

export async function handleAdminUsers(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  try {
    const rows = await queryAll<{
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
       ORDER BY u.created_at DESC`,
      [],
    );

    return ok(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Users query failed';
    return serverError(message);
  }
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
