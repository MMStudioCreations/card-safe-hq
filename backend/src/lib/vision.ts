import type { Env } from '../types';
import { searchPokemonCard, extractTCGPlayerPrice } from './pokemontcg';
import { fetchPriceChartingData } from './pricecharting';
import { queryAll } from './db';

// ─── Identification Types ────────────────────────────────────────────────────

export interface CardIdentification {
  // GPT-4o extracted fields
  card_name: string | null;
  card_number: string | null;        // e.g. "252/193" — primary lookup key
  set_name: string | null;
  game: string | null;               // "Pokemon" | "Magic" | "Baseball" | etc.
  sport: string | null;              // for sports cards
  player_name: string | null;        // for sports cards
  year: number | null;
  variation: string | null;
  manufacturer: string | null;
  condition_notes: string | null;
  confidence: number;
  raw_response: string;

  // PTCG confirmed fields (populated after API lookup)
  ptcg_id: string | null;            // e.g. "sv3pt5-252"
  ptcg_confirmed: boolean;           // true = PTCG match found
  ptcg_image_small: string | null;
  ptcg_image_large: string | null;
  ptcg_set_id: string | null;
  ptcg_set_name: string | null;      // canonical set name from PTCG API
  ptcg_set_series: string | null;
  ptcg_rarity: string | null;
  ptcg_tcgplayer_url: string | null;

  // Pricing (from PTCG TCGPlayer data or PriceCharting fallback)
  price_market_cents: number | null;
  price_low_cents: number | null;
  price_mid_cents: number | null;
  price_high_cents: number | null;
  price_psa9_cents: number | null;
  price_psa10_cents: number | null;
  price_source: 'tcgplayer' | 'pricecharting' | null;

  // User-correctable — can be overridden post-scan
  set_name_override: string | null;
}

const FAILED_IDENTIFICATION: Omit<CardIdentification, 'raw_response'> = {
  card_name: null,
  card_number: null,
  set_name: null,
  game: null,
  sport: null,
  player_name: null,
  year: null,
  variation: null,
  manufacturer: null,
  condition_notes: null,
  confidence: 0,
  ptcg_id: null,
  ptcg_confirmed: false,
  ptcg_image_small: null,
  ptcg_image_large: null,
  ptcg_set_id: null,
  ptcg_set_name: null,
  ptcg_set_series: null,
  ptcg_rarity: null,
  ptcg_tcgplayer_url: null,
  price_market_cents: null,
  price_low_cents: null,
  price_mid_cents: null,
  price_high_cents: null,
  price_psa9_cents: null,
  price_psa10_cents: null,
  price_source: null,
  set_name_override: null,
};

// ─── GPT-4o Prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert trading card and sports card identifier. You have encyclopedic knowledge of:

TRADING CARD GAMES:
- Pokémon TCG: all sets from Base Set (1999) through the current Scarlet & Violet era. Card numbers follow the format "XXX/YYY" printed at the bottom left. Set symbols appear on the right side of the card. EX, GX, V, VMAX, VSTAR, ex designations are part of the card name.
- Magic: The Gathering, Yu-Gi-Oh!, Dragon Ball Super, One Piece, Lorcana

SPORTS CARDS:
- Baseball, Basketball, Football, Soccer, Hockey
- Manufacturers: Topps, Panini, Upper Deck, Donruss, Fleer, Bowman
- Variations: Rookie (RC), Refractor, Prizm, Holo, Auto, Patch, Serial numbered

CRITICAL INSTRUCTIONS:
1. For Pokémon cards, the card number (e.g. "252/193") is ALWAYS printed at the bottom left of the card — zoom in and read it character by character
2. The set name for Pokémon is NOT the series name — it is the specific product name (e.g. "Obsidian Flames", not "Scarlet & Violet")
3. For alternate art cards, include "Special Illustration Rare" or "Illustration Rare" in the variation field
4. Never guess a card number — use null if you cannot read it clearly
5. The card number is the MOST IMPORTANT field — it uniquely identifies the card. Prioritize reading it accurately over all other fields.
6. Respond ONLY with valid JSON, no markdown, no explanation`;

const USER_PROMPT = `Identify this trading card or sports card from the image. Read every visible detail carefully including the bottom of the card for the card number.

Return a JSON object with exactly these fields:
- "card_name": the full card name exactly as printed (e.g. "Chi-Yu ex", "Mike Trout"), or null
- "card_number": the card number exactly as printed (e.g. "252/193", "1", "RC-10"), or null — read from bottom of card
- "set_name": the specific set/product name (e.g. "Obsidian Flames", "2023 Topps Chrome"), or null
- "game": the game or sport ("Pokemon", "Magic", "Baseball", "Basketball", "Football", "Soccer", "Hockey", "Yu-Gi-Oh", "Other"), or null
- "sport": for sports cards only, the specific sport, or null
- "player_name": for sports cards, the athlete name, or null
- "year": the 4-digit year as a number, or null
- "variation": special designation (e.g. "Special Illustration Rare", "Holo", "Reverse Holo", "Full Art", "Refractor", "Prizm", "Auto", "Patch", "Rookie"), or null
- "manufacturer": card company (e.g. "The Pokemon Company", "Topps", "Panini", "Upper Deck"), or null
- "condition_notes": visible issues (corner wear, edge chips, surface scratches, centering problems), or null if card looks clean
- "confidence": your confidence 0-100 as an integer

Set any field to null if uncertain. Never guess card numbers.`;

// ─── OpenAI Vision Call ──────────────────────────────────────────────────────

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

interface OpenAIMessage {
  role: 'user' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string; detail: 'high' | 'low' | 'auto' };
  }>;
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
  error?: { message: string };
}

interface GPTCardResult {
  card_name: string | null;
  card_number: string | null;
  set_name: string | null;
  game: string | null;
  sport: string | null;
  player_name: string | null;
  year: number | null;
  variation: string | null;
  manufacturer: string | null;
  condition_notes: string | null;
  confidence: number;
}

async function callGPT4oVision(
  apiKey: string,
  imageUrl: string,
): Promise<{ result: GPTCardResult; rawText: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  let rawText = '';

  try {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenAI API error', response.status, errBody);
      throw new Error(`OpenAI error ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    rawText = data.choices?.[0]?.message?.content ?? '';
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText) as Partial<GPTCardResult>;

    return {
      rawText,
      result: {
        card_name: typeof parsed.card_name === 'string' ? parsed.card_name : null,
        card_number: typeof parsed.card_number === 'string' ? parsed.card_number : null,
        set_name: typeof parsed.set_name === 'string' ? parsed.set_name : null,
        game: typeof parsed.game === 'string' ? parsed.game : null,
        sport: typeof parsed.sport === 'string' ? parsed.sport : null,
        player_name: typeof parsed.player_name === 'string' ? parsed.player_name : null,
        year: typeof parsed.year === 'number' && Number.isFinite(parsed.year) ? Math.trunc(parsed.year) : null,
        variation: typeof parsed.variation === 'string' ? parsed.variation : null,
        manufacturer: typeof parsed.manufacturer === 'string' ? parsed.manufacturer : null,
        condition_notes: typeof parsed.condition_notes === 'string' ? parsed.condition_notes : null,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 0,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── PTCG Lookup ─────────────────────────────────────────────────────────────

// Strip the "/total" from card numbers like "252/193" → "252"
function extractCardNumber(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+[A-Za-z]?)/);
  return match ? match[1] : raw;
}

interface CatalogRow {
  ptcg_id: string;
  card_name: string;
  card_number: string;
  set_id: string;
  set_name: string;
  series: string | null;
  rarity: string | null;
  image_small: string | null;
  image_large: string | null;
  tcgplayer_url: string | null;
  tcgplayer_market_cents: number | null;
  tcgplayer_low_cents: number | null;
  legality_standard: string | null;
  legality_expanded: string | null;
}

async function lookupCatalog(
  db: D1Database,
  cardName: string | null,
  cardNumber: string | null,
  setName: string | null,
): Promise<CatalogRow | null> {
  if (!cardNumber && !cardName) return null;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Exact card number match is the most reliable signal
  if (cardNumber) {
    // Try both "123" and "123/197" formats
    const bare = cardNumber.replace(/\/.*$/, '').trim();
    conditions.push('(card_number = ? OR card_number LIKE ?)');
    params.push(cardNumber, `${bare}/%`);
  }
  if (setName) {
    conditions.push('set_name LIKE ?');
    params.push(`%${setName}%`);
  }
  if (cardName) {
    conditions.push('card_name LIKE ?');
    params.push(`%${cardName}%`);
  }

  if (conditions.length === 0) return null;

  const rows = await queryAll<CatalogRow>(
    db,
    `SELECT * FROM pokemon_catalog WHERE ${conditions.join(' AND ')} LIMIT 5`,
    params,
  );

  if (rows.length === 0) return null;

  // If we have multiple results, prefer the one whose name matches best
  if (rows.length === 1) return rows[0];
  if (cardName) {
    const nameLower = cardName.toLowerCase();
    const exact = rows.find((r) => r.card_name.toLowerCase() === nameLower);
    if (exact) return exact;
    const partial = rows.find((r) => r.card_name.toLowerCase().includes(nameLower));
    if (partial) return partial;
  }
  return rows[0];
}

async function lookupPTCG(
  apiKey: string,
  gpt: GPTCardResult,
  db?: D1Database,
): Promise<CardIdentification['ptcg_id'] extends infer T ? Partial<CardIdentification> : never> {
  if (gpt.game?.toLowerCase() !== 'pokemon') return {};

  const number = extractCardNumber(gpt.card_number);

  // Attempt 0: local catalog lookup (fastest, most accurate)
  if (db) {
    const catalogRow = await lookupCatalog(db, gpt.card_name, number, gpt.set_name);
    if (catalogRow) {
      console.log(`[vision] Catalog hit: ${catalogRow.card_name} (${catalogRow.ptcg_id})`);
      return {
        ptcg_id: catalogRow.ptcg_id,
        ptcg_confirmed: true,
        ptcg_image_small: catalogRow.image_small,
        ptcg_image_large: catalogRow.image_large,
        ptcg_set_id: catalogRow.set_id,
        ptcg_set_name: catalogRow.set_name,
        ptcg_set_series: catalogRow.series,
        ptcg_rarity: catalogRow.rarity,
        ptcg_tcgplayer_url: catalogRow.tcgplayer_url,
        price_market_cents: catalogRow.tcgplayer_market_cents,
        price_low_cents: catalogRow.tcgplayer_low_cents,
        price_source: catalogRow.tcgplayer_market_cents ? 'tcgplayer' : null,
      };
    }
  }

  if (!apiKey) return {};

  // Attempt 1: card name + number (most precise)
  let ptcgCard = gpt.card_name && number
    ? await searchPokemonCard(apiKey, gpt.card_name, number, null)
    : null;

  // Attempt 2: card name + set name (if number failed)
  if (!ptcgCard && gpt.card_name && gpt.set_name) {
    ptcgCard = await searchPokemonCard(apiKey, gpt.card_name, null, gpt.set_name);
  }

  // Attempt 3: card name only (soft fallback)
  if (!ptcgCard && gpt.card_name) {
    ptcgCard = await searchPokemonCard(apiKey, gpt.card_name, null, null);
  }

  if (!ptcgCard) return {};

  const prices = extractTCGPlayerPrice(ptcgCard);

  return {
    ptcg_id: ptcgCard.id,
    ptcg_confirmed: true,
    ptcg_image_small: ptcgCard.images.small,
    ptcg_image_large: ptcgCard.images.large,
    ptcg_set_id: ptcgCard.set.id,
    ptcg_set_name: ptcgCard.set.name,
    ptcg_set_series: ptcgCard.set.series,
    ptcg_rarity: ptcgCard.rarity,
    ptcg_tcgplayer_url: ptcgCard.tcgplayer?.url ?? null,
    price_market_cents: prices.market,
    price_low_cents: prices.low,
    price_mid_cents: prices.mid,
    price_high_cents: prices.high,
    price_source: prices.market ? 'tcgplayer' : null,
  };
}

// ─── PriceCharting Fallback ───────────────────────────────────────────────────

async function lookupPriceCharting(
  gpt: GPTCardResult,
  setOverride?: string | null,
): Promise<Partial<CardIdentification>> {
  const setName = setOverride ?? gpt.set_name;
  const data = await fetchPriceChartingData(
    gpt.card_name ?? gpt.player_name ?? '',
    setName,
    gpt.card_number,
  );

  if (!data.loose_price_cents && !data.psa_10_price_cents) return {};

  return {
    price_market_cents: data.loose_price_cents,
    price_psa9_cents: data.psa_9_price_cents,
    price_psa10_cents: data.psa_10_price_cents,
    price_source: 'pricecharting',
  };
}

// ─── R2 Utility ──────────────────────────────────────────────────────────────

export async function r2KeyToDataUrl(env: Env, key: string): Promise<string | null> {
  const obj = await env.BUCKET.get(key);
  if (!obj) return null;
  const bytes = await obj.arrayBuffer();
  const mediaType = (obj.httpMetadata?.contentType ?? 'image/jpeg') as ImageMediaType;
  const uint8 = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  return `data:${mediaType};base64,${btoa(binary)}`;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function identifyCard(
  env: Env,
  imageUrl: string,
  setOverride?: string | null,   // user-provided set correction
): Promise<CardIdentification> {
  let rawText = '';

  try {
    // Step 1: GPT-4o vision
    const { result: gpt, rawText: rt } = await callGPT4oVision(env.OPENAI_API_KEY, imageUrl);
    rawText = rt;

    // Step 2: PTCG lookup (Pokemon only) — tries local catalog first, then PTCG API
    const ptcgData = await lookupPTCG(env.POKEMON_TCG_API_KEY ?? '', gpt, env.DB);

    // Step 3: Pricing — TCGPlayer from PTCG, or PriceCharting fallback
    let pricingData: Partial<CardIdentification> = {};
    if (!ptcgData.price_market_cents) {
      pricingData = await lookupPriceCharting(gpt, setOverride);
    }

    // Step 4: Resolve set name — priority: user override > PTCG confirmed > GPT extracted
    const resolvedSetName = setOverride ?? ptcgData.ptcg_set_name ?? gpt.set_name;

    return {
      ...FAILED_IDENTIFICATION,
      // GPT fields
      card_name: gpt.card_name,
      card_number: gpt.card_number,
      set_name: resolvedSetName,
      game: gpt.game,
      sport: gpt.sport,
      player_name: gpt.player_name,
      year: gpt.year,
      variation: gpt.variation,
      manufacturer: gpt.manufacturer,
      condition_notes: gpt.condition_notes,
      confidence: gpt.confidence,
      raw_response: rawText,
      // PTCG confirmed fields
      ...ptcgData,
      // Pricing fallback
      ...pricingData,
      // User correction
      set_name_override: setOverride ?? null,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('identifyCard: GPT-4o timed out');
    } else {
      console.error('identifyCard: failed', err, 'raw:', rawText);
    }
    return { ...FAILED_IDENTIFICATION, raw_response: rawText };
  }
}

// ─── Set Correction (called when user updates set) ───────────────────────────

export async function correctCardSet(
  env: Env,
  cardName: string,
  cardNumber: string | null,
  newSetName: string,
): Promise<Partial<CardIdentification>> {
  // Re-run PTCG lookup with new set name
  const ptcgCard = await searchPokemonCard(
    env.POKEMON_TCG_API_KEY ?? '',
    cardName,
    cardNumber ? extractCardNumber(cardNumber) : null,
    newSetName,
  );

  if (ptcgCard) {
    const prices = extractTCGPlayerPrice(ptcgCard);
    return {
      ptcg_id: ptcgCard.id,
      ptcg_confirmed: true,
      ptcg_image_small: ptcgCard.images.small,
      ptcg_image_large: ptcgCard.images.large,
      ptcg_set_id: ptcgCard.set.id,
      ptcg_set_name: ptcgCard.set.name,
      ptcg_set_series: ptcgCard.set.series,
      ptcg_rarity: ptcgCard.rarity,
      ptcg_tcgplayer_url: ptcgCard.tcgplayer?.url ?? null,
      price_market_cents: prices.market,
      price_low_cents: prices.low,
      price_mid_cents: prices.mid,
      price_high_cents: prices.high,
      price_source: prices.market ? 'tcgplayer' : null,
      set_name_override: newSetName,
    };
  }

  // PTCG didn't find it — try PriceCharting with the new set
  const pcData = await fetchPriceChartingData(cardName, newSetName, cardNumber);
  return {
    ptcg_confirmed: false,
    set_name_override: newSetName,
    ptcg_set_name: newSetName,
    price_market_cents: pcData.loose_price_cents,
    price_psa9_cents: pcData.psa_9_price_cents,
    price_psa10_cents: pcData.psa_10_price_cents,
    price_source: pcData.loose_price_cents ? 'pricecharting' : null,
  };
}
