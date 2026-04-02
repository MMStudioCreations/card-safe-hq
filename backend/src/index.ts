import type { Env } from './types';
import { requireAuth } from './lib/auth';
import { badRequest, notFound, serverError } from './lib/json';
import { handleLogin, handleLogout, handleMe, handleRegister } from './routes/auth';
import { createCard, deleteCard, getCard, listCards, updateCard } from './routes/cards';
import {
  createCollectionItem,
  deleteCollectionItem,
  getCollectionItem,
  listCollection,
  updateCollectionItem,
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
import { getMetaDecks, analyzeDeckAgainstCollection } from './routes/meta';

function parseId(pathname: string): number | null {
  const id = Number(pathname.split('/').pop());
  return Number.isInteger(id) && id > 0 ? id : null;
}

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

function getAllowedOrigin(request: Request, env: Env): string {
  if (env.CORS_ORIGIN?.trim()) return env.CORS_ORIGIN.trim();
  const origin = request.headers.get('origin');
  if (origin === 'https://cardsafehq.com') return origin;
  return '*';
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const method = request.method.toUpperCase();

    try {
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': 'https://cardsafehq.com',
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

      if (method === 'POST' && pathname === '/api/auth/register') return withCors(await handleRegister(env, request), request, env);
      if (method === 'POST' && pathname === '/api/auth/login') return withCors(await handleLogin(env, request), request, env);
      if (method === 'POST' && pathname === '/api/auth/logout') return withCors(await handleLogout(env, request), request, env);
      if (method === 'GET' && pathname === '/api/me') return withCors(await handleMe(env, request), request, env);

      if (method === 'GET' && pathname === '/api/cards') return withCors(await listCards(env, request), request, env);
      if (method === 'POST' && pathname === '/api/cards') return withCors(await createCard(env, request), request, env);

      if (pathname.startsWith('/api/cards/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getCard(env, id), request, env);
        if (method === 'PATCH') return withCors(await updateCard(env, request, id), request, env);
        if (method === 'DELETE') return withCors(await deleteCard(env, id), request, env);
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
        headers.set('Access-Control-Allow-Origin', 'https://cardsafehq.com');

        return new Response(object.body, { headers });
      }

      // Pricing routes
      if (pathname.startsWith('/api/pricing/')) {
        const id = parseId(pathname);
        if (!id) return withCors(badRequest('Invalid card id'), request, env);
        if (method === 'GET') return withCors(await getCardPricing(env, id), request, env);
      }

      // Set routes
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

      // Meta routes
      if (pathname.startsWith('/api/meta/')) {
        const game = pathname.replace('/api/meta/', '');
        if (method === 'GET') return withCors(await getMetaDecks(env, game), request, env);
      }

      // Deck analysis
      if (pathname === '/api/deck/analyze') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'POST') return withCors(
          await analyzeDeckAgainstCollection(env, request, user.id),
          request, env,
        );
      }

      // Saved decks
      if (pathname === '/api/decks') {
        const user = await requireAuth(env, request);
        if (user instanceof Response) return withCors(user, request, env);
        if (method === 'GET') return withCors(await listDecks(env, user), request, env);
        if (method === 'POST') return withCors(await saveDeck(env, request, user), request, env);
      }

      return withCors(notFound('Route not found'), request, env);
    } catch (err) {
      console.error('Unhandled worker error', err);
      return withCors(serverError(), request, env);
    }
  },
};
