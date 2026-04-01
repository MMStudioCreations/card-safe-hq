import type { Card } from '../types';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface NormalizedComp {
  source: string;       // 'ebay_sold' | 'ebay_active'
  title: string;
  sold_price_cents: number;
  sold_date: string;
  sold_platform: string;
  listing_url: string;
  condition_text: string;
}

export interface SalesCompProvider {
  name: string;
  fetchRecentSales(card: Card): Promise<NormalizedComp[]>;
}

// ── Search query builder ──────────────────────────────────────────────────────
// Slots: player_name · year · set_name · card_number · variation
// Card.card_name  ≈ player_name
// Card.set_name   ≈ year + set_name (year is typically embedded, e.g. "2023 Topps Chrome")
// Card.card_number ≈ card_number
// Card.rarity      ≈ variation

function buildSearchQuery(card: Card & {
  player_name?: string | null;
  year?: number | null;
  sport?: string | null;
  variation?: string | null;
  manufacturer?: string | null;
}): string {
  const parts = [
    card.player_name || card.card_name,
    card.year ? String(card.year) : null,
    card.set_name,
    card.card_number,
    card.variation || card.rarity,
  ]
    .filter((v): v is string => v != null && v.trim().length > 0)
    .map((v) => v.trim());

  const query = parts.join(' ');
  return query.length > 100 ? query.slice(0, 100).trimEnd() : query;
}

// ── HTML parsing helpers ──────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePriceCents(raw: string): number | null {
  // Strip currency labels then symbols: "US $1,234.56", "C $10.00", "$5.00 to $9.00"
  const clean = raw
    .replace(/\b(US|CA|AU|C)\s*\$/gi, '')
    .replace(/[$£€,\s]/g, '')
    .replace(/\bUSD\b/gi, '')
    .trim();

  // Ranges ("10.00to20.00") — take the lower (first) value
  const first = clean.split(/to/i)[0].trim();
  const num = parseFloat(first);
  if (!isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function parseDateToISO(raw: string): string {
  const clean = raw
    .replace(/\bsold\b/gi, '')
    .replace(/\bended\b/gi, '')
    .trim();
  const d = new Date(clean);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

interface RawItem {
  title: string;
  price_cents: number;
  date: string;
  url: string;
  condition: string;
}

// Each `chunk` is the HTML starting at one `s-item__info` marker up to the next.
function parseItemChunk(chunk: string): RawItem | null {
  // ── Title ─────────────────────────────────────────────────────────────────
  const titleM =
    chunk.match(/class="s-item__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ??
    chunk.match(/class="s-item__title[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

  const title = titleM ? stripTags(titleM[1]).replace(/\bshop on ebay\b/gi, '').trim() : null;
  if (!title || title.length < 4) return null;

  // ── URL ───────────────────────────────────────────────────────────────────
  const urlM = chunk.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"?]+)/i);
  if (!urlM) return null;

  // ── Price ─────────────────────────────────────────────────────────────────
  const priceM = chunk.match(/class="s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const price_cents = priceM ? parsePriceCents(stripTags(priceM[1])) : null;
  if (!price_cents) return null;

  // ── End / sold date ───────────────────────────────────────────────────────
  // Try dedicated endedDate span first, then the text that follows a "Sold" POSITIVE span
  const dateM =
    chunk.match(/class="s-item__endedDate[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ??
    chunk.match(/class="POSITIVE[^"]*"[^>]*>Sold[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
  const date = dateM ? parseDateToISO(stripTags(dateM[1])) : new Date().toISOString();

  // ── Condition ─────────────────────────────────────────────────────────────
  const condM =
    chunk.match(/class="SECONDARY_INFO[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ??
    chunk.match(/class="s-item__subtitle[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const condition = condM ? stripTags(condM[1]) : '';

  return { title, price_cents, date, url: urlM[1], condition };
}

// ── eBay fetch + parse ────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (compatible; CardVaultBot/1.0)';
const EBAY_BASE  = 'https://www.ebay.com/sch/i.html';
// Each s-item__info section is typically 2–5 KB; cap the last chunk at 8 KB
// to avoid parsing footer noise when there are no more listings.
const MAX_LAST_CHUNK = 8_192;

async function fetchEbayListings(
  query: string,
  isSold: boolean,
  maxResults: number,
): Promise<NormalizedComp[]> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15_000);

  let html: string;
  try {
    const params = new URLSearchParams({ _nkw: query, _sop: '13' });
    if (isSold) {
      params.set('LH_Complete', '1');
      params.set('LH_Sold', '1');
    }

    const res = await fetch(`${EBAY_BASE}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`EbayCompsProvider: HTTP ${res.status} for query="${query}"`);
      return [];
    }

    html = await res.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('EbayCompsProvider: fetch timed out after 15 s');
    } else {
      console.error('EbayCompsProvider: fetch error', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  const source  = isSold ? 'ebay_sold' : 'ebay_active';
  const results : NormalizedComp[] = [];
  const marker  = 's-item__info';

  let pos = html.indexOf(marker);
  while (pos !== -1 && results.length < maxResults) {
    const nextPos = html.indexOf(marker, pos + marker.length);
    const end     = nextPos === -1 ? Math.min(pos + MAX_LAST_CHUNK, html.length) : nextPos;
    const chunk   = html.slice(pos, end);

    const item = parseItemChunk(chunk);
    if (item) {
      results.push({
        source,
        title:            item.title,
        sold_price_cents: item.price_cents,
        sold_date:        item.date,
        sold_platform:    'eBay',
        listing_url:      item.url,
        condition_text:   item.condition,
      });
    }

    pos = nextPos;
  }

  return results;
}

// ── EbayCompsProvider ─────────────────────────────────────────────────────────

export class EbayCompsProvider implements SalesCompProvider {
  name = 'ebay';

  /** Completed / sold listings — up to 10, sorted most-recent first (eBay _sop=13). */
  fetchRecentSales(card: Card): Promise<NormalizedComp[]> {
    return fetchEbayListings(buildSearchQuery(card), true, 10);
  }

  /** Active (current asking price) listings — up to 5. */
  fetchActiveListings(card: Card): Promise<NormalizedComp[]> {
    return fetchEbayListings(buildSearchQuery(card), false, 5);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function summarizeComps(prices: number[]) {
  if (!prices.length) {
    return { low_price_cents: null, average_price_cents: null, high_price_cents: null, count: 0 };
  }
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const avg  = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  return { low_price_cents: low, average_price_cents: avg, high_price_cents: high, count: prices.length };
}
