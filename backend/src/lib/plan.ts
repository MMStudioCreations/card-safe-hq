import type { Env, User } from '../types';
import { queryOne, run } from './db';
import { forbidden } from './json';

export type MembershipTier = 'free' | 'pro';
export type MembershipPlan = 'free' | 'monthly' | 'yearly';

// Owner email always gets max (yearly Pro) access without payment
const OWNER_EMAIL = 'michaelamarino16@gmail.com';

function isOwner(user: User): boolean {
  return user.email === OWNER_EMAIL || user.email === (process?.env?.ADMIN_EMAIL ?? '');
}

export async function ensureUserSubscription(env: Env, userId: number): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO subscriptions (user_id, plan, status)
     VALUES (?, 'free', 'active')
     ON CONFLICT(user_id) DO NOTHING`,
    [userId],
  );
}

export async function getUserTier(env: Env, userId: number, user?: User): Promise<MembershipTier> {
  // Owner always gets Pro
  if (user && isOwner(user)) return 'pro';

  const sub = await queryOne<{ plan: string; status: string }>(
    env.DB,
    'SELECT plan, status FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  if (!sub) return 'free';
  const activePro = (sub.plan === 'monthly' || sub.plan === 'yearly') && ['active', 'trialing'].includes(sub.status);
  return activePro ? 'pro' : 'free';
}

export async function getUserPlan(env: Env, userId: number, user?: User): Promise<MembershipPlan> {
  // Owner always gets yearly
  if (user && isOwner(user)) return 'yearly';

  const sub = await queryOne<{ plan: string; status: string }>(
    env.DB,
    'SELECT plan, status FROM subscriptions WHERE user_id = ?',
    [userId],
  );
  if (!sub) return 'free';
  const isActive = ['active', 'trialing'].includes(sub.status);
  if (!isActive) return 'free';
  if (sub.plan === 'yearly') return 'yearly';
  if (sub.plan === 'monthly') return 'monthly';
  return 'free';
}

export async function requirePlan(env: Env, user: User, minimum: MembershipTier): Promise<Response | null> {
  if (minimum === 'free') return null;
  // Owner always passes
  if (isOwner(user)) return null;
  const tier = await getUserTier(env, user.id, user);
  if (tier !== 'pro') {
    return forbidden('This feature requires a paid plan.');
  }
  return null;
}
