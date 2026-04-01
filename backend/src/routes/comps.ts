import type { Card, Env } from '../types';
import { EbayCompsProvider, type NormalizedComp, summarizeComps } from '../lib/comps';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, notFound, ok } from '../lib/json';

const provider = new EbayCompsProvider();

interface SalesCompRow extends NormalizedComp {
  created_at: string;
}

// ── Shared insert helper ──────────────────────────────────────────────────────

function buildInserts(env: Env, cardId: number, comps: NormalizedComp[]) {
  return comps.map((c) =>
    env.DB
      .prepare(
        `INSERT INTO sales_comps
           (card_id, source, title, sold_price_cents, sold_date, sold_platform, listing_url, condition_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(cardId, c.source, c.title, c.sold_price_cents, c.sold_date, c.sold_platform, c.listing_url, c.condition_text),
  );
}

// ── GET /api/comps/history/:cardId ───────────────────────────────────────────

export async function getCompsHistory(env: Env, cardId: number): Promise<Response> {
  const card = await queryOne<Card>(env.DB, 'SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return notFound('Card not found');

  const rows = await queryAll<{
    sold_date: string;
    sold_price_cents: number;
    title: string;
  }>(
    env.DB,
    `SELECT sold_date, sold_price_cents, title
     FROM sales_comps
     WHERE card_id = ? AND source = 'ebay_sold'
     ORDER BY sold_date ASC`,
    [cardId],
  );

  // Group by date (YYYY-MM-DD) and average price per day
  const byDate = new Map<string, number[]>();
  for (const row of rows) {
    const date = row.sold_date ? row.sold_date.slice(0, 10) : null;
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(row.sold_price_cents);
  }

  const history = Array.from(byDate.entries()).map(([date, prices]) => ({
    date,
    avg_price_cents: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    count: prices.length,
  }));

  return ok({ card_id: cardId, history });
}

// ── GET /api/comps/:cardId ────────────────────────────────────────────────────

export async function getComps(env: Env, cardId: number): Promise<Response> {
  const card = await queryOne<Card>(env.DB, 'SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return notFound('Card not found');

  // A "fresh" cache is any row for this card inserted within the last 24 hours.
  const cacheCheck = await queryOne<{ cnt: number; last_synced: string }>(
    env.DB,
    `SELECT COUNT(*) as cnt, MAX(created_at) as last_synced
     FROM sales_comps
     WHERE card_id = ?
       AND created_at > datetime('now', '-24 hours')`,
    [cardId],
  );
  const isCached = (cacheCheck?.cnt ?? 0) > 0;

  if (!isCached) {
    // Fetch sold and active listings in parallel
    const [soldComps, activeComps] = await Promise.all([
      provider.fetchRecentSales(card),
      provider.fetchActiveListings(card),
    ]);
    const all = [...soldComps, ...activeComps];

    // Only replace existing rows when eBay actually returned data.
    // If the scrape fails (timeout, blocked), we fall through and serve the
    // last-known rows rather than returning an empty result.
    if (all.length > 0) {
      await run(env.DB, 'DELETE FROM sales_comps WHERE card_id = ?', [cardId]);
      await env.DB.batch(buildInserts(env, cardId, all));
    }
  }

  const rows = await queryAll<SalesCompRow>(
    env.DB,
    `SELECT source, title, sold_price_cents, sold_date, sold_platform, listing_url, condition_text, created_at
     FROM sales_comps
     WHERE card_id = ?
     ORDER BY sold_price_cents DESC`,
    [cardId],
  );

  const sold    = rows.filter((r) => r.source === 'ebay_sold');
  const active  = rows.filter((r) => r.source === 'ebay_active');
  const lastSynced = rows.length > 0 ? rows[0].created_at : new Date().toISOString();
  const summary = summarizeComps(sold.map((r) => r.sold_price_cents));

  return ok({ sold, active, summary, cached: isCached, last_synced: lastSynced });
}

// ── GET /api/comps/search?q= ──────────────────────────────────────────────────

export async function searchComps(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) return badRequest('q parameter is required');

  // Build a virtual Card from the search query — not stored in DB
  const virtualCard: Card = {
    id: 0,
    game: '',
    card_name: q,
    set_name: null,
    card_number: null,
    rarity: null,
    image_url: null,
    external_ref: null,
    created_at: '',
    updated_at: '',
  };

  const [soldComps, activeComps] = await Promise.all([
    provider.fetchRecentSales(virtualCard),
    provider.fetchActiveListings(virtualCard),
  ]);

  const summary = summarizeComps(soldComps.map((c) => c.sold_price_cents));

  return ok({
    sold:        soldComps,
    active:      activeComps,
    summary,
    cached:      false,
    last_synced: new Date().toISOString(),
  });
}

// ── POST /api/comps/refresh/:cardId ──────────────────────────────────────────

export async function refreshComps(env: Env, cardId: number): Promise<Response> {
  const card = await queryOne<Card>(env.DB, 'SELECT * FROM cards WHERE id = ?', [cardId]);
  if (!card) return notFound('Card not found');

  const [soldComps, activeComps] = await Promise.all([
    provider.fetchRecentSales(card),
    provider.fetchActiveListings(card),
  ]);
  const all = [...soldComps, ...activeComps];

  if (!all.length) {
    return badRequest('eBay returned no listings for this card — verify the card name or try again later');
  }

  await run(env.DB, 'DELETE FROM sales_comps WHERE card_id = ?', [cardId]);
  await env.DB.batch(buildInserts(env, cardId, all));

  const summary = summarizeComps(soldComps.map((c) => c.sold_price_cents));

  return ok({
    card_id:     cardId,
    inserted:    { sold: soldComps.length, active: activeComps.length },
    summary,
    cached:      false,
    last_synced: new Date().toISOString(),
  });
}
