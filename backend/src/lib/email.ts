import type { Env } from '../types';
import { isEmailConfigured } from './config';

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
  if (!isEmailConfigured(env)) {
    console.warn('[email] Maileroo not configured (MAILEROO_API_KEY / MAIL_FROM / APP_BASE_URL)');
    return { ok: false, error: 'email_not_configured' };
  }

  const response = await fetch('https://smtp.maileroo.com/api/v2/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.MAILEROO_API_KEY as string,
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [options.to],
      subject: options.subject,
      text: options.text,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[email] Maileroo API error', response.status, body);
    return { ok: false, error: 'provider_error', status: response.status };
  }

  return { ok: true, status: response.status };
}

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head><body style="margin:0;padding:0;background:#080C10;font-family:Inter,ui-sans-serif,system-ui;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#080C10;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0D1117;border:1px solid rgba(0,229,255,0.14);border-radius:16px;overflow:hidden;"><tr><td style="padding:28px 32px;">${bodyHtml}</td></tr></table></td></tr></table></body></html>`;
}

export async function sendVerificationEmail(env: Env, to: string, token: string): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const link = `${appUrl}/verify-email?token=${token}`;
  const html = baseTemplate('Verify your email — Card Safe HQ', `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F0F6FF;">Verify your email</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#7A8FA6;line-height:1.6;">Welcome to Card Safe HQ. This link expires in 24 hours.</p>
    <p><a href="${link}" style="color:#00E5FF;">Verify Email Address</a></p>
  `);
  return sendEmail(env, {
    to,
    subject: 'Verify your Card Safe HQ email',
    text: `Verify your email: ${link}`,
    html,
  });
}

export async function sendPasswordResetEmail(env: Env, to: string, token: string): Promise<EmailSendResult> {
  const appUrl = env.APP_BASE_URL ?? env.APP_URL ?? 'https://cardsafehq.com';
  const link = `${appUrl}/reset-password?token=${token}`;
  const html = baseTemplate('Reset your password — Card Safe HQ', `
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#F0F6FF;">Reset your password</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#7A8FA6;line-height:1.6;">This link expires in 1 hour.</p>
    <p><a href="${link}" style="color:#00E5FF;">Reset Password</a></p>
  `);
  return sendEmail(env, {
    to,
    subject: 'Reset your Card Safe HQ password',
    text: `Reset your password: ${link}`,
    html,
  });
}
