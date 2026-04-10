/**
 * email-auth.ts — Email verification and password reset routes
 *
 * Routes:
 *   POST /api/auth/verify-email          — verify email with token
 *   POST /api/auth/resend-verification   — resend verification email
 *   POST /api/auth/forgot-password       — request password reset email
 *   POST /api/auth/reset-password        — set new password with token
 */

import type { Env } from '../types';
import { queryOne, run } from '../lib/db';
import { hashPassword } from '../lib/auth-utils';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';
import { isEmailConfigured } from '../lib/config';
import { badRequest, ok } from '../lib/json';
import { asEmail, parseJsonBody } from '../lib/validation';
import { getCurrentUser } from '../lib/auth';

// ── Token helpers ─────────────────────────────────────────────────────────────

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// ── Verify Email ──────────────────────────────────────────────────────────────

export async function handleVerifyEmail(env: Env, request: Request): Promise<Response> {
  const body = await parseJsonBody<{ token: unknown }>(request);
  if (body instanceof Response) return body;

  const token = typeof body.token === 'string' ? body.token.trim() : null;
  if (!token) return badRequest('Token is required');

  const row = await queryOne<{ user_id: number; expires_at: string }>(
    env.DB,
    "SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?",
    [token],
  );

  if (!row) return badRequest('Invalid or expired verification link');
  if (new Date(row.expires_at) < new Date()) {
    await run(env.DB, "DELETE FROM email_verification_tokens WHERE token = ?", [token]);
    return badRequest('Verification link has expired. Please request a new one.');
  }

  await run(env.DB, "UPDATE users SET email_verified = 1 WHERE id = ?", [row.user_id]);
  await run(env.DB, "DELETE FROM email_verification_tokens WHERE user_id = ?", [row.user_id]);

  return ok({ verified: true });
}

// ── Resend Verification ───────────────────────────────────────────────────────

export async function handleResendVerification(env: Env, request: Request): Promise<Response> {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return badRequest('You must be logged in to resend verification');
  }

  const userRow = await queryOne<{ email_verified: number; email: string }>(
    env.DB,
    "SELECT email_verified, email FROM users WHERE id = ?",
    [user.id],
  );

  if (!userRow) return badRequest('User not found');
  if (userRow.email_verified) return badRequest('Email is already verified');

  // Rate limit: delete old tokens and issue a new one
  await run(env.DB, "DELETE FROM email_verification_tokens WHERE user_id = ?", [user.id]);
  const token = generateToken();
  await run(
    env.DB,
    "INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
    [token, user.id, hoursFromNow(24)],
  );

  const sent = await sendVerificationEmail(env, userRow.email, token);
  if (!sent.ok && !isEmailConfigured(env)) {
    return ok({ sent: false, message: 'Email delivery is temporarily unavailable.' });
  }
  return ok({ sent: sent.ok });
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export async function handleForgotPassword(env: Env, request: Request): Promise<Response> {
  const body = await parseJsonBody<{ email: unknown }>(request);
  if (body instanceof Response) return body;

  let email: string;
  try {
    email = asEmail(body.email);
  } catch {
    return badRequest('A valid email address is required');
  }

  // Always return success to avoid email enumeration
  const user = await queryOne<{ id: number }>(
    env.DB,
    "SELECT id FROM users WHERE email = ?",
    [email],
  );

  if (user) {
    // Delete any existing reset tokens for this user
    await run(env.DB, "DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);

    const token = generateToken();
    await run(
      env.DB,
      "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
      [token, user.id, hoursFromNow(1)],
    );

    try {
      await sendPasswordResetEmail(env, email, token);
    } catch (err) {
      console.error('[forgot-password] Failed to send email', err);
      // Don't expose the error to the client
    }
  }

  if (!isEmailConfigured(env)) {
    return ok({ sent: false, message: 'Email delivery is temporarily unavailable.' });
  }

  return ok({ sent: true });
}

// ── Reset Password ────────────────────────────────────────────────────────────

export async function handleResetPassword(env: Env, request: Request): Promise<Response> {
  const body = await parseJsonBody<{ token: unknown; password: unknown }>(request);
  if (body instanceof Response) return body;

  const token = typeof body.token === 'string' ? body.token.trim() : null;
  if (!token) return badRequest('Token is required');

  const passwordRaw = body.password;
  if (typeof passwordRaw !== 'string') return badRequest('Password is required');
  if (passwordRaw.length < 8) return badRequest('Password must be at least 8 characters');
  if (passwordRaw.length > 72) return badRequest('Password must be 72 characters or fewer');

  const row = await queryOne<{ user_id: number; expires_at: string }>(
    env.DB,
    "SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?",
    [token],
  );

  if (!row) return badRequest('Invalid or expired reset link');
  if (new Date(row.expires_at) < new Date()) {
    await run(env.DB, "DELETE FROM password_reset_tokens WHERE token = ?", [token]);
    return badRequest('Reset link has expired. Please request a new one.');
  }

  const passwordHash = await hashPassword(passwordRaw);
  await run(env.DB, "UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, row.user_id]);
  await run(env.DB, "DELETE FROM password_reset_tokens WHERE user_id = ?", [row.user_id]);
  // Invalidate all sessions for security
  await run(env.DB, "DELETE FROM sessions WHERE user_id = ?", [row.user_id]);

  return ok({ reset: true });
}
