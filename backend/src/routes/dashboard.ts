import type { Env, User } from '../types';
import { queryAll, queryOne } from '../lib/db';
import { ok } from '../lib/json';

export async function handleDashboardSummary(env: Env, user: User): Promise<Response> {
  const [globalMembers, globalCards, globalValue, userCards, userValue, recent, topValue] = await Promise.all([
    queryOne<{ count: number }>(env.DB, 'SELECT COUNT(*) as count FROM users'),
    queryOne<{ count: number }>(env.DB, 'SELECT COALESCE(SUM(quantity), 0) as count FROM collection_items'),
    queryOne<{ value: number }>(env.DB, 'SELECT COALESCE(SUM(estimated_value_cents), 0) as value FROM collection_items'),
    queryOne<{ count: number }>(env.DB, 'SELECT COALESCE(SUM(quantity), 0) as count FROM collection_items WHERE user_id = ?', [user.id]),
    queryOne<{ value: number }>(env.DB, 'SELECT COALESCE(SUM(estimated_value_cents), 0) as value FROM collection_items WHERE user_id = ?', [user.id]),
    queryAll(env.DB, `SELECT ci.id, ci.created_at, ci.estimated_value_cents, c.card_name, c.set_name, c.card_number
      FROM collection_items ci LEFT JOIN cards c ON c.id = ci.card_id
      WHERE ci.user_id = ? ORDER BY ci.created_at DESC LIMIT 5`, [user.id]),
    queryAll(env.DB, `SELECT ci.id, ci.estimated_value_cents, c.card_name, c.set_name, c.card_number
      FROM collection_items ci LEFT JOIN cards c ON c.id = ci.card_id
      WHERE ci.user_id = ? ORDER BY ci.estimated_value_cents DESC LIMIT 5`, [user.id]),
  ]);

  return ok({
    global: {
      total_members: globalMembers?.count ?? 0,
      total_collection_cards: globalCards?.count ?? 0,
      total_collection_value_cents: globalValue?.value ?? 0,
    },
    user: {
      total_cards: userCards?.count ?? 0,
      total_value_cents: userValue?.value ?? 0,
      recent_cards: recent,
      top_value_cards: topValue,
    },
  });
}
