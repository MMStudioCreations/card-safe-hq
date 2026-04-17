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

async function lookupTcgFast(
  env: Env,
  identifier: string,
): Promise<{ card_name: string; set_name: string | null; price_nm: number | null; raw_json: string }> {
  const base = env.TCGFAST_BASE_URL ?? 'https://api.tcgpricelookup.com/v1';

  // Resolve a human-readable card name from local DB when the identifier is a PTCG ID
  let cardName = identifier;
  let setName: string | null = null;

  const catalogRow = await env.DB.prepare(
    'SELECT card_name, set_name FROM pokemon_catalog WHERE ptcg_id = ? LIMIT 1',
  ).bind(identifier).first<{ card_name: string; set_name: string | null }>();

  if (catalogRow) {
    cardName = catalogRow.card_name;
    setName = catalogRow.set_name;
  } else {
    const cardRow = await env.DB.prepare(
      'SELECT card_name, set_name FROM cards WHERE external_ref = ? LIMIT 1',
    ).bind(identifier).first<{ card_name: string; set_name: string | null }>();
    if (cardRow) {
      cardName = cardRow.card_name;
      setName = cardRow.set_name;
    }
  }

  const q = setName ? `${cardName} ${setName}` : cardName;
  const url = `${base}/cards/search?q=${encodeURIComponent(q)}&game=pokemon`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-API-Key': env.TCGFAST_API_KEY ?? '' } });
  } catch {
    throw apiError('TCGFast API unreachable', 502);
  }

  if (!res.ok) throw apiError(`TCGFast API error: ${res.status}`, 502);

  const json: unknown = await res.json();
  const cards = (json as { data?: unknown[] })?.data;
  const card = Array.isArray(cards) ? cards[0] : undefined;

  if (!card) throw apiError('Card not found on TCG Price Lookup', 404);

  const nm = (card as any)?.prices?.raw?.near_mint;
  const price_nm: number | null =
    nm?.tcgplayer?.market ?? nm?.ebay?.avg_7d ?? null;

  return {
    card_name: (card as any).name ?? cardName,
    set_name: (card as any).set_name ?? setName,
    price_nm,
    raw_json: JSON.stringify(card),
  };
}

async function lookupPriceCharting(
  env: Env,
  identifier: string,
): Promise<{ card_name: string; set_name: null; price_nm: number | null; price_psa10: number | null; raw_json: string }> {
  const base = env.PRICECHARTING_BASE_URL ?? 'https://www.pricecharting.com/api';
  const key = env.PRICECHARTING_API_KEY ?? '';

  let productId: string | number | null = null;
  let card_name = identifier;

  if (/^\d+$/.test(identifier)) {
    productId = identifier;
  } else {
    let searchRes: Response;
    try {
      searchRes = await fetch(
        `${base}/products?t=${encodeURIComponent(key)}&q=${encodeURIComponent(identifier)}&status=price-guide`,
      );
    } catch {
      throw apiError('PriceCharting API unreachable', 502);
    }

    if (!searchRes.ok) throw apiError(`PriceCharting API error: ${searchRes.status}`, 502);

    const searchJson: unknown = await searchRes.json();
    const first = (searchJson as { products?: { id: string | number; 'product-name'?: string }[] })?.products?.[0];
    if (!first) throw apiError('Card not found on PriceCharting', 404);

    productId = first.id;
    card_name = first['product-name'] ?? identifier;
  }

  let detailRes: Response;
  try {
    detailRes = await fetch(
      `${base}/product?t=${encodeURIComponent(key)}&id=${productId}`,
    );
  } catch {
    throw apiError('PriceCharting API unreachable', 502);
  }

  if (!detailRes.ok) throw apiError(`PriceCharting API error: ${detailRes.status}`, 502);

  const detail: unknown = await detailRes.json();
  const d = detail as Record<string, unknown>;

  return {
    card_name: (d['product-name'] as string | undefined) ?? card_name,
    set_name: null,
    price_nm: typeof d['loose-price'] === 'number' ? d['loose-price'] / 100 : null,
    price_psa10: typeof d['graded-price'] === 'number' ? d['graded-price'] / 100 : null,
    raw_json: JSON.stringify(detail),
  };
}

export async function getPriceByCardId(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  // pathname: /api/prices/tcgfast:sv3-125  or  /api/prices/pricecharting:72584
  const raw = decodeURIComponent(url.pathname.replace('/api/prices/', ''));

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

  // Step 1: cache hit
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

  // Step 2: fetch from API
  try {
    let card_name: string;
    let set_name: string | null;
    let price_nm: number | null;
    let price_psa10: number | null = null;
    let raw_json = '{}';
    const card_type = source === 'tcgfast' ? 'tcg' : 'sports';

    if (source === 'tcgfast') {
      const result = await lookupTcgFast(env, identifier);
      card_name = result.card_name;
      set_name = result.set_name;
      price_nm = result.price_nm;
      raw_json = result.raw_json;
    } else {
      const result = await lookupPriceCharting(env, identifier);
      card_name = result.card_name;
      set_name = result.set_name;
      price_nm = result.price_nm;
      price_psa10 = result.price_psa10;
      raw_json = result.raw_json;
    }

    // Step 3: write to cache
    await env.DB.prepare(`
      INSERT INTO price_cache (id, card_name, set_name, source, card_type, price_nm, price_psa10, price_raw_json, fetched_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch() + 43200)
      ON CONFLICT(id) DO UPDATE SET
        card_name = excluded.card_name,
        set_name = excluded.set_name,
        price_nm = excluded.price_nm,
        price_psa10 = excluded.price_psa10,
        price_raw_json = excluded.price_raw_json,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at
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
