import type { Env } from '../types';

export interface PriceChartingData {
  loose_price_cents: number | null;
  graded_price_cents: number | null;
  psa_10_price_cents: number | null;
  psa_9_price_cents: number | null;
  url: string | null;
}

type PriceChartingSearchRow = {
  id: string | number;
  'product-name'?: string;
  'console-name'?: string;
};

type PriceChartingDetail = {
  status?: string;
  id?: string | number;
  'product-name'?: string;
  'console-name'?: string;
  'loose-price'?: number;
  'graded-price'?: number;
  'manual-only-price'?: number; // PSA 10 for cards
  'cib-price'?: number;
  'new-price'?: number;
  'box-only-price'?: number;    // PSA 9.5 for cards
  'release-date'?: string;
};

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

  const cTokens = new Set(c.split(' ').filter(Boolean));
  const qTokens = q.split(' ').filter(Boolean);
  if (qTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap += 1;
  }
  return Math.round((overlap / qTokens.length) * 80);
}

/**
 * Fetch pricing data for a single card/product from the official PriceCharting API.
 *
 * Authentication is performed via the `PRICECHARTING_API_KEY` environment secret.
 * The function first searches `/api/products` for the best matching product, then
 * fetches full pricing from `/api/product`.
 *
 * Price fields returned by the API are integers representing US cents (pennies).
 * For trading cards the field mapping is:
 *   loose-price       → ungraded market price
 *   graded-price      → PSA 9 equivalent
 *   manual-only-price → PSA 10 equivalent
 *
 * @see https://www.pricecharting.com/api-documentation#prices-api
 */
export async function fetchPriceChartingData(
  env: Env,
  cardName: string,
  setName: string | null,
  cardNumber: string | null,
): Promise<PriceChartingData> {
  const empty: PriceChartingData = {
    loose_price_cents: null,
    graded_price_cents: null,
    psa_10_price_cents: null,
    psa_9_price_cents: null,
    url: null,
  };

  const apiKey = env.PRICECHARTING_API_KEY;
  if (!apiKey) {
    console.warn('[pricecharting] PRICECHARTING_API_KEY is not set — skipping lookup');
    return empty;
  }

  const baseUrl = (env.PRICECHARTING_BASE_URL ?? 'https://www.pricecharting.com/api').replace(/\/$/, '');

  try {
    // ── Step 1: Search for the product ──────────────────────────────────────
    const query = [cardName, setName, cardNumber].filter(Boolean).join(' ');

    const searchUrl = `${baseUrl}/products?t=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}`;

    const searchController = new AbortController();
    const searchTimeout = setTimeout(() => searchController.abort(), 8_000);

    let searchRes: Response;
    try {
      searchRes = await fetch(searchUrl, { signal: searchController.signal });
    } finally {
      clearTimeout(searchTimeout);
    }

    if (!searchRes.ok) {
      console.error(`[pricecharting] search HTTP ${searchRes.status} for query: ${query}`);
      return empty;
    }

    const searchJson = await searchRes.json() as { status?: string; products?: PriceChartingSearchRow[] };

    if (searchJson.status === 'error' || !Array.isArray(searchJson.products) || searchJson.products.length === 0) {
      console.warn('[pricecharting] no products found for query:', query);
      return empty;
    }

    // Pick the best-matching product by name score
    const bestProduct = searchJson.products
      .map((p) => ({ p, score: scoreTextMatch(p['product-name'] ?? '', query) }))
      .sort((a, b) => b.score - a.score)[0]?.p ?? searchJson.products[0];

    const productId = bestProduct.id;

    // ── Step 2: Fetch full product details ──────────────────────────────────
    const detailUrl = `${baseUrl}/product?t=${encodeURIComponent(apiKey)}&id=${productId}`;

    const detailController = new AbortController();
    const detailTimeout = setTimeout(() => detailController.abort(), 8_000);

    let detailRes: Response;
    try {
      detailRes = await fetch(detailUrl, { signal: detailController.signal });
    } finally {
      clearTimeout(detailTimeout);
    }

    if (!detailRes.ok) {
      console.error(`[pricecharting] detail HTTP ${detailRes.status} for id: ${productId}`);
      return empty;
    }

    const detail = await detailRes.json() as PriceChartingDetail;

    if (detail.status === 'error') {
      console.warn('[pricecharting] API error for product id:', productId);
      return empty;
    }

    // ── Step 3: Map API fields to internal price shape ──────────────────────
    // All prices from the API are already in pennies (integer cents).
    //
    // Trading card field mapping (per PriceCharting docs):
    //   loose-price       = ungraded
    //   graded-price      = PSA 9 (graded-9 equivalent)
    //   manual-only-price = PSA 10 (graded-10 equivalent)
    const loose   = typeof detail['loose-price']       === 'number' ? detail['loose-price']       : null;
    const graded  = typeof detail['graded-price']      === 'number' ? detail['graded-price']      : null;
    const psa10   = typeof detail['manual-only-price'] === 'number' ? detail['manual-only-price'] : graded;

    const productUrl = `https://www.pricecharting.com/game/${productId}`;

    console.log('[pricecharting] fetched prices', {
      product: detail['product-name'],
      console: detail['console-name'],
      loose,
      graded,
      psa10,
    });

    return {
      loose_price_cents:  loose,
      graded_price_cents: graded,
      psa_9_price_cents:  graded,
      psa_10_price_cents: psa10,
      url: productUrl,
    };
  } catch (err) {
    console.error('[pricecharting] fetchPriceChartingData failed:', err);
    return empty;
  }
}
