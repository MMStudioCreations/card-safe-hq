import type { Env, User } from '../types';
import { queryOne, run } from './db';
import { unauthorized } from './json';

const COOKIE_NAME = 'cv_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

interface UserRow extends User {
  password_hash: string;
}

export async function registerUser(env: Env, input: { email: string; password: string; username?: string | null }) {
  const existing = await queryOne<UserRow>(env.DB, 'SELECT * FROM users WHERE email = ?', [input.email]);
  if (existing) {
    throw new Error('Email already in use');
  }

  const passwordHash = await hashPassword(input.password);
  await run(env.DB, 'INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)', [
    input.email,
    passwordHash,
    input.username ?? null,
  ]);

  const user = await queryOne<User>(env.DB, 'SELECT id, email, username, created_at FROM users WHERE email = ?', [input.email]);
  if (!user) {
    throw new Error('Unable to create user');
  }
  return user;
}

export async function loginUser(env: Env, email: string, password: string) {
  const user = await queryOne<UserRow>(env.DB, 'SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return null;
  }

  // Limit to 10 concurrent sessions per user — expire oldest if exceeded
  const sessionCount = await queryOne<{ cnt: number }>(
    env.DB,
    'SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP',
    [user.id],
  );
  if ((sessionCount?.cnt ?? 0) >= 10) {
    // Delete the oldest session for this user
    await run(
      env.DB,
      `DELETE FROM sessions WHERE id = (
         SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
       )`,
      [user.id],
    );
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await run(env.DB, 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [sessionId, user.id, expiresAt]);

  return {
    user: { id: user.id, email: user.email, username: user.username, created_at: user.created_at },
    cookie: makeSessionCookie(sessionId, expiresAt),
  };
}

export async function logoutUser(env: Env, request: Request): Promise<string> {
  const sessionId = getSessionIdFromCookie(request.headers.get('cookie'));
  if (sessionId) {
    await run(env.DB, 'DELETE FROM sessions WHERE id = ?', [sessionId]);
  }
  return clearSessionCookie();
}

export async function getCurrentUser(env: Env, request: Request): Promise<User | null> {
  const sessionId = getSessionIdFromCookie(request.headers.get('cookie'));
  if (!sessionId) {
    return null;
  }

  const user = await queryOne<User>(
    env.DB,
    `SELECT u.id, u.email, u.username, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP`,
    [sessionId],
  );

  return user;
}

export async function requireAuth(env: Env, request: Request): Promise<User | Response> {
  const user = await getCurrentUser(env, request);
  if (!user) {
    return unauthorized('You must be signed in');
  }
  return user;
}

function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
}

function makeSessionCookie(sessionId: string, expiresAt: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=None; Expires=${new Date(expiresAt).toUTCString()}`;
}

function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );

  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algo, iterString, saltB64, hashB64] = storedHash.split('$');
  if (algo !== 'pbkdf2' || !iterString || !saltB64 || !hashB64) return false;

  const iterations = Number(iterString);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;

  const encoder = new TextEncoder();
  const salt = fromBase64(saltB64);
  const expectedHash = fromBase64(hashB64);

  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      iterations,
    },
    key,
    expectedHash.byteLength * 8,
  );

  const actualHash = new Uint8Array(bits);
  if (actualHash.length !== expectedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < actualHash.length; i += 1) {
    diff |= actualHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
