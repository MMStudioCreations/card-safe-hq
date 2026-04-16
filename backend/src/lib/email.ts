import type { Env } from '../types';

export type EmailSendResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(env: Env, options: SendEmailOptions): Promise<EmailSendResult> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured');
    return { ok: false, error: 'email_not_configured' };
  }

  const from = env.MAIL_FROM ?? 'Card Safe HQ <noreply@cardsafehq.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[email] Resend API error', response.status, body);
    return { ok: false, error: 'provider_error', status: response.status };
  }

  return { ok: true, status: response.status };
}

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0C;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0C;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 0 24px;text-align:center;">
          <table cellpadding="0" cellspacing="0" style="display:inline-table;"><tr>
            <td style="background:linear-gradient(145deg,#0D0D0A,#1A1A10);border:1px solid rgba(212,175,55,0.40);border-radius:12px;padding:10px;">
              <svg viewBox="0 0 44 44" width="36" height="36" fill="none"><path d="M22 4L7 10.5v10.8c0 9.6 6.1 18.6 15 21.7 8.9-3.1 15-12.1 15-21.7V10.5L22 4z" stroke="#D4AF37" stroke-width="1.5" stroke-linejoin="round" fill="rgba(212,175,55,0.07)"/><rect x="15" y="16" width="14" height="11" rx="2" stroke="#D4AF37" stroke-width="1.3" fill="rgba(212,175,55,0.10)"/></svg>
            </td>
            <td style="padding-left:12px;text-align:left;vertical-align:middle;">
              <p style="margin:0;font-size:14px;font-weight:800;letter-spacing:0.12em;color:#D4AF37;text-transform:uppercase;">Card Safe HQ</p>
              <p style="margin:2px 0 0;font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.08em;text-transform:uppercase;">Protect. Display. Collect.</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#0D0D10;border:1px solid rgba(212,175,55,0.12);border-radius:16px;padding:32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 0 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">Card Safe HQ &bull; <a href="https://cardsafehq.com" style="color:rgba(212,175,55,0.5);text-decoration:none;">cardsafehq.com</a></p>
          <p style="margin:6px 0 0;font-size:10px;color:rgba(255,255,255,0.18);">You received this email because you have an account at Card Safe HQ.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function goldButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:linear-gradient(90deg,#D4AF37,#B8960C);color:#0A0A0C;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:100px;margin-top:20px;">${label}</a>`;
}

// ── 1. Account Verification Email ─────────────────────────────────────────────
export async function sendVerificationEmail(env: Env, to: string, token: string): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const link = `${appUrl}/verify-email?token=${token}`;
  const html = baseTemplate('Verify your email — Card Safe HQ', `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F0F6FF;">Verify your email</h2>
    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.65;">
      Welcome to Card Safe HQ! Click the button below to confirm your email address.
      This link expires in <strong style="color:#D4AF37;">24 hours</strong>.
    </p>
    <div style="text-align:center;">${goldButton(link, 'Verify Email Address')}</div>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.25);">If you didn't create an account, you can safely ignore this email.</p>
  `);
  return sendEmail(env, {
    to,
    subject: 'Verify your Card Safe HQ email address',
    html,
    text: `Welcome to Card Safe HQ! Verify your email: ${link}`,
  });
}

// ── 2. Password Reset Email ───────────────────────────────────────────────────
export async function sendPasswordResetEmail(env: Env, to: string, token: string): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const link = `${appUrl}/reset-password?token=${token}`;
  const html = baseTemplate('Reset your password — Card Safe HQ', `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F0F6FF;">Reset your password</h2>
    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.65;">
      We received a request to reset your Card Safe HQ password.
      This link expires in <strong style="color:#D4AF37;">1 hour</strong>.
    </p>
    <div style="text-align:center;">${goldButton(link, 'Reset My Password')}</div>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.25);">If you didn't request a password reset, you can safely ignore this email.</p>
  `);
  return sendEmail(env, {
    to,
    subject: 'Reset your Card Safe HQ password',
    html,
    text: `Reset your Card Safe HQ password: ${link}`,
  });
}

// ── 3. Trade Notification Email ───────────────────────────────────────────────
export type TradeEmailType = 'new_offer' | 'accepted' | 'declined' | 'counter' | 'completed';

export async function sendTradeNotificationEmail(
  env: Env,
  to: string,
  opts: { type: TradeEmailType; tradeId: number; otherUsername: string; cardName?: string }
): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const tradeUrl = `${appUrl}/trades/${opts.tradeId}`;
  type CopyEntry = { subject: string; heading: string; body: string; cta: string };
  const COPY: Record<TradeEmailType, CopyEntry> = {
    new_offer: {
      subject: `New trade offer from ${opts.otherUsername}`,
      heading: 'You have a new trade offer',
      body: `<strong style="color:#F0F6FF;">${opts.otherUsername}</strong> has sent you a trade offer${opts.cardName ? ` for <strong style="color:#D4AF37;">${opts.cardName}</strong>` : ''}. Review it and respond to keep the trade moving.`,
      cta: 'View Trade Offer',
    },
    accepted: {
      subject: `${opts.otherUsername} accepted your trade`,
      heading: 'Trade accepted!',
      body: `<strong style="color:#F0F6FF;">${opts.otherUsername}</strong> accepted your trade offer${opts.cardName ? ` for <strong style="color:#D4AF37;">${opts.cardName}</strong>` : ''}. Coordinate shipping details to complete the trade.`,
      cta: 'View Trade',
    },
    declined: {
      subject: `${opts.otherUsername} declined your trade`,
      heading: 'Trade declined',
      body: `<strong style="color:#F0F6FF;">${opts.otherUsername}</strong> declined your trade offer${opts.cardName ? ` for <strong style="color:#D4AF37;">${opts.cardName}</strong>` : ''}. You can browse other cards and start a new trade anytime.`,
      cta: 'Browse Trades',
    },
    counter: {
      subject: `${opts.otherUsername} sent a counter offer`,
      heading: 'Counter offer received',
      body: `<strong style="color:#F0F6FF;">${opts.otherUsername}</strong> sent a counter offer${opts.cardName ? ` on your trade for <strong style="color:#D4AF37;">${opts.cardName}</strong>` : ''}. Review and decide whether to accept or negotiate further.`,
      cta: 'View Counter Offer',
    },
    completed: {
      subject: 'Trade completed successfully',
      heading: 'Trade complete!',
      body: `Your trade${opts.cardName ? ` for <strong style="color:#D4AF37;">${opts.cardName}</strong>` : ''} with <strong style="color:#F0F6FF;">${opts.otherUsername}</strong> has been marked as completed. Thanks for trading on Card Safe HQ!`,
      cta: 'View Trade History',
    },
  };
  const c = COPY[opts.type];
  const html = baseTemplate(`${c.heading} — Card Safe HQ`, `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#F0F6FF;">${c.heading}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.65;">${c.body}</p>
    <div style="text-align:center;">${goldButton(tradeUrl, c.cta)}</div>
  `);
  return sendEmail(env, { to, subject: c.subject, html, text: `${c.heading}: ${tradeUrl}` });
}

// ── 4. Pre-Order Confirmation Email ──────────────────────────────────────────
export async function sendPreOrderEmail(
  env: Env,
  to: string,
  opts: { orderRef: string; items: Array<{ name: string; qty: number; price: number }>; totalCents: number }
): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const rows = opts.items.map(i => `<tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.05);">${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}</td><td style="padding:8px 0;font-size:13px;color:#D4AF37;text-align:right;border-bottom:1px solid rgba(255,255,255,0.05);">$${((i.price * i.qty) / 100).toFixed(2)}</td></tr>`).join('');
  const html = baseTemplate('Pre-order confirmed — Card Safe HQ', `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#F0F6FF;">Pre-order confirmed!</h2>
    <p style="margin:0 0 20px;font-size:13px;color:rgba(255,255,255,0.4);">Order ref: <span style="color:#D4AF37;">${opts.orderRef}</span></p>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.65;">Thank you for your pre-order! Your items are reserved and will ship as soon as they become available.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${rows}<tr><td style="padding:12px 0 0;font-size:14px;font-weight:700;color:#F0F6FF;">Total</td><td style="padding:12px 0 0;font-size:14px;font-weight:700;color:#D4AF37;text-align:right;">$${(opts.totalCents / 100).toFixed(2)}</td></tr></table>
    <div style="text-align:center;">${goldButton(`${appUrl}/account`, 'View My Account')}</div>
  `);
  return sendEmail(env, { to, subject: `Pre-order confirmed — ${opts.orderRef}`, html, text: `Pre-order confirmed! Ref: ${opts.orderRef}. Total: $${(opts.totalCents / 100).toFixed(2)}` });
}

// ── 5. Order Confirmation Email ───────────────────────────────────────────────
export async function sendOrderConfirmationEmail(
  env: Env,
  to: string,
  opts: { orderRef: string; items: Array<{ name: string; qty: number; price: number }>; totalCents: number; shippingAddress?: string }
): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const rows = opts.items.map(i => `<tr><td style="padding:8px 0;font-size:13px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.05);">${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}</td><td style="padding:8px 0;font-size:13px;color:#D4AF37;text-align:right;border-bottom:1px solid rgba(255,255,255,0.05);">$${((i.price * i.qty) / 100).toFixed(2)}</td></tr>`).join('');
  const shippingRow = opts.shippingAddress ? `<tr><td colspan="2" style="padding:12px 0 0;"><p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">Shipping to</p><p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${opts.shippingAddress}</p></td></tr>` : '';
  const html = baseTemplate('Order confirmed — Card Safe HQ', `
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#F0F6FF;">Order confirmed!</h2>
    <p style="margin:0 0 20px;font-size:13px;color:rgba(255,255,255,0.4);">Order ref: <span style="color:#D4AF37;">${opts.orderRef}</span></p>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.65;">Thank you for your order! We'll send a shipping confirmation with tracking once your package is on its way.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${rows}<tr><td style="padding:12px 0 0;font-size:14px;font-weight:700;color:#F0F6FF;">Total</td><td style="padding:12px 0 0;font-size:14px;font-weight:700;color:#D4AF37;text-align:right;">$${(opts.totalCents / 100).toFixed(2)}</td></tr>${shippingRow}</table>
    <div style="text-align:center;">${goldButton(`${appUrl}/account`, 'View My Account')}</div>
  `);
  return sendEmail(env, { to, subject: `Order confirmed — ${opts.orderRef}`, html, text: `Order confirmed! Ref: ${opts.orderRef}. Total: $${(opts.totalCents / 100).toFixed(2)}` });
}
