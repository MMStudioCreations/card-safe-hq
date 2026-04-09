export interface PokemonTCGCard {
  id: string;
  name: string;
  number: string;
  rarity: string;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    images: { symbol: string; logo: string };
  };
  images: { small: string; large: string };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      normal?: { low: number; mid: number; market: number; high: number };
      holofoil?: { low: number; mid: number; market: number; high: number };
      reverseHolofoil?: { low: number; mid: number; market: number; high: number };
      firstEditionHolofoil?: { low: number; mid: number; market: number; high: number };
    };
  };
  legalities?: {
    standard?: string;
    expanded?: string;
    unlimited?: string;
  };
  types?: string[];
  subtypes?: string[];
  supertype?: string;
  hp?: string;
  attacks?: Array<{
    name: string;
    cost: string[];
    damage: string;
    text: string;
  }>;
  weaknesses?: Array<{ type: string; value: string }>;
  retreatCost?: string[];
  flavorText?: string;
  artist?: string;
}

export interface PokemonTCGSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images: { symbol: string; logo: string };
  legalities: { standard?: string; expanded?: string };
}

const BASE = 'https://api.pokemontcg.io/v2';

async function ptcgFetch(apiKey: string, path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`PTCG API ${res.status}: ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch a single card by its exact PTCG ID (e.g. "sv3pt5-123") — always precise
export async function getCardById(
  apiKey: string,
  ptcgId: string,
): Promise<PokemonTCGCard | null> {
  try {
    const data = await ptcgFetch(apiKey, `/cards/${encodeURIComponent(ptcgId)}`) as any;
    return data?.data ?? null;
  } catch (err) {
    console.error('getCardById failed:', err);
    return null;
  }
}

// Search for a card by name + number to get set info and TCGPlayer prices
export async function searchPokemonCard(
  apiKey: string,
  cardName: string,
  cardNumber?: string | null,
  setName?: string | null,
): Promise<PokemonTCGCard | null> {
  try {
    const parts: string[] = [];
    if (cardName) parts.push(`name:"${cardName}"`);
    if (cardNumber) parts.push(`number:${cardNumber}`);
    if (setName) parts.push(`set.name:"${setName}"`);

    const q = encodeURIComponent(parts.join(' '));
    const data = await ptcgFetch(apiKey, `/cards?q=${q}&pageSize=1`) as any;
    return data?.data?.[0] ?? null;
  } catch (err) {
    console.error('searchPokemonCard failed:', err);
    return null;
  }
}

// Get all cards in a set for master set completion
export async function getSetCards(
  apiKey: string,
  setId: string,
  page = 1,
): Promise<{ cards: PokemonTCGCard[]; totalCount: number }> {
  try {
    const data = await ptcgFetch(
      apiKey,
      `/cards?q=set.id:${setId}&pageSize=250&page=${page}&orderBy=number`,
    ) as any;
    return {
      cards: data?.data ?? [],
      totalCount: data?.totalCount ?? 0,
    };
  } catch (err) {
    console.error('getSetCards failed:', err);
    return { cards: [], totalCount: 0 };
  }
}

// Get all sets, optionally filtered by series
export async function getAllSets(
  apiKey: string,
  modern = true,
): Promise<PokemonTCGSet[]> {
  try {
    // Modern = Sword & Shield era onwards (2020+)
    const q = modern ? encodeURIComponent('releaseDate:[2020-01-01 TO *]') : '';
    const path = q ? `/sets?q=${q}&orderBy=-releaseDate&pageSize=250` : `/sets?orderBy=-releaseDate&pageSize=250`;
    const data = await ptcgFetch(apiKey, path) as any;
    return data?.data ?? [];
  } catch (err) {
    console.error('getAllSets failed:', err);
    return [];
  }
}

// Get TCGPlayer prices for a specific card
export function extractTCGPlayerPrice(card: PokemonTCGCard): {
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  url: string | null;
} {
  const prices = card.tcgplayer?.prices;
  if (!prices) return { market: null, low: null, mid: null, high: null, url: null };

  // Priority: holofoil > normal > reverseHolofoil > firstEditionHolofoil
  const priceData = prices.holofoil ?? prices.normal ??
                    prices.reverseHolofoil ?? prices.firstEditionHolofoil ?? null;

  if (!priceData) return { market: null, low: null, mid: null, high: null, url: null };

  return {
    market: priceData.market ? Math.round(priceData.market * 100) : null,
    low: priceData.low ? Math.round(priceData.low * 100) : null,
    mid: priceData.mid ? Math.round(priceData.mid * 100) : null,
    high: priceData.high ? Math.round(priceData.high * 100) : null,
    url: card.tcgplayer?.url ?? null,
  };
}
