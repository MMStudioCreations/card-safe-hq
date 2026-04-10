import type { Env, User } from '../types';
import { queryOne, run } from './db';
import { forbidden } from './json';

export type MembershipTier = 'free' | 'pro';

export async function ensureUserSubscription(env: Env, userId: number): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO subscriptions (user_id, plan, status)
     VALUES (?, 'free', 'active')
     ON CONFLICT(user_id) DO NOTHING`,
    [userId],
  );
}

export async function getUserTier(env: Env, userId: number): Promise<MembershipTier> {
  const sub = await queryOne<{ plan: string; status: string }>(
    env.DB,
    'SELECT plan, status FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  if (!sub) return 'free';
  const activePro = (sub.plan === 'monthly' || sub.plan === 'yearly') && ['active', 'trialing'].includes(sub.status);
  return activePro ? 'pro' : 'free';
}

export async function requirePlan(env: Env, user: User, minimum: MembershipTier): Promise<Response | null> {
  if (minimum === 'free') return null;
  const tier = await getUserTier(env, user.id);
  if (tier !== 'pro') {
    return forbidden('This feature requires a paid plan.');
  }
  return null;
}
