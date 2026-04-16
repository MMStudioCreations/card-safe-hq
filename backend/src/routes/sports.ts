/**
 * Sports Card Search — powered by eBay Browse API
 * Covers: NBA, NFL, MLB, NHL, Soccer, UFC, F1, Wrestling, and more
 *
 * eBay category IDs for sports cards:
 *   212  = Sports Trading Cards (parent — covers all sports)
 *   214  = Baseball Cards
 *   215  = Basketball Cards
 *   216  = Football Cards
 *   217  = Hockey Cards
 *   218  = Soccer Cards
 *   219  = Racing Cards
 *   220  = Wrestling Cards
 *   2536 = Collectible Card Games (TCG — used by existing search)
 *
 * IMPORTANT: All responses MUST be wrapped in { ok: true, data: ... } so the
 * frontend axios interceptor (which checks payload.ok) can unwrap them correctly.
 */

import { Env } from '../types';
import { ok, error } from '../lib/json';

// ── Category map ──────────────────────────────────────────────────────────────
const SPORT_CATEGORY: Record<string, string> = {
  nba: '215',
  basketball: '215',
  nfl: '216',
  football: '216',
  mlb: '214',
  baseball: '214',
  nhl: '217',
  hockey: '217',
  soccer: '218',
  football_soccer: '218',
  ufc: '220',
  mma: '220',
  wrestling: '220',
  f1: '219',
  racing: '219',
  sports: '212', // generic — all sports
};

// ── Default queries per sport (for auto-load) ─────────────────────────────────
const SPORT_DEFAULTS: Record<string, string[]> = {
  nba: ['LeBron James rookie', 'Michael Jordan', 'Kobe Bryant', 'Stephen Curry rookie', 'Luka Doncic'],
  nfl: ['Patrick Mahomes rookie', 'Tom Brady', 'Joe Burrow rookie', 'Josh Allen', 'Justin Jefferson'],
  mlb: ['Mike Trout rookie', 'Shohei Ohtani', 'Mickey Mantle', 'Derek Jeter', 'Ronald Acuna rookie'],
  nhl: ['Connor McDavid rookie', 'Wayne Gretzky', 'Sidney Crosby', 'Auston Matthews rookie'],
  soccer: ['Lionel Messi', 'Cristiano Ronaldo', 'Kylian Mbappe rookie', 'Erling Haaland'],
  ufc: ['Conor McGregor', 'Jon Jones', 'Israel Adesanya rookie', 'Alex Pereira'],
  f1: ['Max Verstappen rookie', 'Lewis Hamilton', 'Charles Leclerc', 'Fernando Alonso'],
  sports: ['LeBron James rookie', 'Patrick Mahomes', 'Mike Trout', 'Lionel Messi'],
};

// ── eBay OAuth token cache ────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getEbayToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 60_000) return cachedToken;

  const clientId = env.EBAY_CLIENT_ID;
  const clientSecret = env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must be set in Cloudflare Workers environment variables');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  });

  const resp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`eBay OAuth failed: ${err}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return cachedToken;
}

// ── Parse a raw eBay item into our normalized card shape ──────────────────────
function cleanTitle(raw: string): string {
  // Remove common digital/NFT prefixes that eBay returns
  return raw
    .replace(/^\[DIGITAL\]\s*/i, '')
    .replace(/^\[NFT\]\s*/i, '')
    .replace(/^\[VIRTUAL\]\s*/i, '')
    .trim();
}

function normalizeItem(item: Record<string, unknown>): Record<string, unknown> {
  const title = cleanTitle((item.title as string) || '');
  const price = (item.price as { value?: string; currency?: string }) || {};
  const image = (item.image as { imageUrl?: string }) || {};
  const categories = (item.categories as Array<{ categoryId?: string; categoryName?: string }>) || [];
  const seller = (item.seller as { username?: string }) || {};

  // Try to extract year from title (e.g. "2003 Upper Deck ...")
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';

  // Try to extract card number (e.g. "#23" or "No. 23")
  const numberMatch = title.match(/#(\w+)|No\.\s*(\w+)/i);
  const cardNumber = numberMatch ? (numberMatch[1] || numberMatch[2]) : '';

  // Extract set name — everything after the player name up to common keywords
  const setMatch = title.match(/\d{4}[-–]?\d{0,2}\s+([A-Za-z][^#\n]+?)(?:\s+#|\s+RC|\s+Rookie|\s+PSA|\s+BGS|\s+SGC|\s+CGC|$)/);
  const setName = setMatch ? setMatch[1].trim() : categories[0]?.categoryName || 'Sports Cards';

  const marketPrice = parseFloat(price.value || '0');

  return {
    id: item.itemId as string,
    name: title,
    set: setName,
    number: cardNumber,
    year,
    rarity: detectRarity(title),
    image: image.imageUrl || '',
    images: { small: image.imageUrl || '', large: (image.imageUrl as string || '').replace('s-l225', 's-l500') },
    prices: {
      low: (marketPrice * 0.85).toFixed(2),
      mid: marketPrice.toFixed(2),
      market: marketPrice.toFixed(2),
      high: (marketPrice * 1.2).toFixed(2),
    },
    tcgplayer: { url: item.itemWebUrl as string },
    condition: item.condition as string || 'Ungraded',
    source: 'ebay',
    ebayUrl: item.itemWebUrl as string,
    seller: seller.username || '',
    // Metadata for portfolio
    card_type: 'sports',
    sport: detectSport(title, categories),
  };
}

function detectRarity(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('psa 10') || t.includes('bgs 9.5') || t.includes('cgc 10')) return 'Gem Mint';
  if (t.includes('psa 9') || t.includes('bgs 9')) return 'Mint';
  if (t.includes('auto') || t.includes('autograph')) return 'Autograph';
  if (t.includes('refractor')) return 'Refractor';
  if (t.includes('prizm')) return 'Prizm';
  if (t.includes('gold') || t.includes('/10') || t.includes('/25')) return 'Gold';
  if (t.includes('silver') || t.includes('/50') || t.includes('/99')) return 'Silver';
  if (t.includes('rookie') || t.includes(' rc ') || t.includes(' rc/')) return 'Rookie';
  if (t.includes('holo') || t.includes('foil')) return 'Holo';
  return 'Base';
}

function detectSport(title: string, categories: Array<{ categoryId?: string; categoryName?: string }>): string {
  const t = title.toLowerCase();
  const catId = categories[0]?.categoryId;
  if (catId === '215' || t.includes('nba') || t.includes('basketball')) return 'NBA';
  if (catId === '216' || t.includes('nfl') || t.includes('football')) return 'NFL';
  if (catId === '214' || t.includes('mlb') || t.includes('baseball')) return 'MLB';
  if (catId === '217' || t.includes('nhl') || t.includes('hockey')) return 'NHL';
  if (catId === '218' || t.includes('soccer') || t.includes('futbol')) return 'Soccer';
  if (catId === '220' || t.includes('ufc') || t.includes('mma') || t.includes('wrestling')) return 'UFC/MMA';
  if (catId === '219' || t.includes('f1') || t.includes('formula') || t.includes('nascar')) return 'Racing';
  return 'Sports';
}

// ── Main search handler ────────────────────────────────────────────────────────
export async function handleSportsSearch(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const sport = (url.searchParams.get('sport') || 'sports').toLowerCase();
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const offset = (page - 1) * limit;

  // If no query, pick a random default for the sport
  let query = q.trim();
  if (!query) {
    const defaults = SPORT_DEFAULTS[sport] || SPORT_DEFAULTS.sports;
    query = defaults[Math.floor(Math.random() * defaults.length)];
  }

  const categoryId = SPORT_CATEGORY[sport] || '212';

  try {
    const token = await getEbayToken(env);

    // Exclude digital/NFT cards from results — append -digital to every query
    const physicalQuery = query.toLowerCase().includes('-digital') ? query : `${query} -digital`;

    const params = new URLSearchParams({
      q: physicalQuery,
      category_ids: categoryId,
      limit: limit.toString(),
      offset: offset.toString(),
      filter: 'buyingOptions:{FIXED_PRICE}',
      sort: 'bestMatch',
    });

    const resp = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error('eBay search error:', err);
      return error(`eBay search failed: ${err}`, 502);
    }

    const data = await resp.json() as { total?: number; itemSummaries?: Record<string, unknown>[] };
    const items = (data.itemSummaries || []).map(normalizeItem);

    // Wrap in { ok: true, data: ... } so the frontend axios interceptor can unwrap it
    return ok({
      data: items,
      totalCount: data.total || 0,
      page,
      pageSize: limit,
      query,
      sport,
      source: 'ebay',
    });
  } catch (err) {
    console.error('Sports search error:', err);
    return error(`Sports search unavailable: ${String(err)}`, 500);
  }
}

// ── Sold listings (price comps) ───────────────────────────────────────────────
export async function handleSportsSoldSearch(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const sport = (url.searchParams.get('sport') || 'sports').toLowerCase();
  const categoryId = SPORT_CATEGORY[sport] || '212';

  if (!q.trim()) {
    return ok({ data: [], totalCount: 0 });
  }

  try {
    const token = await getEbayToken(env);

    // eBay Browse API doesn't support sold listings directly — use live listings
    // sorted by price as a proxy for market value
    const physicalQ = q.trim().toLowerCase().includes('-digital') ? q.trim() : `${q.trim()} -digital`;

    const params = new URLSearchParams({
      q: physicalQ,
      category_ids: categoryId,
      limit: '10',
      sort: 'bestMatch',
      filter: 'buyingOptions:{FIXED_PRICE}',
    });

    const resp = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    );

    if (!resp.ok) {
      return ok({ data: [], totalCount: 0 });
    }

    const data = await resp.json() as { total?: number; itemSummaries?: Record<string, unknown>[] };
    const items = (data.itemSummaries || []).map(normalizeItem);

    return ok({ data: items, totalCount: data.total || 0, source: 'ebay_live' });
  } catch (err) {
    return ok({ data: [], totalCount: 0 });
  }
}
