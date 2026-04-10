/**
 * billing.ts — Stripe subscription routes for Cloudflare Workers
 *
 * Uses the Stripe REST API directly via fetch (no Node.js SDK needed).
 *
 * Routes:
 *   GET  /api/billing/status   — get current user's subscription tier & status
 *   POST /api/billing/checkout — create a Stripe Checkout session (monthly or yearly)
 *   POST /api/billing/portal   — create a Stripe Customer Portal session
 *   POST /api/billing/webhook  — handle Stripe webhook events (no auth required)
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET  — whsec_...
 *   APP_URL                — https://cardsafehq.com
 *
 * Stripe Price IDs — set these as env vars or replace the constants below:
 *   STRIPE_PRICE_MONTHLY   — price_... for $X/month
 *   STRIPE_PRICE_YEARLY    — price_... for $X/year
 */

import type { Env } from '../types';
import { queryOne, run } from '../lib/db';
import { requireAuth } from '../lib/auth';
import { ok, badRequest, unauthorized } from '../lib/json';
import { isStripeConfigured } from '../lib/config';

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function stripeRequest(
  env: Env,
  method: string,
  path: string,
  body?: Record<string, string>,
): Promise<Response> {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const init: RequestInit = { method, headers };
  if (body) {
    init.body = new URLSearchParams(body).toString();
  }

  return fetch(url, init);
}

async function stripeGet<T>(env: Env, path: string): Promise<T> {
  const res = await stripeRequest(env, 'GET', path);
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? 'Stripe request failed');
  }
  return res.json() as Promise<T>;
}

async function stripePost<T>(env: Env, path: string, body: Record<string, string>): Promise<T> {
  const res = await stripeRequest(env, 'POST', path, body);
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? 'Stripe request failed');
  }
  return res.json() as Promise<T>;
}

interface StripeCustomer { id: string }
interface StripeSession { id: string; url: string }
interface StripeSubscription {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string; recurring?: { interval: string } } }> };
}

// ── Get or create Stripe customer for user ────────────────────────────────────

async function getOrCreateCustomer(env: Env, userId: number, email: string): Promise<string> {
  const sub = await queryOne<{ stripe_customer_id: string | null }>(
    env.DB,
    'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?',
    [userId],
  );

  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  const customer = await stripePost<StripeCustomer>(env, '/customers', {
    email,
    metadata: JSON.stringify({ user_id: String(userId) }),
  });

  // Upsert subscription row with customer ID
  await run(
    env.DB,
    `INSERT INTO subscriptions (user_id, stripe_customer_id, plan, status)
     VALUES (?, ?, 'free', 'active')
     ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id`,
    [userId, customer.id],
  );

  return customer.id;
}

// ── GET /api/billing/status ───────────────────────────────────────────────────

export async function handleBillingStatus(env: Env, request: Request): Promise<Response> {
  const user = await requireAuth(env, request);
  if (user instanceof Response) return user;

  const sub = await queryOne<{
    plan: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: number;
  }>(
    env.DB,
    'SELECT plan, status, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = ?',
    [user.id],
  );

  if (!sub) {
    return ok({
      tier: 'free',
      status: null,
      current_period_end: null,
      cancel_at_period_end: false,
      billing_configured: isStripeConfigured(env),
    });
  }

  const isActivePro = (sub.plan === 'monthly' || sub.plan === 'yearly') &&
    (sub.status === 'active' || sub.status === 'trialing');

  return ok({
    tier: isActivePro ? 'pro' : 'free',
    status: sub.status,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    billing_configured: isStripeConfigured(env),
  });
}

// ── POST /api/billing/checkout ────────────────────────────────────────────────

export async function handleCreateCheckout(env: Env, request: Request): Promise<Response> {
  if (!isStripeConfigured(env)) return badRequest('Billing is not configured yet.');

  const user = await requireAuth(env, request);
  if (user instanceof Response) return user;

  const body = await request.json() as { plan?: string };
  const plan = body?.plan;
  if (plan !== 'monthly' && plan !== 'yearly') {
    return badRequest('plan must be "monthly" or "yearly"');
  }

  const appUrl = env.APP_URL ?? 'https://cardsafehq.com';

  // Get price IDs from env — set these in wrangler.toml or Cloudflare dashboard
  const priceId = plan === 'monthly'
    ? (env as unknown as Record<string, string>)['STRIPE_PRICE_ID_MONTHLY']
    : (env as unknown as Record<string, string>)['STRIPE_PRICE_ID_YEARLY'];

  if (!priceId) {
    return badRequest('Stripe price is not configured.');
  }

  const userRow = await queryOne<{ email: string }>(
    env.DB,
    'SELECT email FROM users WHERE id = ?',
    [user.id],
  );
  if (!userRow) return unauthorized('User not found');

  const customerId = await getOrCreateCustomer(env, user.id, userRow.email);

  const session = await stripePost<StripeSession>(env, '/checkout/sessions', {
    customer: customerId,
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?canceled=1`,
    'subscription_data[metadata][user_id]': String(user.id),
    allow_promotion_codes: 'true',
  });

  return ok({ url: session.url });
}

// ── POST /api/billing/portal ──────────────────────────────────────────────────

export async function handleCreatePortal(env: Env, request: Request): Promise<Response> {
  if (!isStripeConfigured(env)) return badRequest('Billing is not configured yet.');

  const user = await requireAuth(env, request);
  if (user instanceof Response) return user;

  const sub = await queryOne<{ stripe_customer_id: string | null }>(
    env.DB,
    'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ?',
    [user.id],
  );

  if (!sub?.stripe_customer_id) {
    return badRequest('No billing account found. Please subscribe first.');
  }

  const appUrl = env.APP_URL ?? 'https://cardsafehq.com';

  const session = await stripePost<StripeSession>(env, '/billing_portal/sessions', {
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });

  return ok({ url: session.url });
}

// ── POST /api/billing/webhook ─────────────────────────────────────────────────

export async function handleStripeWebhook(env: Env, request: Request): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  // Verify webhook signature using HMAC-SHA256
  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.warn('[webhook] Invalid signature');
    return new Response('Invalid signature', { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  try {
    await handleWebhookEvent(env, event);
  } catch (err) {
    console.error('[webhook] Error handling event', event.type, err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'content-type': 'application/json' },
  });
}

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    const signed = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
    const expected = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === signature;
  } catch {
    return false;
  }
}

async function handleWebhookEvent(
  env: Env,
  event: { type: string; data: { object: Record<string, unknown> } },
): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = obj as unknown as StripeSubscription;
      const customerId = obj['customer'] as string;
      const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
      const plan = interval === 'year' ? 'yearly' : 'monthly';

      await run(
        env.DB,
        `UPDATE subscriptions
         SET stripe_subscription_id = ?,
             plan = ?,
             status = ?,
             current_period_end = datetime(?, 'unixepoch'),
             cancel_at_period_end = ?,
             updated_at = datetime('now')
         WHERE stripe_customer_id = ?`,
        [
          sub.id,
          plan,
          sub.status,
          String(sub.current_period_end),
          sub.cancel_at_period_end ? 1 : 0,
          customerId,
        ],
      );
      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = obj['customer'] as string;
      await run(
        env.DB,
        `UPDATE subscriptions
         SET plan = 'free', status = 'canceled', stripe_subscription_id = NULL,
             current_period_end = NULL, cancel_at_period_end = 0, updated_at = datetime('now')
         WHERE stripe_customer_id = ?`,
        [customerId],
      );
      break;
    }

    case 'invoice.payment_failed': {
      const customerId = obj['customer'] as string;
      await run(
        env.DB,
        `UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now')
         WHERE stripe_customer_id = ?`,
        [customerId],
      );
      break;
    }

    default:
      // Unhandled event — log and ignore
      console.log('[webhook] Unhandled event type:', event.type);
  }
}
