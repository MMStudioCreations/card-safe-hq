/**
 * email.ts — Resend integration for Cloudflare Workers
 *
 * Uses the Resend REST API directly via fetch (no Node.js SDK needed).
 * All emails are sent from noreply@cardsafehq.com — configure this in
 * your Resend dashboard and verify the domain.
 */

import type { Env } from '../types';

const FROM_ADDRESS = 'Card Safe HQ <noreply@cardsafehq.com>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(env: Env, options: SendEmailOptions): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend API error', res.status, body);
    throw new Error('Failed to send email');
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#080C10;font-family:Inter,ui-sans-serif,system-ui;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080C10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0D1117;border:1px solid rgba(0,229,255,0.14);border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(0,229,255,0.10);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;height:40px;background:linear-gradient(145deg,#0D1A24,#131C26);border:1px solid rgba(0,229,255,0.28);border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-size:11px;font-weight:900;color:#F0F6FF;letter-spacing:0.12em;">CS</span>
                  </td>
                  <td style="padding-left:12px;">
                    <div style="font-size:16px;font-weight:700;color:#F0F6FF;">Card Safe HQ</div>
                    <div style="font-size:11px;color:#7A8FA6;">The command center for card collectors</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:11px;color:#4A5A6A;text-align:center;">
                You received this email because an account action was requested on Card Safe HQ.<br/>
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(
  env: Env,
  to: string,
  token: string,
): Promise<void> {
  const appUrl = env.APP_URL ?? 'https://cardsafehq.com';
  const link = `${appUrl}/verify-email?token=${token}`;

  const bodyHtml = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F0F6FF;">Verify your email</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#7A8FA6;line-height:1.6;">
      Welcome to Card Safe HQ! Click the button below to verify your email address and activate your account.
      This link expires in <strong style="color:#F0F6FF;">24 hours</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:linear-gradient(120deg,#00E5FF,#00B8CC 60%,#C9A84C);border-radius:999px;padding:1px;">
          <a href="${link}" style="display:inline-block;padding:12px 28px;background:transparent;border-radius:999px;font-size:14px;font-weight:700;color:#080C10;text-decoration:none;">
            Verify Email Address
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#4A5A6A;">
      Or copy this link into your browser:<br/>
      <a href="${link}" style="color:#00E5FF;word-break:break-all;">${link}</a>
    </p>
  `;

  await sendEmail(env, {
    to,
    subject: 'Verify your Card Safe HQ email',
    html: baseTemplate('Verify your email — Card Safe HQ', bodyHtml),
  });
}

export async function sendPasswordResetEmail(
  env: Env,
  to: string,
  token: string,
): Promise<void> {
  const appUrl = env.APP_URL ?? 'https://cardsafehq.com';
  const link = `${appUrl}/reset-password?token=${token}`;

  const bodyHtml = `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F0F6FF;">Reset your password</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#7A8FA6;line-height:1.6;">
      We received a request to reset the password for your Card Safe HQ account.
      Click the button below to set a new password. This link expires in <strong style="color:#F0F6FF;">1 hour</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:linear-gradient(120deg,#00E5FF,#00B8CC 60%,#C9A84C);border-radius:999px;padding:1px;">
          <a href="${link}" style="display:inline-block;padding:12px 28px;background:transparent;border-radius:999px;font-size:14px;font-weight:700;color:#080C10;text-decoration:none;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#4A5A6A;">
      Or copy this link into your browser:<br/>
      <a href="${link}" style="color:#00E5FF;word-break:break-all;">${link}</a>
    </p>
  `;

  await sendEmail(env, {
    to,
    subject: 'Reset your Card Safe HQ password',
    html: baseTemplate('Reset your password — Card Safe HQ', bodyHtml),
  });
}
