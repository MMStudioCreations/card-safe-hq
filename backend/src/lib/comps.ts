import type { Card, Env } from '../types';

export interface NormalizedComp {
  source: string;
  title: string;
  sold_price_cents: number;
  sold_date: string;
  sold_platform: string;
  listing_url: string;
  condition_text: string;
}

export interface SalesCompProvider {
  name: string;
  fetchRecentSales(card: Card, env: Env): Promise<NormalizedComp[]>;
  fetchActiveListings(card: Card, env: Env): Promise<NormalizedComp[]>;
}

// Keywords that indicate a listing is NOT a single card — used both in the
// eBay query string (as exclusions) and as a post-fetch title filter.
const LOT_KEYWORDS = [
  'lot', 'bundle', 'choose your card', 'pick your card', 'complete your set',
  'evo line', 'evolution line', 'commons', 'uncommons', 'bulk', 'collection',
  'mixed', 'assorted', 'random', 'mystery', 'grab bag', 'wholesale',
  'singles sv', 'singles sv0', // "Surging Sparks Singles SV08" style titles
];

// Build the negative keyword string for the eBay q= parameter.
// eBay supports -keyword and -"multi word" exclusions inline.
function buildExclusions(): string {
  return [
    '-lot',
    '-bundle',
    '-"choose your card"',
    '-"pick your card"',
    '-"complete your set"',
    '-"evo line"',
    '-"evolution line"',
    '-bulk',
    '-wholesale',
    '-"grab bag"',
  ].join(' ');
}

function buildSearchQuery(card: Card & {
  player_name?: string | null;
  year?: number | null;
  sport?: string | null;
  variation?: string | null;
  manufacturer?: string | null;
}): string {
  const isPokemon = (card.game || '').toLowerCase().includes('poke') ||
                    (card.game || '').toLowerCase().includes('tcg');

  const parts: (string | null | undefined)[] = [];

  if (isPokemon) {
    // Pokémon: "CardName CardNumber/Total SetName" is the most precise eBay query.
    // We intentionally omit "Pokemon TCG" as a suffix because it can push the
    // card_number out of eBay's relevance window on longer names.
    parts.push(card.card_name);
    if (card.card_number) parts.push(card.card_number);
    if (card.set_name) parts.push(card.set_name);
    // Include variation (e.g. "Reverse Holo", "Full Art") only when present
    // so graded/holo variants are separated from base prints.
    if (card.variation && card.variation.toLowerCase() !== 'standard') {
      parts.push(card.variation);
    }
  } else {
    // Sports / other: player + year + set + variation
    parts.push(card.player_name ?? card.card_name);
    if (card.year) parts.push(String(card.year));
    if (card.set_name) parts.push(card.set_name);
    if (card.variation || card.rarity) parts.push(card.variation ?? card.rarity ?? null);
    if (card.card_number) parts.push(card.card_number);
  }

  const positive = parts
    .filter((v): v is string => v != null && v.trim().length > 0)
    .map((v) => v.trim())
    .join(' ');

  // Append exclusion keywords — keep total query under 350 chars (eBay limit).
  const exclusions = buildExclusions();
  const full = `${positive} ${exclusions}`;
  return full.length > 350 ? full.slice(0, 350).trimEnd() : full;
}

async function getEbayToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`eBay token error ${response.status}: ${err}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

interface EbayItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
  itemEndDate?: string;
  itemWebUrl?: string;
  condition?: string;
  buyingOptions?: string[];
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}

async function searchEbayAPI(
  token: string,
  query: string,
  sold: boolean,
  limit = 10,
): Promise<NormalizedComp[]> {
  const source = sold ? 'ebay_sold' : 'ebay_active';

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: sold ? 'endDate' : 'newlyListed',
  });

  if (sold) {
    // Sold listings: use itemEndDate filter to get recently ended fixed-price listings
    // The Browse API doesn't have a dedicated "sold" endpoint, so we filter by
    // items that have ended (itemEndDate in the past) as a proxy for sold comps.
    params.set('filter', 'buyingOptions:{FIXED_PRICE}');
    params.set('sort', 'endDate');
  } else {
    // Active listings: items currently available for purchase (no itemEndDate filter)
    // BEST_OFFER is not a valid buyingOptions filter value in Browse API
    params.set('filter', 'buyingOptions:{FIXED_PRICE}');
    params.set('sort', 'price');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'X-EBAY-C-ENDUSERCTX': 'affiliateCampaignId=<ePNCampaignId>,affiliateReferenceId=<referenceId>',
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`eBay Browse API error ${response.status}: ${err}`);
      return [];
    }

    const data = await response.json() as EbaySearchResponse;
    const items = data.itemSummaries ?? [];

    return items
      .map((item): NormalizedComp | null => {
        const priceStr = item.price?.value;
        if (!priceStr || !item.title || !item.itemWebUrl) return null;
        const priceNum = parseFloat(priceStr);
        if (!isFinite(priceNum) || priceNum <= 0) return null;

        // Post-fetch filter: drop listings whose titles contain lot/bundle keywords
        // that slipped past eBay's query-level exclusions.
        const titleLower = item.title.toLowerCase();
        const isLotOrBundle = LOT_KEYWORDS.some((kw) => titleLower.includes(kw));
        if (isLotOrBundle) {
          console.log('[eBay] filtered out lot/bundle listing:', item.title);
          return null;
        }

        return {
          source,
          title: item.title,
          sold_price_cents: Math.round(priceNum * 100),
          sold_date: sold ? (item.itemEndDate ?? new Date().toISOString()) : new Date().toISOString(),
          sold_platform: 'eBay',
          listing_url: item.itemWebUrl,
          condition_text: item.condition ?? (sold ? 'Used' : 'Available'),
        };
      })
      .filter((item): item is NormalizedComp => item !== null);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('eBay Browse API: fetch timed out');
    } else {
      console.error('eBay Browse API: fetch error', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export class EbayCompsProvider implements SalesCompProvider {
  name = 'ebay';

  async fetchRecentSales(card: Card, env: Env): Promise<NormalizedComp[]> {
    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
      console.warn('eBay credentials not set — skipping comps fetch');
      return [];
    }
    try {
      const token = await getEbayToken(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
      const query = buildSearchQuery(card);
      if (!query) return [];
      return await searchEbayAPI(token, query, true, 10);
    } catch (err) {
      console.error('fetchRecentSales failed:', err);
      return [];
    }
  }

  async fetchActiveListings(card: Card, env: Env): Promise<NormalizedComp[]> {
    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return [];
    try {
      const token = await getEbayToken(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
      const query = buildSearchQuery(card);
      if (!query) return [];
      return await searchEbayAPI(token, query, false, 5);
    } catch (err) {
      console.error('fetchActiveListings failed:', err);
      return [];
    }
  }
}

export function summarizeComps(prices: number[]) {
  if (!prices.length) {
    return { low_price_cents: null, average_price_cents: null, high_price_cents: null, count: 0 };
  }
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  return { low_price_cents: low, average_price_cents: avg, high_price_cents: high, count: prices.length };
}
