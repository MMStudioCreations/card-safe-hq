import type { Env } from '../types';

interface PriceCacheRow {
  id: string;
  card_name: string;
  set_name: string | null;
  source: string;
  card_type: string;
}

async function fetchTcgFastPrice(
  env: Env,
  cardName: string,
  setName: string | null,
): Promise<{ price_nm: number | null; raw_json: string }> {
  const base = env.TCGFAST_BASE_URL ?? 'https://api.tcgpricelookup.com/v1';
  const q = setName ? `${cardName} ${setName}` : cardName;
  const url = `${base}/cards/search?q=${encodeURIComponent(q)}&game=pokemon`;

  const res = await fetch(url, {
    headers: { 'X-API-Key': env.TCGFAST_API_KEY ?? '' },
  });
  if (!res.ok) throw new Error(`TCGFast HTTP ${res.status}`);

  const json: unknown = await res.json();
  const data = (json as { data?: unknown[] })?.data;
  const card = Array.isArray(data) ? data[0] : undefined;
  if (!card) return { price_nm: null, raw_json: JSON.stringify(json) };

  const nm = (card as any)?.prices?.raw?.near_mint;
  const price_nm: number | null =
    nm?.tcgplayer?.market ?? nm?.ebay?.avg_7d ?? null;

  return { price_nm, raw_json: JSON.stringify(card) };
}

async function fetchPriceChartingPrice(
  env: Env,
  cardName: string,
): Promise<{ price_nm: number | null; price_psa10: number | null; raw_json: string }> {
  const base = env.PRICECHARTING_BASE_URL ?? 'https://www.pricecharting.com/api';
  const key = env.PRICECHARTING_API_KEY ?? '';

  const searchRes = await fetch(
    `${base}/products?t=${encodeURIComponent(key)}&q=${encodeURIComponent(cardName)}&status=price-guide`,
  );
  if (!searchRes.ok) throw new Error(`PriceCharting search HTTP ${searchRes.status}`);

  const searchJson: unknown = await searchRes.json();
  const products = (searchJson as { products?: { id: string | number }[] })?.products;
  const productId = products?.[0]?.id;
  if (!productId) return { price_nm: null, price_psa10: null, raw_json: '{}' };

  const detailRes = await fetch(
    `${base}/product?t=${encodeURIComponent(key)}&id=${productId}`,
  );
  if (!detailRes.ok) throw new Error(`PriceCharting detail HTTP ${detailRes.status}`);

  const detail: unknown = await detailRes.json();
  const d = detail as Record<string, unknown>;

  return {
    price_nm: typeof d['loose-price'] === 'number' ? d['loose-price'] / 100 : null,
    price_psa10: typeof d['graded-price'] === 'number' ? d['graded-price'] / 100 : null,
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

      if (row.source === 'tcgfast') {
        const result = await fetchTcgFastPrice(env, row.card_name, row.set_name);
        price_nm = result.price_nm;
        raw_json = result.raw_json;
      } else if (row.source === 'pricecharting') {
        const result = await fetchPriceChartingPrice(env, row.card_name);
        price_nm = result.price_nm;
        price_psa10 = result.price_psa10;
        raw_json = result.raw_json;
      }

      await env.DB.prepare(`
        INSERT INTO price_cache (id, card_name, set_name, source, card_type, price_nm, price_psa10, price_raw_json, fetched_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch() + 43200)
        ON CONFLICT(id) DO UPDATE SET
          price_nm = excluded.price_nm,
          price_psa10 = excluded.price_psa10,
          price_raw_json = excluded.price_raw_json,
          fetched_at = excluded.fetched_at,
          expires_at = excluded.expires_at
      `).bind(
        row.id, row.card_name, row.set_name, row.source, row.card_type,
        price_nm, price_psa10, raw_json,
      ).run();

      refreshed++;
    } catch (err) {
      console.error(`[price-sync] failed to refresh ${row.id}:`, err);
      failed++;
    }
  }

  console.log(`Price sync complete: ${refreshed} refreshed, ${failed} failed`);
}
