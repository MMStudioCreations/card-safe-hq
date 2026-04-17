import type { Env } from '../types';

interface PriceCacheRow {
  id: string;
  card_name: string;
  set_name: string | null;
  source: string;
  card_type: string;
  price_nm: number | null;
  price_psa10: number | null;
  fetched_at: number;
}

interface FetchError extends Error {
  httpStatus?: number;
}

type TcgFastCard = {
  name?: string;
  set_name?: string;
  prices?: {
    raw?: {
      near_mint?: {
        tcgplayer?: { market?: number | null };
        ebay?: { avg_7d?: number | null };
      };
    };
    graded?: {
      psa_10?: {
        tcgplayer?: { market?: number | null };
      };
    };
  };
};

type ParsedTcgFastIdentifier = {
  query: string;
  game: string;
  set: string | null;
};

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function apiError(message: string, httpStatus: number): FetchError {
  const err = new Error(message) as FetchError;
  err.httpStatus = httpStatus;
  return err;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

function scoreTextMatch(candidate: string, query: string): number {
  const c = normalizeText(candidate);
  const q = normalizeText(query);
  if (!c || !q) return 0;
  if (c === q) return 120;
  if (c.includes(q)) return 90;

  const cTokens = new Set(tokenize(c));
  const qTokens = tokenize(q);
  if (qTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap += 1;
  }

  return Math.round((overlap / qTokens.length) * 80);
}

function closestByScore<T>(
  rows: T[],
  scorer: (row: T) => number,
): T | null {
  let best: T | null = null;
  let bestScore = -1;

  for (const row of rows) {
    const score = scorer(row);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  return best;
}

function parseTcgFastIdentifier(identifier: string): ParsedTcgFastIdentifier {
  const parts = identifier.split('&');
  const query = parts.shift()?.trim() ?? '';
  const params = new URLSearchParams(parts.join('&'));

  const game = (params.get('game') || 'pokemon').trim().toLowerCase();
  const setRaw = params.get('set');
  const set = setRaw ? setRaw.trim() : null;

  return { query, game, set };
}

async function lookupTcgFast(
  env: Env,
  identifier: string,
): Promise<{ card_name: string; set_name: string | null; price_nm: number | null; price_psa10: number | null; raw_json: string }> {
  const base = env.TCGFAST_BASE_URL ?? 'https://api.tcgpricelookup.com/v1';
  const parsed = parseTcgFastIdentifier(identifier);

  if (!parsed.query) {
    throw apiError('Missing card query for tcgfast lookup', 400);
  }

  const params = new URLSearchParams({ q: parsed.query, game: parsed.game });
  if (parsed.set) params.set('set', parsed.set);

  const searchUrl = `${base}/cards/search?${params.toString()}`;
  console.log('[prices] tcgfast request', { identifier, searchUrl, parsed });

  let res: Response;
  try {
    res = await fetch(searchUrl, {
      headers: { 'X-API-Key': env.TCGFAST_API_KEY ?? '' },
    });
  } catch {
    throw apiError('TCGFast API unreachable', 502);
  }

  if (!res.ok) throw apiError(`TCGFast API error: ${res.status}`, 502);

  const json = await res.json() as { data?: TcgFastCard[] };
  console.log('[prices] tcgfast raw response sample', JSON.stringify(json).slice(0, 1200));

  const cards = Array.isArray(json.data) ? json.data : [];
  if (cards.length === 0) throw apiError('Card not found on TCGFast', 404);

  const matched = closestByScore(cards, (card) => {
    const nameScore = scoreTextMatch(card.name ?? '', parsed.query);
    const setScore = parsed.set ? scoreTextMatch(card.set_name ?? '', parsed.set) : 0;
    return nameScore + setScore;
  }) ?? cards[0];

  const nm = matched?.prices?.raw?.near_mint;
  const graded = matched?.prices?.graded?.psa_10;
  const tcgMarket = nm?.tcgplayer?.market;
  const ebayAvg7d = nm?.ebay?.avg_7d;
  const gradedTcgMarket = graded?.tcgplayer?.market;

  const price_nm =
    typeof tcgMarket === 'number'
      ? tcgMarket
      : typeof ebayAvg7d === 'number'
        ? ebayAvg7d
        : null;

  const price_psa10 = typeof gradedTcgMarket === 'number' ? gradedTcgMarket : null;

  if (price_nm == null || price_psa10 == null) {
    console.log('[prices] tcgfast missing price field(s)', {
      card: matched?.name,
      set: matched?.set_name,
      hasNearMint: nm != null,
      hasNearMintTcgPlayer: nm?.tcgplayer?.market != null,
      hasNearMintEbay: nm?.ebay?.avg_7d != null,
      hasPsa10: graded?.tcgplayer?.market != null,
    });
  }

  return {
    card_name: matched?.name ?? parsed.query,
    set_name: matched?.set_name ?? parsed.set ?? null,
    price_nm,
    price_psa10,
    raw_json: JSON.stringify(matched ?? {}),
  };
}

type PriceChartingSearchRow = {
  id: string | number;
  'product-name'?: string;
};

async function lookupPriceCharting(
  env: Env,
  identifier: string,
): Promise<{ card_name: string; set_name: null; price_nm: number | null; price_psa10: number | null; raw_json: string }> {
  const base = env.PRICECHARTING_BASE_URL ?? 'https://www.pricecharting.com/api';
  const key = env.PRICECHARTING_API_KEY ?? '';

  let productId: string | number | null = null;
  let matchedName = identifier;

  if (/^\d+$/.test(identifier)) {
    productId = identifier;
  } else {
    const searchUrl = `${base}/products?t=${encodeURIComponent(key)}&q=${encodeURIComponent(identifier)}&status=price-guide`;
    console.log('[prices] pricecharting search request', { identifier, searchUrl });

    let searchRes: Response;
    try {
      searchRes = await fetch(searchUrl);
    } catch {
      throw apiError('PriceCharting API unreachable', 502);
    }

    if (!searchRes.ok) throw apiError(`PriceCharting API error: ${searchRes.status}`, 502);

    const searchJson = await searchRes.json() as { products?: PriceChartingSearchRow[] };
    console.log('[prices] pricecharting raw search sample', JSON.stringify(searchJson).slice(0, 1200));

    const products = Array.isArray(searchJson.products) ? searchJson.products : [];
    const matched = closestByScore(products, (row) => scoreTextMatch(row['product-name'] ?? '', identifier));

    if (!matched?.id) throw apiError('Card not found on PriceCharting', 404);

    productId = matched.id;
    matchedName = matched['product-name'] ?? identifier;
  }

  const detailUrl = `${base}/product?t=${encodeURIComponent(key)}&id=${productId}`;
  console.log('[prices] pricecharting detail request', { identifier, detailUrl });

  let detailRes: Response;
  try {
    detailRes = await fetch(detailUrl);
  } catch {
    throw apiError('PriceCharting API unreachable', 502);
  }

  if (!detailRes.ok) throw apiError(`PriceCharting API error: ${detailRes.status}`, 502);

  const detail = await detailRes.json() as Record<string, unknown>;
  console.log('[prices] pricecharting raw detail sample', JSON.stringify(detail).slice(0, 1200));

  const loose = detail['loose-price'];
  const graded = detail['graded-price'];

  const price_nm = typeof loose === 'number' ? loose / 100 : null;
  const price_psa10 = typeof graded === 'number' ? graded / 100 : null;

  if (price_nm == null || price_psa10 == null) {
    console.log('[prices] pricecharting missing price field(s)', {
      product: detail['product-name'],
      hasLoose: typeof loose === 'number',
      hasGraded: typeof graded === 'number',
    });
  }

  return {
    card_name: (detail['product-name'] as string | undefined) ?? matchedName,
    set_name: null,
    price_nm,
    price_psa10,
    raw_json: JSON.stringify(detail),
  };
}

export async function getPriceByCardId(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = decodeURIComponent(url.pathname.replace('/api/prices/', ''));
  console.log('[prices] incoming cardId', raw);

  const colonIdx = raw.indexOf(':');
  if (colonIdx < 0) {
    return jsonResp({ ok: false, error: 'Invalid cardId — expected "{source}:{identifier}"' }, 400);
  }

  const source = raw.slice(0, colonIdx);
  const identifier = raw.slice(colonIdx + 1).trim();

  if (!identifier) {
    return jsonResp({ ok: false, error: 'Missing identifier in cardId' }, 400);
  }

  if (source !== 'tcgfast' && source !== 'pricecharting') {
    return jsonResp({ ok: false, error: 'Unknown source — use "tcgfast" or "pricecharting"' }, 400);
  }

  const cached = await env.DB.prepare(
    'SELECT * FROM price_cache WHERE id = ? AND expires_at > unixepoch()',
  ).bind(raw).first<PriceCacheRow>();

  if (cached) {
    return jsonResp({
      ok: true,
      data: {
        card_name: cached.card_name,
        set_name: cached.set_name,
        source: cached.source,
        price_nm: cached.price_nm,
        price_psa10: cached.price_psa10,
        cached: true,
        fetched_at: new Date(cached.fetched_at * 1000).toISOString(),
      },
    });
  }

  try {
    let card_name: string;
    let set_name: string | null;
    let price_nm: number | null;
    let price_psa10: number | null;
    let raw_json = '{}';
    let card_type = source === 'tcgfast' ? 'tcg' : 'sports';

    if (source === 'tcgfast') {
      const result = await lookupTcgFast(env, identifier);
      card_name = result.card_name;
      set_name = result.set_name;
      price_nm = result.price_nm;
      price_psa10 = result.price_psa10;
      raw_json = result.raw_json;
    } else {
      const result = await lookupPriceCharting(env, identifier);
      card_name = result.card_name;
      set_name = result.set_name;
      price_nm = result.price_nm;
      price_psa10 = result.price_psa10;
      raw_json = result.raw_json;
      card_type = /booster|etb|theme deck|deck|box|pack|sealed|tin/i.test(identifier) ? 'sealed' : 'sports';
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO price_cache
        (id, card_name, set_name, source, card_type, price_nm, price_psa10, price_raw_json, fetched_at, expires_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch() + 43200)
    `).bind(raw, card_name, set_name, source, card_type, price_nm, price_psa10, raw_json).run();

    return jsonResp({
      ok: true,
      data: {
        card_name,
        set_name,
        source,
        price_nm,
        price_psa10,
        cached: false,
        fetched_at: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const fe = err as FetchError;
    if (fe.httpStatus === 404) {
      return jsonResp({ ok: false, error: fe.message || 'Card not found' }, 404);
    }
    console.error('[prices] lookup failed for source:', source, err);
    return jsonResp({ ok: false, error: 'Upstream price API unavailable' }, 502);
  }
}
