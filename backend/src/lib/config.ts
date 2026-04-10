import type { Env } from '../types';

export function isEmailConfigured(env: Env): boolean {
  return Boolean(env.MAILEROO_API_KEY && env.MAIL_FROM && env.APP_BASE_URL);
}

export function isStripeConfigured(env: Env): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
    env.STRIPE_WEBHOOK_SECRET &&
    env.STRIPE_PRICE_ID_MONTHLY &&
    env.STRIPE_PRICE_ID_YEARLY,
  );
}

export function isEmailVerificationEnforced(env: Env): boolean {
  return env.ENFORCE_EMAIL_VERIFICATION === '1';
}
