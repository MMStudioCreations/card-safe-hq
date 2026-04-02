import type { CardIdentification } from './anthropic';

export interface EbaySoldListing {
  title: string;
  sold_price_cents: number;
  sold_date: string;
  listing_url: string;
  condition_text: string;
}

interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
}

interface EbayItemSummary {
  title?: string;
  price?: { value?: string };
  itemEndDate?: string;
  itemWebUrl?: string;
  condition?: string;
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}


export async function getEbayToken(clientId: string, clientSecret: string): Promise<string> {
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
    const errBody = await response.text();
    throw new Error(`eBay token error ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as EbayTokenResponse;
  return data.access_token;
}


export async function searchSoldListings(
  token: string,
  query: string,
  limit = 10,
): Promise<EbaySoldListing[]> {
  const params = new URLSearchParams({
    q: query,
    filter: 'buyingOptions:{FIXED_PRICE},conditions:{USED}',
    sort: 'endDate',
    limit: String(limit),
  });

  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`eBay search error ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as EbaySearchResponse;
  const items = data.itemSummaries ?? [];
  console.log('[eBay] raw titles:', items.map((i) => i.title));

  return items
    .map((item): EbaySoldListing | null => {
      const priceStr = item.price?.value;
      if (!priceStr || !item.title || !item.itemWebUrl) return null;
      const priceNum = parseFloat(priceStr);
      if (!isFinite(priceNum) || priceNum <= 0) return null;
      return {
        title: item.title,
        sold_price_cents: Math.round(priceNum * 100),
        sold_date: item.itemEndDate ?? new Date().toISOString(),
        listing_url: item.itemWebUrl,
        condition_text: item.condition ?? '',
      };
    })
    .filter((item): item is EbaySoldListing => item !== null);
}

export function buildSearchQuery(identification: CardIdentification): string {
  // Prioritize most specific identifiers first: card_number, player_name, year, set_name, variation
  const parts = [
    identification.card_number,
    identification.player_name,
    identification.year,
    identification.set_name,
    identification.variation,
  ]
    .map((v) => (v ?? '').trim())
    .filter((v) => v.length > 0);

  const query = parts.join(' ');
  return query.length > 200 ? query.slice(0, 200).trimEnd() : query;
}

export async function fetchEbayComps(
  clientId: string | undefined,
  clientSecret: string | undefined,
  identification: CardIdentification,
): Promise<EbaySoldListing[]> {
  if (!clientId || !clientSecret) return [];

  try {
    const token = await getEbayToken(clientId, clientSecret);
    const query = buildSearchQuery(identification);
    if (!query) return [];
    return await searchSoldListings(token, query);
  } catch (err) {
    console.error('fetchEbayComps failed (non-blocking):', err);
    return [];
  }
}
