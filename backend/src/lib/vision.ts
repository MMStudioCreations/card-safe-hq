import type { Env } from '../types';

export interface CardIdentification {
  player_name: string | null;
  year: number | null;
  set_name: string | null;
  card_number: string | null;
  sport: string | null;
  variation: string | null;
  manufacturer: string | null;
  condition_notes: string | null;
  confidence: number;
  raw_response: string;
}

const FAILED_IDENTIFICATION: Omit<CardIdentification, 'raw_response'> = {
  player_name: null,
  year: null,
  set_name: null,
  card_number: null,
  sport: null,
  variation: null,
  manufacturer: null,
  condition_notes: null,
  confidence: 0,
};

const SYSTEM_PROMPT = `You are an expert sports and trading card grader and authenticator with decades of experience. You have encyclopedic knowledge of:

- Sports cards across all major sports: Baseball, Basketball, Football, Soccer, Hockey, Golf, Tennis, and more
- Trading card games: Pokemon, Magic: The Gathering, Yu-Gi-Oh!, Dragon Ball, and others
- All major manufacturers: Topps, Panini, Upper Deck, Donruss, Fleer, Bowman, Score, O-Pee-Chee, Leaf, and others
- Card variations and parallels: Rookie cards (RC), Refractors, Prizms, Holofoil, Autographs (Auto), Patch/Relic cards, Serial numbered (/10, /25, /99, /250, etc.), Short Prints (SP), Super Short Prints (SSP), and more
- Card numbering conventions, set checklists, and vintage vs modern cardboard

When shown a card image, carefully examine every visible detail: the front design, back text, copyright year, set name, card number, logos, foil patterns, and any printed signatures or swatches.

You MUST respond ONLY with a single valid JSON object. No markdown fences, no explanation before or after, just the JSON.`;

const USER_PROMPT = `Identify this sports or trading card from the image. Extract every piece of visible metadata.

Return a JSON object with exactly these fields:
- "player_name": the athlete or character name, or null if not determinable
- "year": the 4-digit card year as a number, or null if not visible
- "set_name": the full set/product name (e.g. "2023 Topps Chrome", "Base Set"), or null
- "card_number": the card number exactly as printed (e.g. "#247", "PSA 1"), or null
- "sport": the sport or game (Baseball, Basketball, Football, Soccer, Hockey, Pokemon, etc.), or null
- "variation": any special parallel or insert designation (Rookie, Refractor, Holo, Auto, Patch, Gold, Prizm, etc.), or null
- "manufacturer": the card company (Topps, Panini, Upper Deck, etc.), or null
- "condition_notes": visible condition issues such as corner wear, edge chipping, surface scratches, print defects, or centering problems; null if card appears clean
- "confidence": your confidence in this identification as an integer 0–100
- "raw_response": a concise plain-English sentence summarising what you see (e.g. "1989 Upper Deck Ken Griffey Jr. rookie card #1, appears Near Mint")

Set any field to null if it cannot be determined. Do not guess; use null when uncertain.`;

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
  choices: Array<{
    message: { content: string };
  }>;
  error?: { message: string };
}

export async function r2KeyToDataUrl(env: Env, key: string): Promise<string | null> {
  const obj = await env.BUCKET.get(key);
  if (!obj) return null;

  const bytes = await obj.arrayBuffer();
  const mediaType = (obj.httpMetadata?.contentType ?? 'image/jpeg') as ImageMediaType;

  const uint8 = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  return `data:${mediaType};base64,${base64}`;
}

export async function identifyCard(env: Env, imageUrl: string): Promise<CardIdentification> {
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
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
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
      return { ...FAILED_IDENTIFICATION, raw_response: errBody };
    }

    const data = (await response.json()) as OpenAIResponse;
    rawText = data.choices?.[0]?.message?.content ?? '';

    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText) as Partial<CardIdentification>;

    return {
      player_name: typeof parsed.player_name === 'string' ? parsed.player_name : null,
      year: typeof parsed.year === 'number' && Number.isFinite(parsed.year) ? Math.trunc(parsed.year) : null,
      set_name: typeof parsed.set_name === 'string' ? parsed.set_name : null,
      card_number: typeof parsed.card_number === 'string' ? parsed.card_number : null,
      sport: typeof parsed.sport === 'string' ? parsed.sport : null,
      variation: typeof parsed.variation === 'string' ? parsed.variation : null,
      manufacturer: typeof parsed.manufacturer === 'string' ? parsed.manufacturer : null,
      condition_notes: typeof parsed.condition_notes === 'string' ? parsed.condition_notes : null,
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 0,
      raw_response: rawText,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('identifyCard: OpenAI API timed out after 30s');
    } else {
      console.error('identifyCard: failed to parse response', err, 'raw:', rawText);
    }
    return { ...FAILED_IDENTIFICATION, raw_response: rawText };
  } finally {
    clearTimeout(timeoutId);
  }
}
