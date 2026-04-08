export interface CardIdentification {
  player_name: string;
  year: string;
  set_name: string;
  card_number: string;
  sport: string;
  variation: string;
  manufacturer: string;
  condition_notes: string;
  confidence: number;
}

export interface GradingResult {
  estimated_grade_range: string;
  centering_score: number;
  corners_score: number;
  edges_score: number;
  surface_score: number;
  confidence_score: number;
  explanation: string;
}

export interface SheetCard {
  position: number;
  bbox: { x: number; y: number; width: number; height: number };
  card_name: string;
  year: string | null;
  set_name: string;
  card_number: string | null;
  sport: string;
  variation: string | null;
  manufacturer: string;
  condition_notes: string;
  confidence: number;
  estimated_grade: string;
  estimated_value_cents: number;
}

export interface SheetAnalysis {
  cards: SheetCard[];
}

interface OpenAIMessage {
  role: 'user' | 'system';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
  >;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
  error?: { message: string };
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userText: string,
  imageBase64: string,
  mimeType: string,
  maxTokens = 4096,
): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'high' },
        },
        {
          type: 'text',
          text: userText,
        },
      ],
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        messages,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('Empty response from OpenAI API');
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

const SHEET_SYSTEM_PROMPT = `You are an expert trading card authenticator. \
You analyze scanned 9-pocket binder pages. You MUST identify ALL 9 card positions \
in every response, even if a slot appears empty or the card is unclear. \
For unclear cards, do your best and set confidence low. Never skip a position. \
Always respond with valid JSON only. Always use English for all card names and set names. \
For Japanese Pokemon cards, translate the name to English (e.g. シャワーズ = Vaporeon).`;

const SHEET_USER_PROMPT = `This is a 9-pocket binder page (3 rows × 3 columns).
Analyze every position (1–9, left to right, top to bottom).

YOU MUST RETURN ALL 9 POSITIONS. If a slot is empty, return it with card_name: "Empty Slot".
If a card is unclear, make your best attempt and set confidence below 40.
Never return fewer than 9 items in the cards array.

For each position return:
- position: 1–9
- bbox: { x, y, width, height } as percentage of full image (0–100)
- card_name: primary name of the card (Pokemon name, player name, etc.)
- year: 4-digit year or null
- set_name: full set name in English
- card_number: card number as printed or null
- sport: sport or game (Pokemon, Baseball, Basketball, etc.)
- variation: holo, reverse holo, full art, etc. or null
- manufacturer: The Pokemon Company, Topps, Panini, etc.
- condition_notes: visible defects or "Appears clean"
- confidence: 0–100 integer — your confidence in this identification
- estimated_grade: your grade estimate (PSA 1–10 scale, e.g. "8", "9-10", "7-8")
- estimated_value_cents: estimated market value in cents or 0 if unknown

Return exactly this structure:
{
  "cards": [
    {
      "position": number,
      "bbox": {"x": number, "y": number, "width": number, "height": number},
      "card_name": string,
      "year": string | null,
      "set_name": string,
      "card_number": string | null,
      "sport": string,
      "variation": string | null,
      "manufacturer": string,
      "condition_notes": string,
      "confidence": number,
      "estimated_grade": string,
      "estimated_value_cents": number
    }
  ]
}`;

export async function analyzeSheet(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<SheetAnalysis> {
  const rawText = await callOpenAI(
    apiKey,
    SHEET_SYSTEM_PROMPT,
    SHEET_USER_PROMPT,
    imageBase64,
    mimeType,
    4096,
  );

  try {
    const parsed = JSON.parse(stripJsonFences(rawText)) as SheetAnalysis;
    if (!Array.isArray(parsed.cards)) {
      throw new Error('Response missing cards array');
    }
    if (parsed.cards.length < 9) {
      console.warn(`[scan] Only ${parsed.cards.length} of 9 cards returned by GPT-4o`);
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse sheet analysis response: ${err instanceof Error ? err.message : String(err)}. Raw: ${rawText.slice(0, 500)}`,
    );
  }
}

const SINGLE_SYSTEM_PROMPT = `You are an expert sports and trading card authenticator with encyclopedic \
knowledge of all major sports and trading card games. Identify the card shown \
with as much detail as possible. Always respond with valid JSON only.`;

const SINGLE_USER_PROMPT = `Identify this trading card completely. Respond ONLY with a JSON object:
{
  "player_name": string,
  "year": string,
  "set_name": string,
  "card_number": string,
  "sport": string,
  "variation": string,
  "manufacturer": string,
  "condition_notes": string,
  "confidence": number
}`;

export async function identifySingleCard(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<CardIdentification> {
  const rawText = await callOpenAI(
    apiKey,
    SINGLE_SYSTEM_PROMPT,
    SINGLE_USER_PROMPT,
    imageBase64,
    mimeType,
    1024,
  );

  try {
    return JSON.parse(stripJsonFences(rawText)) as CardIdentification;
  } catch (err) {
    throw new Error(
      `Failed to parse single card identification: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
