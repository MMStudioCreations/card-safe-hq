/**
 * auth-utils.ts — Shared crypto utilities
 *
 * Exports hashPassword so it can be used from password reset routes
 * without creating circular imports with auth.ts.
 */

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
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

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algo, iterString, saltB64, hashB64] = storedHash.split('$');
  if (algo !== 'pbkdf2' || !iterString || !saltB64 || !hashB64) return false;
  const iterations = Number(iterString);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  const encoder = new TextEncoder();
  const salt = fromBase64(saltB64);
  const expectedHash = fromBase64(hashB64);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations },
    key,
    expectedHash.byteLength * 8,
  );
  const actualHash = new Uint8Array(bits);
  if (actualHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) diff |= actualHash[i] ^ expectedHash[i];
  return diff === 0;
}
