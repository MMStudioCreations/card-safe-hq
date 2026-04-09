import type { Env } from './types';
import { requireAuth } from './lib/auth';
import { badRequest, notFound, ok, serverError } from './lib/json';
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

function getAllowedOrigin(request: Request, env: Env): string {
  if (env.CORS_ORIGIN?.trim()) return env.CORS_ORIGIN.trim();
  const origin = request.headers.get('origin') ?? '';
  // Must echo the exact origin (not '*') when credentials are included.
  // Wildcard '*' causes browsers to reject cookies in standalone PWA mode.
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Allow localhost for development
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return origin;
  // For any other origin, echo it back (Cloudflare Workers; auth still requires valid session cookie)
  return origin || 'https://cardsafehq.com';
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request, env));
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
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

      if (method === 'GET' && pathname === '/api/cards') return withCors(await listCards(env, request), request, env);
      if (method === 'POST' && pathname === '/api/cards') return withCors(await createCard(env, request), request, env);

      if (pathname.startsWith('/api/cards/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getCard(env, id), request, env);
        if (method === 'PATCH') return withCors(await updateCard(env, request, id), request, env);
        if (method === 'DELETE') return withCors(await deleteCard(env, id), request, env);
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
        if (method === 'POST') return withCors(await createRelease(env, request), request, env);
      }

      if (pathname.startsWith('/api/releases/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid release id'), request, env);
        if (method === 'GET') return withCors(await getRelease(env, id), request, env);
      }

      if (method === 'GET' && pathname === '/api/comps/search') {
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
        if (method === 'POST') return withCors(await refreshComps(env, id), request, env);
      }

      if (pathname.startsWith('/api/comps/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getComps(env, id), request, env);
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
      }

      // ── Public catalog lookup (used by vision pipeline) ───────────────────
      if (pathname === '/api/catalog/pokemon/lookup') {
        if (method === 'GET') return withCors(await lookupPokemonCard(env, request), request, env);
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

      // ── Billing routes ────────────────────────────────────────────────────────────────
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

      return withCors(notFound('Route not found'), request, env);
    } catch (err) {
      console.error('Unhandled worker error', err);
      return withCors(serverError(), request, env);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // Clean up expired rate limit entries daily
    await env.DB.prepare(
      "DELETE FROM rate_limits WHERE expires_at < datetime('now')"
    ).run();
  },
};
