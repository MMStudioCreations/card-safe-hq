import type { Env, User } from '../types';
import { badRequest, ok, unauthorized } from '../lib/json';
import { parseJsonBody, asString, asEmail } from '../lib/validation';
import { queryOne, run } from '../lib/db';
import { hashPassword, verifyPassword } from '../lib/auth-utils';

interface UserRow extends User {
  password_hash: string;
}

export async function handleUpdateProfile(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<{ username?: unknown; email?: unknown }>(request);
  if (body instanceof Response) return body;

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (body.username !== undefined) {
    const username = asString(body.username, 'username', 50);
    if (username !== null && username.trim().length === 0) return badRequest('Username cannot be empty');
    updates.push('username = ?');
    params.push(username?.trim() ?? '');
  }

  if (body.email !== undefined) {
    let email: string;
    try {
      email = asEmail(body.email);
    } catch {
      return badRequest('Invalid email address');
    }
    // Check if email is already taken by another user
    const existing = await queryOne<{ id: number }>(env.DB, 'SELECT id FROM users WHERE email = ? AND id != ?', [email, user.id]);
    if (existing) return badRequest('Email is already in use by another account');
    updates.push('email = ?');
    params.push(email);
    // Reset email verification when email changes
    updates.push('email_verified = 0');
  }

  if (updates.length === 0) return badRequest('No fields to update');

  params.push(user.id);
  await run(env.DB, `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  return ok({ updated: true });
}

export async function handleChangePassword(env: Env, request: Request, user: User): Promise<Response> {
  const body = await parseJsonBody<{ currentPassword?: unknown; newPassword?: unknown }>(request);
  if (body instanceof Response) return body;

  const { currentPassword, newPassword } = body;
  if (typeof currentPassword !== 'string' || !currentPassword) return badRequest('Current password is required');
  if (typeof newPassword !== 'string' || !newPassword) return badRequest('New password is required');
  if (newPassword.length < 8) return badRequest('New password must be at least 8 characters');
  if (newPassword.length > 72) return badRequest('New password must be 72 characters or fewer');

  // Fetch current password hash
  const userRow = await queryOne<UserRow>(env.DB, 'SELECT * FROM users WHERE id = ?', [user.id]);
  if (!userRow) return unauthorized('User not found');

  const valid = await verifyPassword(userRow.password_hash, currentPassword);
  if (!valid) return badRequest('Current password is incorrect');

  const newHash = await hashPassword(newPassword);
  await run(env.DB, 'UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

  // Invalidate all other sessions for security
  await run(env.DB, 'DELETE FROM sessions WHERE user_id = ?', [user.id]);

  return ok({ changed: true });
}
