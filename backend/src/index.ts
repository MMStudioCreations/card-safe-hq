import type { Env } from './types';
import { requireAuth } from './lib/auth';
import { badRequest, notFound, ok, serverError, tooManyRequests } from './lib/json';
import { handleLogin, handleLogout, handleMe, handleRegister } from './routes/auth';
import { createCard, deleteCard, getCard, listCards, updateCard } from './routes/cards';
import {
  batchDeleteCollectionItems,
  createCollectionItem,
  deleteCollectionItem,
  getCollectionItem,
  listCollection,
  updateCollectionItem,
  listWishlist,
  addWishlistItem,
  removeWishlistItem,
} from './routes/collection';
import { getComps, getCompsHistory, refreshComps, searchComps } from './routes/comps';
import { estimateGrade, getLatestGrade } from './routes/grading';
import { createRelease, getRelease, listReleases } from './routes/releases';
import { uploadDirect } from './routes/uploads';
import { confirmIdentification, identifyCollectionItem } from './routes/vision';
import { handleSheetScan } from './routes/scan';
import { generateDeck } from './routes/deck';
import { getCardPricing } from './routes/pricing';
import { getPokemonSets, getSetChecklist, saveDeck, listDecks } from './routes/sets';
import { getMetaDecks, getMetaDeck, analyzeDeckAgainstCollection } from './routes/meta';
import { seedPokemonCatalog, getSeedStatus, lookupPokemonCard } from './routes/seed';
import { handleDashboardSummary } from './routes/dashboard';
import { createDeck, deleteDeck, getDeck, listDecksV2, updateDeck, upsertDeckCard } from './routes/decks';
import {
  handleAdminStats,
  handleAdminUsers,
  handleAdminCards,
  handleAdminActivity,
  handleAdminQuery,
} from './routes/admin';
import {
  listTrades,
  createTrade,
  getTrade,
  updateTradeStatus,
  deleteTrade,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './routes/trades';
import { handleRecrop } from './routes/recrop';
import {
  handleVerifyEmail,
  handleResendVerification,
  handleForgotPassword,
  handleResetPassword,
} from './routes/email-auth';
import {
  handleBillingStatus,
  handleCreateCheckout,
  handleCreatePortal,
  handleStripeWebhook,
} from './routes/billing';
import { handleUpdateProfile, handleChangePassword } from './routes/profile';
import { handleSealedSync, searchSealedLive } from './routes/sealed-sync';
import { handleShopCheckout } from './routes/shop';
import { handleSportsSearch, handleSportsSoldSearch } from './routes/sports';
import { handleShopWebhook } from './routes/shop-webhook';
import { getPriceByCardId } from './workers/prices';
import { runPriceSync } from './workers/price-sync';

const POKEMON_CODE_CARD_KEYWORDS = [
  'code card',
  'online code card',
  'tcg live',
  'pokemon live',
  'ptcgo',
  'redeem code',
  'digital code',
];

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPokemonCodeCard(item: Record<string, unknown>): boolean {
  const fields = [
    item.name,
    item.title,
    item.productName,
    item.displayName,
    item.normalizedDisplayName,
    item.alt,
    item.imageAlt,
    item.set_name,
    item.type,
    item.subtype,
    item.category,
    item.subcategory,
    item.product_type,
    item.tcgplayer_url,
  ];
  const searchableText = fields.map(asText).filter(Boolean).join(' ');
  if (!searchableText.includes('pokemon') && !searchableText.includes('pokémon')) return false;
  return POKEMON_CODE_CARD_KEYWORDS.some(keyword => searchableText.includes(keyword));
}

function parseId(pathname: string): number | null {
  const id = Number(pathname.split('/').pop());
  return Number.isInteger(id) && id > 0 ? id : null;
}

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

const ALLOWED_ORIGINS = new Set([
  'https://cardsafehq.com',
  'https://www.cardsafehq.com',
  'https://card-vault-ai.pages.dev',
]);

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'",
};

function getAllowedOrigin(request: Request, env: Env): string | null {
  if (env.CORS_ORIGIN?.trim()) return env.CORS_ORIGIN.trim();
  const origin = request.headers.get('origin') ?? '';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return origin;
  if (origin.endsWith('.github.io')) return origin;
  return null;
}

function withCors(response: Response, request: Request, env: Env): Response {
  const allowedOrigin = getAllowedOrigin(request, env);
  if (!allowedOrigin) {
    const h = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
    return new Response(JSON.stringify({ ok: false, error: 'Origin not allowed' }), {
      status: 403,
      headers: h,
    });
  }
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function checkRateLimit(
  env: Env,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  // Use D1 as rate limit store (KV not available in all plans)
  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
  const limitKey = `ratelimit:${key}:${windowStart}`;

  const existing = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE key = ?'
  ).bind(limitKey).first<{ count: number }>();

  if (!existing) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO rate_limits (key, count, expires_at) VALUES (?, 1, datetime("now", ? || " seconds"))'
    ).bind(limitKey, String(windowSeconds)).run();
    return true; // allowed
  }

  if (existing.count >= maxRequests) {
    return false; // blocked
  }

  await env.DB.prepare(
    'UPDATE rate_limits SET count = count + 1 WHERE key = ?'
  ).bind(limitKey).run();
  return true; // allowed
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method.toUpperCase();

    if (!env.CORS_ORIGIN?.trim()) {
      console.error('CORS_ORIGIN is not set — all cross-origin requests will be rejected');
    }

    try {
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      if (method === 'GET' && pathname === '/api/health') {
        return withCors(
          new Response(JSON.stringify({ ok: true, data: { status: 'healthy' } }), {
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
          request,
          env,
        );
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const allowed = await checkRateLimit(env, `login:${ip}`, 10, 900); // 10 per 15min per IP
        if (!allowed) {
          return withCors(new Response(JSON.stringify({ ok: false, error: 'Too many login attempts. Try again in 15 minutes.' }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'Retry-After': '900' },
          }), request, env);
        }
        return withCors(await handleLogin(env, request), request, env);
      }

      if (method === 'POST' && pathname === '/api/auth/register') {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const allowed = await checkRateLimit(env, `register:${ip}`, 5, 3600); // 5 per hour per IP
        if (!allowed) {
          return withCors(new Response(JSON.stringify({ ok: false, error: 'Too many registration attempts.' }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'Retry-After': '3600' },
          }), request, env);
        }
        return withCors(await handleRegister(env, request), request, env);
      }

      if (method === 'POST' && pathname === '/api/auth/logout') return withCors(await handleLogout(env, request), request, env);
      if (method === 'GET' && pathname === '/api/me') return withCors(await handleMe(env, request), request, env);

      // ── Email verification & password reset ────────────────────────────────
      if (method === 'POST' && pathname === '/api/auth/verify-email') {
        return withCors(await handleVerifyEmail(env, request), request, env);
      }
      if (method === 'POST' && pathname === '/api/auth/resend-verification') {
        return withCors(await handleResendVerification(env, request), request, env);
      }
      if (method === 'POST' && pathname === '/api/auth/forgot-password') {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const allowed = await checkRateLimit(env, `forgot:${ip}`, 5, 3600); // 5 per hour
        if (!allowed) {
          return withCors(new Response(JSON.stringify({ ok: false, error: 'Too many requests. Try again later.' }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'Retry-After': '3600' },
          }), request, env);
        }
        return withCors(await handleForgotPassword(env, request), request, env);
      }
      if (method === 'POST' && pathname === '/api/auth/reset-password') {
        return withCors(await handleResetPassword(env, request), request, env);
      }

      // ── Profile update & password change ─────────────────────────────────────────────
      if (method === 'PATCH' && pathname === '/api/auth/profile') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await handleUpdateProfile(env, request, user), request, env);
      }
      if (method === 'POST' && pathname === '/api/auth/change-password') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await handleChangePassword(env, request, user), request, env);
      }

      if (method === 'GET' && pathname === '/api/cards') return withCors(await listCards(env, request), request, env);
      if (method === 'POST' && pathname === '/api/cards') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await createCard(env, request), request, env);
      }

      if (pathname.startsWith('/api/cards/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getCard(env, id), request, env);
        if (method === 'PATCH') {
          const user = await requireAuth(env, request);
          if (user instanceof Response) return withCors(user, request, env);
          return withCors(await updateCard(env, request, id), request, env);
        }
        if (method === 'DELETE') {
          const user = await requireAuth(env, request);
          if (user instanceof Response) return withCors(user, request, env);
          return withCors(await deleteCard(env, id), request, env);
        }
      }

      if (method === 'DELETE' && pathname === '/api/collection/items/batch') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await batchDeleteCollectionItems(env, request, user), request, env);
      }

      if (pathname === '/api/collection') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await listCollection(env, user, request), request, env);
        if (method === 'POST') return withCors(await createCollectionItem(env, request, user), request, env);
      }

      // ── CSV export ────────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/collection/export') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);

        const items = await env.DB.prepare(`
          SELECT
            c.card_name, c.set_name, c.card_number, c.rarity,
            c.game, ci.quantity, ci.condition_note,
            ci.estimated_value_cents,
            (
              SELECT sold_price_cents FROM sales_comps
              WHERE card_id = ci.card_id AND source = 'ebay_sold'
              ORDER BY created_at DESC LIMIT 1
            ) as latest_sold_price_cents,
            c.external_ref,
            ci.created_at
          FROM collection_items ci
          LEFT JOIN cards c ON ci.card_id = c.id
          WHERE ci.user_id = ?
          ORDER BY ci.created_at DESC
        `).bind(user.id).all();

        const rows = (items.results ?? []) as any[];
        const headers = [
          'Card Name', 'Set Name', 'Card Number', 'Rarity', 'Game',
          'Quantity', 'Condition', 'Estimated Value (USD)',
          'Last Sold (USD)', 'TCG ID', 'Added Date',
        ];
        const csvRows = rows.map(r => [
          r.card_name ?? '',
          r.set_name ?? '',
          r.card_number ?? '',
          r.rarity ?? '',
          r.game ?? '',
          r.quantity ?? 1,
          r.condition_note ?? 'Raw',
          r.estimated_value_cents ? (r.estimated_value_cents / 100).toFixed(2) : '0.00',
          r.latest_sold_price_cents ? (r.latest_sold_price_cents / 100).toFixed(2) : '0.00',
          r.external_ref ?? '',
          r.created_at ?? '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        const csv = [headers.join(','), ...csvRows].join('\n');

        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="card-safe-hq-collection.csv"',
            'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      }

      // ── Market movers ─────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/api/collection/movers') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);

        const movers = await env.DB.prepare(`
          SELECT
            c.card_name, c.set_name, c.rarity, c.image_url,
            ci.id as collection_item_id,
            ci.front_image_url, ci.bbox_x, ci.bbox_y, ci.bbox_width, ci.bbox_height,
            (
              SELECT sold_price_cents FROM sales_comps
              WHERE card_id = ci.card_id AND source = 'ebay_sold'
              ORDER BY created_at DESC LIMIT 1
            ) as current_price_cents,
            (
              SELECT sold_price_cents FROM sales_comps
              WHERE card_id = ci.card_id AND source = 'ebay_sold'
              ORDER BY created_at DESC LIMIT 1 OFFSET 1
            ) as previous_price_cents
          FROM collection_items ci
          LEFT JOIN cards c ON ci.card_id = c.id
          WHERE ci.user_id = ?
          HAVING current_price_cents IS NOT NULL
            AND previous_price_cents IS NOT NULL
            AND current_price_cents != previous_price_cents
          ORDER BY ABS(current_price_cents - previous_price_cents) DESC
          LIMIT 10
        `).bind(user.id).all();

        return withCors(ok({ movers: movers.results ?? [] }), request, env);
      }

      if (pathname.startsWith('/api/collection/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid collection id'), request, env);
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await getCollectionItem(env, user, id), request, env);
        if (method === 'PATCH') return withCors(await updateCollectionItem(env, request, user, id), request, env);
        if (method === 'DELETE') return withCors(await deleteCollectionItem(env, user, id), request, env);
      }

      // Wishlist
      if (pathname === '/api/wishlist') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await listWishlist(env, user), request, env);
        if (method === 'POST') return withCors(await addWishlistItem(env, request, user), request, env);
      }

      if (pathname.startsWith('/api/wishlist/')) {
        const ptcgId = decodeURIComponent(pathname.replace('/api/wishlist/', ''));
        if (!ptcgId) return withCors(badRequest('Invalid ptcg_id'), request, env);
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'DELETE') return withCors(await removeWishlistItem(env, user, ptcgId), request, env);
      }

      if (method === 'POST' && pathname === '/api/uploads/direct') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await uploadDirect(env, request, user), request, env);
      }

      if (pathname === '/api/releases') {
        if (method === 'GET') return withCors(await listReleases(env, request), request, env);
        if (method === 'POST') {
          const user = await requireAuth(env, request);
          if (user instanceof Response) return withCors(user, request, env);
          return withCors(await createRelease(env, request), request, env);
        }
      }

      if (pathname.startsWith('/api/releases/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid release id'), request, env);
        if (method === 'GET') return withCors(await getRelease(env, id), request, env);
      }

      if (method === 'GET' && pathname === '/api/comps/search') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        const { success: allowed } = await env.COMPS_RATE_LIMITER.limit({ key: String(user.id) });
        if (!allowed) return withCors(tooManyRequests('Too many comps requests — try again later'), request, env);
        return withCors(await searchComps(env, request), request, env);
      }

      if (pathname.startsWith('/api/comps/history/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getCompsHistory(env, id), request, env);
      }

      if (pathname.startsWith('/api/comps/refresh/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'POST') {
          const user = await requireAuth(env, request);
          if (user instanceof Response) return withCors(user, request, env);
          const { success: allowed } = await env.COMPS_RATE_LIMITER.limit({ key: String(user.id) });
          if (!allowed) return withCors(tooManyRequests('Too many comps requests — try again later'), request, env);
          return withCors(await refreshComps(env, id), request, env);
        }
      }

      if (pathname.startsWith('/api/comps/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') {
          const user = await requireAuth(env, request);
          if (user instanceof Response) return withCors(user, request, env);
          const { success: allowed } = await env.COMPS_RATE_LIMITER.limit({ key: String(user.id) });
          if (!allowed) return withCors(tooManyRequests('Too many comps requests — try again later'), request, env);
          return withCors(await getComps(env, id), request, env);
        }
      }

      if (method === 'POST' && pathname === '/api/grading/estimate') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await estimateGrade(env, request, user), request, env);
      }

      if (pathname.startsWith('/api/grading/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid collection item id'), request, env);
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await getLatestGrade(env, id, user), request, env);
      }

      if (pathname === '/api/deck/generate') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'POST') return withCors(await generateDeck(env, request, user), request, env);
      }

      if (method === 'POST' && pathname === '/api/scan/sheet') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await handleSheetScan(env, request, user), request, env);
      }

      if (method === 'POST' && pathname === '/api/vision/identify') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await identifyCollectionItem(env, request, user), request, env);
      }

      if (method === 'POST' && pathname.startsWith('/api/vision/confirm/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid collection item id'), request, env);
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await confirmIdentification(env, request, user, id), request, env);
      }

      if (method === 'GET' && pathname.startsWith('/api/images/')) {
        const key = decodeURIComponent(pathname.replace('/api/images/', ''));
        if (!key || key.includes('..')) return withCors(badRequest('Invalid key'), request, env);

        const object = await env.BUCKET.get(key);
        if (!object) return withCors(notFound('Image not found'), request, env);

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request, env));

        return new Response(object.body, { headers });
      }

      if (pathname.startsWith('/api/pricing/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getCardPricing(env, id), request, env);
      }

      if (method === 'GET' && pathname === '/api/sets/pokemon') {
        return withCors(await getPokemonSets(env, request), request, env);
      }

      if (pathname.startsWith('/api/sets/pokemon/') && pathname.endsWith('/checklist')) {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        const setId = pathname.replace('/api/sets/pokemon/', '').replace('/checklist', '');
        if (!setId) return withCors(badRequest('Invalid set id'), request, env);
        return withCors(await getSetChecklist(env, setId, user.id), request, env);
      }

      if (pathname.startsWith('/api/meta/')) {
        const parts = pathname.replace('/api/meta/', '').split('/');
        const game = parts[0];
        const deckId = parts[1] ? decodeURIComponent(parts[1]) : null;
        if (method === 'GET') {
          if (deckId) return withCors(await getMetaDeck(env, game, deckId), request, env);
          return withCors(await getMetaDecks(env, game), request, env);
        }
      }

      if (pathname === '/api/deck/analyze') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'POST') return withCors(
          await analyzeDeckAgainstCollection(env, request, user.id),
          request, env,
        );
      }


      if (pathname === '/api/decks/v2') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await listDecksV2(env, user), request, env);
        if (method === 'POST') return withCors(await createDeck(env, request, user), request, env);
      }

      if (pathname.startsWith('/api/decks/v2/')) {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        const deckSegment = pathname.split('/')[4];
        const id = Number(deckSegment);
        if (!Number.isInteger(id) || id <= 0) return withCors(badRequest('Invalid deck id'), request, env);
        if (method === 'GET' && !pathname.endsWith('/cards')) return withCors(await getDeck(env, user, id), request, env);
        if (method === 'PATCH') return withCors(await updateDeck(env, request, user, id), request, env);
        if (method === 'DELETE') return withCors(await deleteDeck(env, user, id), request, env);
        if (method === 'POST' && pathname.endsWith('/cards')) return withCors(await upsertDeckCard(env, request, user, id), request, env);
      }

      if (pathname === '/api/decks') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await listDecks(env, user), request, env);
        if (method === 'POST') return withCors(await saveDeck(env, request, user), request, env);
      }

      // Admin routes — require auth + admin email check inside each handler
      if (pathname.startsWith('/api/admin/')) {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);

        if (method === 'GET' && pathname === '/api/admin/stats') {
          return withCors(await handleAdminStats(env, user), request, env);
        }
        if (method === 'GET' && pathname === '/api/admin/users') {
          return withCors(await handleAdminUsers(env, user), request, env);
        }
        if (method === 'GET' && pathname === '/api/admin/cards') {
          return withCors(await handleAdminCards(env, user), request, env);
        }
        if (method === 'GET' && pathname === '/api/admin/activity') {
          return withCors(await handleAdminActivity(env, user), request, env);
        }
        if (method === 'POST' && pathname === '/api/admin/query') {
          return withCors(await handleAdminQuery(env, user, request), request, env);
        }
        // Pokémon catalog seeder
        if (method === 'POST' && pathname === '/api/admin/seed/pokemon') {
          return withCors(await seedPokemonCatalog(env, request, user), request, env);
        }
        if (method === 'GET' && pathname === '/api/admin/seed/pokemon/status') {
          return withCors(await getSeedStatus(env, user), request, env);
        }
        // Re-crop existing collection items that still show the full sheet
        if (method === 'POST' && pathname === '/api/admin/recrop') {
          return withCors(await handleRecrop(env, request, user), request, env);
        }
        // Sync sealed products catalog from TCGCSV
        if (method === 'POST' && pathname === '/api/admin/sync-sealed') {
          return withCors(await handleSealedSync(env, user), request, env);
        }
      }

      // ── Public catalog lookup (used by vision pipeline) ───────────────────
      if (pathname === '/api/catalog/pokemon/lookup') {
        if (method === 'GET') return withCors(await lookupPokemonCard(env, request), request, env);
      }


      if (method === 'GET' && pathname === '/api/dashboard/summary') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        return withCors(await handleDashboardSummary(env, user), request, env);
      }

      // ── Trades routes ──────────────────────────────────────────────────────
      if (pathname === '/api/trades') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET')  return withCors(await listTrades(env, request, user), request, env);
        if (method === 'POST') return withCors(await createTrade(env, request, user), request, env);
      }
      if (pathname.startsWith('/api/trades/') && pathname.endsWith('/status')) {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        const id = parseId(pathname.replace('/status', ''));
        if (!id) return withCors(badRequest('Invalid trade id'), request, env);
        if (method === 'PATCH') return withCors(await updateTradeStatus(env, request, user, id), request, env);
      }
      if (pathname.startsWith('/api/trades/')) {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid trade id'), request, env);
        if (method === 'GET')    return withCors(await getTrade(env, request, user, id), request, env);
        if (method === 'DELETE') return withCors(await deleteTrade(env, request, user, id), request, env);
      }
      // ── Notifications routes ───────────────────────────────────────────────
      if (pathname === '/api/notifications') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await listNotifications(env, request, user), request, env);
      }
      if (pathname === '/api/notifications/read-all') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'PATCH') return withCors(await markAllNotificationsRead(env, request, user), request, env);
      }
      if (pathname.startsWith('/api/notifications/') && pathname.endsWith('/read')) {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        const id = parseId(pathname.replace('/read', ''));
        if (!id) return withCors(badRequest('Invalid notification id'), request, env);
        if (method === 'PATCH') return withCors(await markNotificationRead(env, request, user, id), request, env);
      }
      // ── Sports card search (eBay Browse API) ──────────────────────────────────
      if (method === 'GET' && pathname === '/api/sports/search') {
        return withCors(await handleSportsSearch(env, request), request, env);
      }
      if (method === 'GET' && pathname === '/api/sports/sold') {
        return withCors(await handleSportsSoldSearch(env, request), request, env);
      }
      // ── Shop checkout (one-time Stripe purchase) ─────────────────────────────────
      if (method === 'POST' && pathname === '/api/shop/checkout') {
        return withCors(await handleShopCheckout(env, request), request, env);
      }
      // Stripe webhook for shop pre-orders (no CORS needed — called by Stripe servers)
      if (method === 'POST' && pathname === '/api/shop/webhook') {
        return handleShopWebhook(env, request);
      }
      // ── Billing routes ────────────────────────────────────────────────────────────
      // Stripe webhook — no auth, raw body needed
      if (method === 'POST' && pathname === '/api/billing/webhook') {
        return await handleStripeWebhook(env, request);
      }
      if (method === 'GET' && pathname === '/api/billing/status') {
        return withCors(await handleBillingStatus(env, request), request, env);
      }
      if (method === 'POST' && pathname === '/api/billing/checkout') {
        return withCors(await handleCreateCheckout(env, request), request, env);
      }
      if (method === 'POST' && pathname === '/api/billing/portal') {
        return withCors(await handleCreatePortal(env, request), request, env);
      }

      // List sealed products catalog (with optional search/type/set filters)
      if (method === 'GET' && pathname === '/api/sealed-products') {
        const url = new URL(request.url)
        const search = url.searchParams.get('q') ?? ''
        const type = url.searchParams.get('type') ?? ''
        const setName = url.searchParams.get('set') ?? ''
        const limit = Math.min(Number(url.searchParams.get('limit') ?? '200'), 500)
        const offset = Number(url.searchParams.get('offset') ?? '0')

        let query = 'SELECT * FROM sealed_products WHERE 1=1'
        const params: (string | number)[] = []
        if (search) { query += ' AND (name LIKE ? OR set_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
        if (type)   { query += ' AND product_type = ?'; params.push(type) }
        if (setName){ query += ' AND set_name = ?'; params.push(setName) }
        query += ' ORDER BY set_name ASC, name ASC LIMIT ? OFFSET ?'
        params.push(limit, offset)

        const rows = await env.DB.prepare(query).bind(...params).all()
        return withCors(ok({ products: rows.results ?? [], total: rows.results?.length ?? 0 }), request, env)
      }

      // On-demand price lookup (TCGFast or PriceCharting via cache)
      if (method === 'GET' && pathname.startsWith('/api/prices/')) {
        return withCors(await getPriceByCardId(env, request), request, env);
      }

      // Refresh price for a sealed product or card from TCGCSV
      if (method === 'POST' && pathname === '/api/prices/refresh') {
        const body = await request.json() as { tcgplayer_product_id: number; type: 'sealed' | 'card' }
        if (!body.tcgplayer_product_id) return withCors(badRequest('Missing tcgplayer_product_id'), request, env)
        
        const { fetchSealedPrice, fetchCardPrice } = await import('./lib/tcgcsv')
        
        if (body.type === 'sealed') {
          const price = await fetchSealedPrice(body.tcgplayer_product_id)
          if (price) {
            await env.DB.prepare(
              `UPDATE sealed_products SET market_price_cents = ? WHERE tcgplayer_product_id = ?`
            ).bind(price, body.tcgplayer_product_id).run()
          }
          return withCors(ok({ price_cents: price }), request, env)
        }
        
        const prices = await fetchCardPrice(body.tcgplayer_product_id)
        return withCors(ok(prices), request, env)
      }

      // Universal search — cards from pokemon_catalog + normalized card_records + sealed products
      // NOTE: This endpoint is PUBLIC — no auth required for search
      if (method === 'GET' && pathname === '/api/search') {
        const url = new URL(request.url)
        const q = (url.searchParams.get('q') ?? '').trim()
        const category = url.searchParams.get('category') ?? 'all' // 'all' | 'cards' | 'sealed'
        const limit = Math.min(Number(url.searchParams.get('limit') ?? '40'), 100)
        if (!q || q.length < 2) return withCors(ok({ cards: [], sealed: [] }), request, env)
        const like = `%${q}%`

        let cards: unknown[] = []
        let sealed: unknown[] = []

        if (category === 'all' || category === 'cards') {
          const cardRows = await env.DB.prepare(
            `SELECT ptcg_id, card_name, card_number, set_name, series, rarity,
                    supertype, subtypes, hp, image_small, image_large,
                    tcgplayer_url, tcgplayer_market_cents
             FROM pokemon_catalog
             WHERE card_name LIKE ? OR set_name LIKE ? OR card_number LIKE ?
             ORDER BY
               CASE WHEN card_name = ? THEN 0
                    WHEN card_name LIKE ? THEN 1
                    ELSE 2 END,
               card_name ASC
             LIMIT ?`
          ).bind(like, like, like, q, `${q}%`, Math.ceil(limit * 0.7)).all()
          cards = cardRows.results ?? []

          // Add non-Pokémon normalized records (Magic, Yu-Gi-Oh!, One Piece, Lorcana)
          try {
            const externalRows = await env.DB.prepare(
              `SELECT
                  ('ext:' || id) AS ptcg_id,
                  name AS card_name,
                  COALESCE(card_number, '') AS card_number,
                  COALESCE(set_name, '') AS set_name,
                  NULL AS series,
                  rarity,
                  type AS supertype,
                  subtype AS subtypes,
                  NULL AS hp,
                  image_url AS image_small,
                  image_url AS image_large,
                  NULL AS tcgplayer_url,
                  CASE
                    WHEN market_price IS NULL THEN NULL
                    ELSE CAST(ROUND(market_price * 100.0) AS INTEGER)
                  END AS tcgplayer_market_cents
               FROM card_records
               WHERE is_sealed = 0
                 AND (name LIKE ? OR set_name LIKE ? OR card_number LIKE ? OR searchable_text LIKE ?)
               ORDER BY
                 CASE WHEN clean_name = ? THEN 0
                      WHEN clean_name LIKE ? THEN 1
                      ELSE 2 END,
                 name ASC
               LIMIT ?`
            ).bind(like, like, like, like, q.toLowerCase(), `${q.toLowerCase()}%`, Math.ceil(limit * 0.5)).all()

            cards = [...cards, ...(externalRows.results ?? [])]
          } catch (externalErr) {
            console.warn('[search] card_records lookup failed; continuing with pokemon catalog only', externalErr)
          }
        }

        if (category === 'all' || category === 'sealed') {
          // First try the local DB
          const sealedRows = await env.DB.prepare(
            `SELECT id, name, set_name, product_type, tcgplayer_url,
                    market_price_cents, release_date, tcgplayer_product_id
             FROM sealed_products
             WHERE name LIKE ? OR set_name LIKE ?
             ORDER BY
               CASE WHEN name = ? THEN 0
                    WHEN name LIKE ? THEN 1
                    ELSE 2 END,
               name ASC
             LIMIT ?`
          ).bind(like, like, q, `${q}%`, Math.ceil(limit * 0.5)).all()
          sealed = (sealedRows.results ?? []).filter((item) => !isPokemonCodeCard(item as Record<string, unknown>))

          // If DB is empty, fall back to live TCGCSV search
          if (sealed.length === 0) {
            try {
              const liveSealed = await searchSealedLive(q, Math.ceil(limit * 0.5))
              sealed = liveSealed.filter((item) => !isPokemonCodeCard(item as Record<string, unknown>))
            } catch (liveErr) {
              console.warn('[search] live sealed fallback failed', liveErr)
            }
          }
        }

        return withCors(ok({ cards, sealed }), request, env)
      }

      return withCors(notFound('Route not found'), request, env);
    } catch (err) {
      console.error('Unhandled worker error', err);
      return withCors(serverError(), request, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < datetime('now')").run();
    await runPriceSync(env);
  },
};
