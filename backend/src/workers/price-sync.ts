import type { Env } from '../types';

interface PriceCacheRow {
  id: string;
  card_name: string;
  set_name: string | null;
  source: string;
  card_type: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTextMatch(candidate: string, query: string): number {
  const c = normalizeText(candidate);
  const q = normalizeText(query);
  if (!c || !q) return 0;
  if (c === q) return 120;
  if (c.includes(q)) return 90;

  const cTokens = new Set(c.split(' '));
  const qTokens = q.split(' ');
  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap += 1;
  }
  return Math.round((overlap / qTokens.length) * 80);
}

function parsePriceCacheId(id: string): { source: 'tcgfast' | 'pricecharting'; identifier: string } | null {
  const colon = id.indexOf(':');
  if (colon < 0) return null;
  const source = id.slice(0, colon);
  const identifier = id.slice(colon + 1).trim();
  if (!identifier) return null;
  if (source !== 'tcgfast' && source !== 'pricecharting') return null;
  return { source, identifier };
}

async function fetchTcgFastPrice(
  env: Env,
  identifier: string,
): Promise<{ price_nm: number | null; price_psa10: number | null; raw_json: string }> {
  const base = env.TCGFAST_BASE_URL ?? 'https://api.tcgpricelookup.com/v1';
  const parts = identifier.split('&');
  const q = parts.shift()?.trim() ?? '';
  const params = new URLSearchParams(parts.join('&'));
  const game = params.get('game') ?? 'pokemon';
  const set = params.get('set');

  const req = new URL(`${base}/cards/search`);
  req.searchParams.set('q', q);
  req.searchParams.set('game', game);
  if (set) req.searchParams.set('set', set);

  const res = await fetch(req.toString(), {
    headers: { 'X-API-Key': env.TCGFAST_API_KEY ?? '' },
  });
  if (!res.ok) throw new Error(`TCGFast HTTP ${res.status}`);

  const json = await res.json() as { data?: Array<Record<string, any>> };
  const cards = Array.isArray(json.data) ? json.data : [];
  const card = cards
    .map((c) => ({ c, score: scoreTextMatch(c.name ?? '', q) + (set ? scoreTextMatch(c.set_name ?? '', set) : 0) }))
    .sort((a, b) => b.score - a.score)[0]?.c;

  if (!card) return { price_nm: null, price_psa10: null, raw_json: JSON.stringify(json) };

  const nm = card?.prices?.raw?.near_mint;
  const price_nm: number | null =
    typeof nm?.tcgplayer?.market === 'number'
      ? nm.tcgplayer.market
      : typeof nm?.ebay?.avg_7d === 'number'
        ? nm.ebay.avg_7d
        : null;

  const price_psa10 =
    typeof card?.prices?.graded?.psa_10?.tcgplayer?.market === 'number'
      ? card.prices.graded.psa_10.tcgplayer.market
      : null;

  return { price_nm, price_psa10, raw_json: JSON.stringify(card) };
}

async function fetchPriceChartingPrice(
  env: Env,
  identifier: string,
): Promise<{ price_nm: number | null; price_psa10: number | null; raw_json: string }> {
  const base = env.PRICECHARTING_BASE_URL ?? 'https://www.pricecharting.com/api';
  const key = env.PRICECHARTING_API_KEY ?? '';

  let productId: string | number | null = null;

  if (/^\d+$/.test(identifier)) {
    productId = identifier;
  } else {
    const searchRes = await fetch(
      `${base}/products?t=${encodeURIComponent(key)}&q=${encodeURIComponent(identifier)}&status=price-guide`,
    );
    if (!searchRes.ok) throw new Error(`PriceCharting search HTTP ${searchRes.status}`);

    const searchJson = await searchRes.json() as {
      products?: Array<{ id: string | number; 'product-name'?: string }>;
    };

    productId = searchJson.products
      ?.map((p) => ({ id: p.id, score: scoreTextMatch(p['product-name'] ?? '', identifier) }))
      .sort((a, b) => b.score - a.score)[0]?.id ?? null;

    if (!productId) return { price_nm: null, price_psa10: null, raw_json: JSON.stringify(searchJson) };
  }

  const detailRes = await fetch(
    `${base}/product?t=${encodeURIComponent(key)}&id=${productId}`,
  );
  if (!detailRes.ok) throw new Error(`PriceCharting detail HTTP ${detailRes.status}`);

  const detail = await detailRes.json() as Record<string, unknown>;

  return {
    price_nm: typeof detail['loose-price'] === 'number' ? detail['loose-price'] / 100 : null,
    price_psa10: typeof detail['graded-price'] === 'number' ? detail['graded-price'] / 100 : null,
    raw_json: JSON.stringify(detail),
  };
}

export async function runPriceSync(env: Env): Promise<void> {
  const stale = await env.DB.prepare(
    'SELECT id, card_name, set_name, source, card_type FROM price_cache WHERE expires_at < unixepoch()',
  ).all<PriceCacheRow>();

  const rows = stale.results ?? [];
  let refreshed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      let price_nm: number | null = null;
      let price_psa10: number | null = null;
      let raw_json = '{}';

      const parsed = parsePriceCacheId(row.id);
      if (!parsed) throw new Error(`Invalid cached id format: ${row.id}`);

      if (parsed.source === 'tcgfast') {
        const result = await fetchTcgFastPrice(env, parsed.identifier);
        price_nm = result.price_nm;
        price_psa10 = result.price_psa10;
        raw_json = result.raw_json;
      } else if (parsed.source === 'pricecharting') {
        const result = await fetchPriceChartingPrice(env, parsed.identifier);
        price_nm = result.price_nm;
        price_psa10 = result.price_psa10;
        raw_json = result.raw_json;
      }

      await env.DB.prepare(`
        INSERT OR REPLACE INTO price_cache
          (id, card_name, set_name, source, card_type, price_nm, price_psa10, price_raw_json, fetched_at, expires_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch() + 43200)
      `).bind(
        row.id,
        row.card_name,
        row.set_name,
        row.source,
        row.card_type,
        price_nm,
        price_psa10,
        raw_json,
      ).run();

      refreshed++;
    } catch (err) {
      console.error(`[price-sync] failed to refresh ${row.id}:`, err);
      failed++;
    }
  }

  console.log(`Price sync complete: ${refreshed} refreshed, ${failed} failed`);
}
