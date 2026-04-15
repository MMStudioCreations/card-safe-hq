/**
 * shop.ts — Card Safe HQ Slab Guard one-time purchase checkout
 *
 * Routes:
 *   POST /api/shop/checkout  — create a Stripe Checkout session for slab guard orders
 *   GET  /api/shop/orders    — list past orders for the authenticated user (optional)
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY   — sk_live_... or sk_test_...
 *   APP_URL             — https://cardsafehq.com  (used for success/cancel redirects)
 *
 * No Stripe Price IDs needed — we use ad-hoc price_data in the checkout session
 * so you don't need to pre-create products in the Stripe dashboard.
 */

import type { Env } from '../types';
import { ok, badRequest, serverError } from '../lib/json';

// ── Pricing tiers (must match frontend) ──────────────────────────────────────

function unitPriceCents(qty: number): number {
  if (qty >= 11) return 300;   // $3.00 each
  if (qty >= 6)  return 350;   // $3.50 each
  if (qty >= 4)  return 380;   // $3.80 each
  if (qty === 3) return 400;   // $4.00 each → $12.00
  if (qty === 2) return 450;   // $4.50 each → $9.00
  return 500;                  // $5.00 each
}

function totalCents(qty: number): number {
  return unitPriceCents(qty) * qty;
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function stripePost<T>(env: Env, path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? 'Stripe request failed');
  }
  return res.json() as Promise<T>;
}

interface StripeSession { id: string; url: string }

// ── POST /api/shop/checkout ───────────────────────────────────────────────────

export async function handleShopCheckout(env: Env, request: Request): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) {
    return badRequest('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
  }

  let body: {
    items?: Array<{
      color: string;
      slab_type: string;
      quantity: number;
      glitter?: boolean;
    }>;
    total_cents?: number;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const items = body.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return badRequest('items array is required');
  }

  // Validate each item
  for (const item of items) {
    if (!item.color || typeof item.color !== 'string') return badRequest('Each item must have a color');
    if (!item.slab_type || typeof item.slab_type !== 'string') return badRequest('Each item must have a slab_type');
    if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1) return badRequest('Each item must have quantity >= 1');
  }

  // Build Stripe line_items using price_data (no pre-created products needed)
  const appUrl = env.APP_URL ?? 'https://cardsafehq.com';

  // Build URLSearchParams for Stripe's form-encoded API
  // Stripe checkout session with multiple line items
  const params: Record<string, string> = {
    'payment_method_types[0]': 'card',
    'mode': 'payment',
    'success_url': `${appUrl}/shop?checkout=success`,
    'cancel_url': `${appUrl}/shop?checkout=canceled`,
    'shipping_address_collection[allowed_countries][0]': 'US',
    'shipping_address_collection[allowed_countries][1]': 'CA',
    'shipping_address_collection[allowed_countries][2]': 'GB',
    'shipping_address_collection[allowed_countries][3]': 'AU',
    'shipping_address_collection[allowed_countries][4]': 'DE',
    'shipping_address_collection[allowed_countries][5]': 'FR',
    'billing_address_collection': 'auto',
    'metadata[source]': 'card_safe_hq_shop',
  };

  // Add each item as a line_item with price_data
  items.forEach((item, idx) => {
    const slabLabel = item.slab_type.toUpperCase();
    const glitterSuffix = item.glitter ? ' ✦ Glitter' : '';
    const productName = `${item.color}${glitterSuffix} — ${slabLabel} Slab Guard`;
    const unitPrice = unitPriceCents(item.quantity);

    params[`line_items[${idx}][price_data][currency]`] = 'usd';
    params[`line_items[${idx}][price_data][unit_amount]`] = String(unitPrice);
    params[`line_items[${idx}][price_data][product_data][name]`] = productName;
    params[`line_items[${idx}][price_data][product_data][description]`] =
      `Premium silicone slab guard for ${slabLabel} graded cards — ${item.color}${glitterSuffix}`;
    params[`line_items[${idx}][price_data][product_data][metadata][color]`] = item.color;
    params[`line_items[${idx}][price_data][product_data][metadata][slab_type]`] = item.slab_type;
    params[`line_items[${idx}][quantity]`] = String(item.quantity);
  });

  try {
    const session = await stripePost<StripeSession>(env, '/checkout/sessions', params);
    return ok({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return serverError((err as Error).message ?? 'Failed to create checkout session');
  }
}
