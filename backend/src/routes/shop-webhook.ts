/**
 * shop-webhook.ts — Stripe webhook handler for Card Safe HQ pre-order emails
 *
 * Routes:
 *   POST /api/shop/webhook  — receives Stripe events, sends order emails
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... (from Stripe dashboard webhook settings)
 *   MAILEROO_API_KEY         — for sending emails
 *   MAIL_FROM                — e.g. "Card Safe HQ <orders@cardsafehq.com>"
 *   SHOP_OWNER_EMAIL         — your email address to receive order notifications
 *   APP_URL / APP_BASE_URL   — https://cardsafehq.com
 */

import type { Env } from '../types';
import { ok, badRequest, serverError } from '../lib/json';
import { sendEmail } from '../lib/email';

// ── Stripe signature verification (HMAC-SHA256) ───────────────────────────────

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('='))) as Record<string, string>;
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
    const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === signature;
  } catch {
    return false;
  }
}

// ── Stripe session retrieval ──────────────────────────────────────────────────

interface StripeLineItem {
  description: string;
  quantity: number;
  amount_total: number;
}

interface StripeSession {
  id: string;
  customer_details?: {
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  shipping_details?: {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  amount_total?: number;
  currency?: string;
  metadata?: Record<string, string>;
  line_items?: { data: StripeLineItem[] };
}

async function fetchSessionWithLineItems(env: Env, sessionId: string): Promise<StripeSession> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items`,
    {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    },
  );
  if (!res.ok) throw new Error('Failed to fetch Stripe session');
  return res.json() as Promise<StripeSession>;
}

// ── Email helpers ─────────────────────────────────────────────────────────────

function formatAddress(addr?: StripeSession['shipping_details']): string {
  if (!addr?.address) return 'Not provided';
  const a = addr.address;
  return [addr.name, a.line1, a.line2, `${a.city ?? ''}, ${a.state ?? ''} ${a.postal_code ?? ''}`.trim(), a.country]
    .filter(Boolean)
    .join('<br />');
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function buildLineItemsHtml(items: StripeLineItem[]): string {
  return items.map(item => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#E0E8F0;border-bottom:1px solid rgba(255,255,255,0.06);">${item.description}</td>
      <td style="padding:8px 0;font-size:13px;color:#E0E8F0;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">×${item.quantity}</td>
      <td style="padding:8px 0;font-size:13px;color:#D4AF37;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;">${formatCurrency(item.amount_total)}</td>
    </tr>
  `).join('')
}

// ── Owner notification email ──────────────────────────────────────────────────

async function sendOwnerNotification(env: Env, session: StripeSession): Promise<void> {
  const ownerEmail = (env as any).SHOP_OWNER_EMAIL ?? env.ADMIN_EMAIL;
  if (!ownerEmail) {
    console.warn('[shop-webhook] SHOP_OWNER_EMAIL / ADMIN_EMAIL not set — skipping owner notification');
    return;
  }

  const customer = session.customer_details;
  const shipping = session.shipping_details;
  const lineItems = session.line_items?.data ?? [];
  const total = session.amount_total ?? 0;
  const orderId = session.id.slice(-8).toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>New Pre-Order — Card Safe HQ</title></head>
<body style="margin:0;padding:0;background:#0A0A0C;font-family:Inter,ui-sans-serif,system-ui;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0C;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111111;border:1px solid rgba(212,175,55,0.25);border-radius:16px;overflow:hidden;">
      <!-- Header -->
      <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#0A0A0C,#1A1408);border-bottom:1px solid rgba(212,175,55,0.15);">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#D4AF37;">Card Safe HQ</p>
        <h1 style="margin:0;font-size:20px;font-weight:800;color:#FFFFFF;">🛒 New Pre-Order Received</h1>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.45);">Order #${orderId}</p>
      </td></tr>
      <!-- Customer info -->
      <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;vertical-align:top;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Customer</p>
              <p style="margin:0;font-size:14px;color:#E0E8F0;">${customer?.name ?? 'Unknown'}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#D4AF37;">${customer?.email ?? 'No email'}</p>
            </td>
            <td style="width:50%;vertical-align:top;padding-left:16px;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Ship To</p>
              <p style="margin:0;font-size:13px;color:#E0E8F0;line-height:1.5;">${formatAddress(shipping)}</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <!-- Line items -->
      <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Items Ordered</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${buildLineItemsHtml(lineItems)}
        </table>
      </td></tr>
      <!-- Total -->
      <tr><td style="padding:16px 28px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:rgba(255,255,255,0.5);">Total Charged</td>
            <td style="text-align:right;font-size:20px;font-weight:800;color:#D4AF37;">${formatCurrency(total)}</td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">Stripe Session ID: ${session.id}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(env, {
    to: ownerEmail,
    subject: `🛒 New Pre-Order #${orderId} — ${customer?.name ?? customer?.email ?? 'Customer'} — ${formatCurrency(total)}`,
    text: `New pre-order received!\n\nCustomer: ${customer?.name ?? 'Unknown'} (${customer?.email ?? 'no email'})\nTotal: ${formatCurrency(total)}\nSession: ${session.id}`,
    html,
  });
}

// ── Customer confirmation email ───────────────────────────────────────────────

async function sendCustomerConfirmation(env: Env, session: StripeSession): Promise<void> {
  const customerEmail = session.customer_details?.email;
  if (!customerEmail) {
    console.warn('[shop-webhook] No customer email in session — skipping customer confirmation');
    return;
  }

  const customer = session.customer_details;
  const lineItems = session.line_items?.data ?? [];
  const total = session.amount_total ?? 0;
  const orderId = session.id.slice(-8).toUpperCase();
  const appUrl = (env as any).APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Pre-Order Confirmed — Card Safe HQ</title></head>
<body style="margin:0;padding:0;background:#0A0A0C;font-family:Inter,ui-sans-serif,system-ui;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0C;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111111;border:1px solid rgba(212,175,55,0.25);border-radius:16px;overflow:hidden;">
      <!-- Header -->
      <tr><td style="padding:28px 28px 20px;background:linear-gradient(135deg,#0A0A0C,#1A1408);border-bottom:1px solid rgba(212,175,55,0.15);text-align:center;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#D4AF37;">Card Safe HQ</p>
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#FFFFFF;">You're locked in. ✅</h1>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.45);">Pre-order #${orderId} confirmed</p>
      </td></tr>
      <!-- Greeting -->
      <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:14px;color:#E0E8F0;line-height:1.6;">Hey ${customer?.name?.split(' ')[0] ?? 'Collector'}, thanks for pre-ordering with Card Safe HQ! Your spot in the first batch is secured. We'll send you a shipping notification the moment your order is on its way.</p>
      </td></tr>
      <!-- What you ordered -->
      <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Your Order</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${buildLineItemsHtml(lineItems)}
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="font-size:13px;color:rgba(255,255,255,0.4);">Order Total</td>
            <td style="text-align:right;font-size:18px;font-weight:800;color:#D4AF37;">${formatCurrency(total)}</td>
          </tr>
        </table>
      </td></tr>
      <!-- What happens next -->
      <tr><td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.35);">What Happens Next</p>
        <table cellpadding="0" cellspacing="0">
          ${[
            ['🔒', 'Pre-order secured', 'Your payment is confirmed and your spot is reserved.'],
            ['📦', 'Production begins', 'We\'re sourcing and fulfilling the first batch.'],
            ['🚚', 'Ships in 2–4 weeks', 'You\'ll get a tracking email the moment it ships.'],
          ].map(([icon, title, desc]) => `
          <tr>
            <td style="padding:6px 12px 6px 0;vertical-align:top;font-size:18px;">${icon}</td>
            <td style="padding:6px 0;">
              <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#E0E8F0;">${title}</p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">${desc}</p>
            </td>
          </tr>`).join('')}
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:20px 28px;text-align:center;">
        <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Questions? Reply to this email or visit <a href="${appUrl}/shop" style="color:#D4AF37;text-decoration:none;">cardsafehq.com/shop</a>.<br />Full refund guaranteed if your order can't be fulfilled.</p>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">Card Safe HQ · Protect. Display. Collect.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(env, {
    to: customerEmail,
    subject: `Pre-order confirmed #${orderId} — Card Safe HQ`,
    text: `Thanks for your pre-order! Order #${orderId} is confirmed. Total: ${formatCurrency(total)}. Ships in 2–4 weeks. Questions? Reply to this email.`,
    html,
  });
}

// ── POST /api/shop/webhook ────────────────────────────────────────────────────

export async function handleShopWebhook(env: Env, request: Request): Promise<Response> {
  const webhookSecret = (env as any).STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[shop-webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
  }

  const payload = await request.text();
  const sigHeader = request.headers.get('stripe-signature') ?? '';

  // Verify signature if secret is configured
  if (webhookSecret && sigHeader) {
    const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!valid) {
      console.error('[shop-webhook] Invalid Stripe signature');
      return new Response('Invalid signature', { status: 400 });
    }
  }

  let event: { type: string; data: { object: StripeSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return badRequest('Invalid JSON payload');
  }

  // Only handle completed checkout sessions
  if (event.type !== 'checkout.session.completed') {
    return ok({ received: true, action: 'ignored', event_type: event.type });
  }

  const sessionId = event.data.object.id;
  if (!sessionId) return badRequest('Missing session ID in event');

  try {
    // Fetch full session with line items expanded (the webhook payload doesn't include them)
    const session = await fetchSessionWithLineItems(env, sessionId);

    // Fire both emails in parallel
    await Promise.allSettled([
      sendOwnerNotification(env, session),
      sendCustomerConfirmation(env, session),
    ]);

    return ok({ received: true, action: 'emails_sent', session_id: sessionId });
  } catch (err) {
    console.error('[shop-webhook] Error processing webhook:', err);
    return serverError((err as Error).message ?? 'Webhook processing failed');
  }
}
