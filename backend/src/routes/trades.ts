/**
 * trades.ts — Trade offer system
 *
 * Routes:
 *   GET    /api/trades                  — list trades for current user (sent + received)
 *   POST   /api/trades                  — create a new trade offer
 *   GET    /api/trades/:id              — get single trade with items
 *   PATCH  /api/trades/:id/status       — accept / decline / cancel / complete
 *   DELETE /api/trades/:id              — delete a trade (initiator only, while pending)
 *
 *   GET    /api/notifications            — list notifications for current user
 *   PATCH  /api/notifications/read-all  — mark all as read
 *   PATCH  /api/notifications/:id/read  — mark single notification as read
 */

import type { Env, User } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, notFound, ok, serverError } from '../lib/json';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createNotification(
  env: Env,
  userId: number,
  type: string,
  title: string,
  body: string | null,
  tradeId: number | null,
): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO notifications (user_id, type, title, body, trade_id) VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, body, tradeId],
  );
}

// ── GET /api/trades ───────────────────────────────────────────────────────────

export async function listTrades(env: Env, _request: Request, user: User): Promise<Response> {
  const trades = await queryAll<{
    id: number;
    initiator_id: number;
    recipient_id: number;
    status: string;
    message: string | null;
    created_at: string;
    updated_at: string;
    initiator_username: string | null;
    initiator_email: string;
    recipient_username: string | null;
    recipient_email: string;
  }>(
    env.DB,
    `SELECT t.*,
            ui.username AS initiator_username, ui.email AS initiator_email,
            ur.username AS recipient_username, ur.email AS recipient_email
     FROM trades t
     JOIN users ui ON t.initiator_id = ui.id
     JOIN users ur ON t.recipient_id = ur.id
     WHERE t.initiator_id = ? OR t.recipient_id = ?
     ORDER BY t.updated_at DESC
     LIMIT 100`,
    [user.id, user.id],
  );
  return ok(trades);
}

// ── POST /api/trades ──────────────────────────────────────────────────────────

export async function createTrade(env: Env, request: Request, user: User): Promise<Response> {
  let body: {
    recipient_id: number;
    offer_item_ids: number[];    // collection_item ids the initiator offers
    request_item_ids: number[];  // collection_item ids the initiator wants
    message?: string;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { recipient_id, offer_item_ids, request_item_ids, message } = body;

  if (!recipient_id || typeof recipient_id !== 'number') return badRequest('recipient_id is required');
  if (recipient_id === user.id) return badRequest('Cannot trade with yourself');
  if (!Array.isArray(offer_item_ids) || offer_item_ids.length === 0) return badRequest('offer_item_ids must be a non-empty array');
  if (!Array.isArray(request_item_ids) || request_item_ids.length === 0) return badRequest('request_item_ids must be a non-empty array');

  // Verify recipient exists
  const recipient = await queryOne<{ id: number; username: string | null; email: string }>(
    env.DB, 'SELECT id, username, email FROM users WHERE id = ?', [recipient_id],
  );
  if (!recipient) return notFound('Recipient user not found');

  // Verify all offered items belong to the initiator
  for (const itemId of offer_item_ids) {
    const item = await queryOne<{ id: number }>(
      env.DB, 'SELECT id FROM collection_items WHERE id = ? AND user_id = ?', [itemId, user.id],
    );
    if (!item) return badRequest(`Offered item ${itemId} not found in your collection`);
  }

  // Verify all requested items belong to the recipient
  for (const itemId of request_item_ids) {
    const item = await queryOne<{ id: number }>(
      env.DB, 'SELECT id FROM collection_items WHERE id = ? AND user_id = ?', [itemId, recipient_id],
    );
    if (!item) return badRequest(`Requested item ${itemId} not found in recipient's collection`);
  }

  // Create the trade
  await run(
    env.DB,
    `INSERT INTO trades (initiator_id, recipient_id, status, message) VALUES (?, ?, 'pending', ?)`,
    [user.id, recipient_id, message ?? null],
  );
  const trade = await queryOne<{ id: number }>(env.DB, 'SELECT id FROM trades WHERE id = last_insert_rowid()');
  if (!trade) return serverError('Failed to create trade');
  const tradeId = trade.id;

  // Insert trade items
  for (const itemId of offer_item_ids) {
    await run(env.DB, `INSERT INTO trade_items (trade_id, collection_item_id, direction) VALUES (?, ?, 'offer')`, [tradeId, itemId]);
  }
  for (const itemId of request_item_ids) {
    await run(env.DB, `INSERT INTO trade_items (trade_id, collection_item_id, direction) VALUES (?, ?, 'request')`, [tradeId, itemId]);
  }

  // Notify recipient
  const initiatorName = user.username ?? user.email;
  await createNotification(
    env, recipient_id, 'trade_offer',
    `New trade offer from ${initiatorName}`,
    message ?? `${initiatorName} wants to trade ${offer_item_ids.length} item(s) for ${request_item_ids.length} of yours.`,
    tradeId,
  );

  return ok({ trade_id: tradeId, status: 'pending' }, 201);
}

// ── GET /api/trades/:id ───────────────────────────────────────────────────────

export async function getTrade(env: Env, _request: Request, user: User, tradeId: number): Promise<Response> {
  const trade = await queryOne<{
    id: number; initiator_id: number; recipient_id: number;
    status: string; message: string | null; created_at: string; updated_at: string;
    initiator_username: string | null; initiator_email: string;
    recipient_username: string | null; recipient_email: string;
  }>(
    env.DB,
    `SELECT t.*,
            ui.username AS initiator_username, ui.email AS initiator_email,
            ur.username AS recipient_username, ur.email AS recipient_email
     FROM trades t
     JOIN users ui ON t.initiator_id = ui.id
     JOIN users ur ON t.recipient_id = ur.id
     WHERE t.id = ? AND (t.initiator_id = ? OR t.recipient_id = ?)`,
    [tradeId, user.id, user.id],
  );
  if (!trade) return notFound('Trade not found');

  const items = await queryAll<{
    id: number; collection_item_id: number; direction: string;
    card_name: string | null; player_name: string | null;
    set_name: string | null; estimated_value_cents: number | null;
    front_image_url: string | null;
  }>(
    env.DB,
    `SELECT ti.id, ti.collection_item_id, ti.direction,
            c.card_name, c.player_name, c.set_name,
            ci.estimated_value_cents, ci.front_image_url
     FROM trade_items ti
     JOIN collection_items ci ON ti.collection_item_id = ci.id
     LEFT JOIN cards c ON ci.card_id = c.id
     WHERE ti.trade_id = ?`,
    [tradeId],
  );

  return ok({ ...trade, items });
}

// ── PATCH /api/trades/:id/status ──────────────────────────────────────────────

export async function updateTradeStatus(env: Env, request: Request, user: User, tradeId: number): Promise<Response> {
  const trade = await queryOne<{ id: number; initiator_id: number; recipient_id: number; status: string }>(
    env.DB,
    `SELECT id, initiator_id, recipient_id, status FROM trades WHERE id = ? AND (initiator_id = ? OR recipient_id = ?)`,
    [tradeId, user.id, user.id],
  );
  if (!trade) return notFound('Trade not found');

  let body: { status: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { status } = body;

  // Allow 'completed' only when trade is 'accepted'; all other transitions require 'pending'
  if (status === 'completed' && trade.status !== 'accepted') {
    return badRequest('Trade must be accepted before it can be marked as completed');
  }
  if (status !== 'completed' && trade.status !== 'pending') {
    return badRequest(`Trade is already ${trade.status}`);
  }
  const isInitiator = trade.initiator_id === user.id;
  const isRecipient = trade.recipient_id === user.id;

  // Permission rules:
  // accept / decline — recipient only
  // cancel           — initiator only
  // completed        — recipient only (after acceptance, marks as fully done)
  if (status === 'accepted' || status === 'declined') {
    if (!isRecipient) return badRequest('Only the recipient can accept or decline a trade');
  } else if (status === 'cancelled') {
    if (!isInitiator) return badRequest('Only the initiator can cancel a trade');
  } else if (status === 'completed') {
    if (!isRecipient) return badRequest('Only the recipient can mark a trade as completed');
  } else {
    return badRequest('status must be one of: accepted, declined, cancelled, completed');
  }

  await run(
    env.DB,
    `UPDATE trades SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, tradeId],
  );

  // Notify the other party
  const actorName = user.username ?? user.email;
  const notifyUserId = isInitiator ? trade.recipient_id : trade.initiator_id;
  const notifType = `trade_${status}` as string;
  const notifTitle =
    status === 'accepted'   ? `${actorName} accepted your trade offer` :
    status === 'declined'   ? `${actorName} declined your trade offer` :
    status === 'cancelled'  ? `${actorName} cancelled a trade offer`   :
    status === 'completed'  ? `Trade marked as completed by ${actorName}` :
    `Trade updated`;

  await createNotification(env, notifyUserId, notifType, notifTitle, null, tradeId);

  return ok({ trade_id: tradeId, status });
}

// ── DELETE /api/trades/:id ────────────────────────────────────────────────────

export async function deleteTrade(env: Env, _request: Request, user: User, tradeId: number): Promise<Response> {
  const trade = await queryOne<{ id: number; initiator_id: number; status: string }>(
    env.DB,
    `SELECT id, initiator_id, status FROM trades WHERE id = ? AND initiator_id = ?`,
    [tradeId, user.id],
  );
  if (!trade) return notFound('Trade not found or you are not the initiator');
  if (trade.status !== 'pending') return badRequest('Only pending trades can be deleted');

  await run(env.DB, `DELETE FROM trades WHERE id = ?`, [tradeId]);
  return ok({ deleted: true, trade_id: tradeId });
}

// ── GET /api/notifications ────────────────────────────────────────────────────

export async function listNotifications(env: Env, _request: Request, user: User): Promise<Response> {
  const notifications = await queryAll<{
    id: number; type: string; title: string; body: string | null;
    trade_id: number | null; read: number; created_at: string;
  }>(
    env.DB,
    `SELECT id, type, title, body, trade_id, read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [user.id],
  );
  const unread_count = notifications.filter((n) => n.read === 0).length;
  return ok({ notifications, unread_count });
}

// ── PATCH /api/notifications/read-all ────────────────────────────────────────

export async function markAllNotificationsRead(env: Env, _request: Request, user: User): Promise<Response> {
  await run(env.DB, `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`, [user.id]);
  return ok({ marked_read: true });
}

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────

export async function markNotificationRead(env: Env, _request: Request, user: User, notificationId: number): Promise<Response> {
  const n = await queryOne<{ id: number }>(
    env.DB, 'SELECT id FROM notifications WHERE id = ? AND user_id = ?', [notificationId, user.id],
  );
  if (!n) return notFound('Notification not found');
  await run(env.DB, `UPDATE notifications SET read = 1 WHERE id = ?`, [notificationId]);
  return ok({ marked_read: true, notification_id: notificationId });
}
