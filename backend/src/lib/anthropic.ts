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
  identification: CardIdentification;
  grading: GradingResult;
}

export interface SheetAnalysis {
  card_count: number;
  cards: SheetCard[];
}

interface OpenAIMessage {
  role: 'user' | 'system';
  content: string | Array
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

const SHEET_SYSTEM_PROMPT = `You are an expert trading card and sports card authenticator and grader. \
You analyze scanned binder pages containing multiple cards arranged in a \
3x3 grid (9-pocket page). For each card you can see, identify it completely \
and assess its condition. Always respond with valid JSON only.`;

const SHEET_USER_PROMPT = `This is a scanned 9-pocket binder page. Please analyze every card visible.
For each card provide:
1. Its position in the grid (1-9, left to right, top to bottom)
2. Bounding box as percentage of total image: {x, y, width, height} where 0,0 is top-left
3. Complete identification:
   - player_name (or card name for trading cards)
   - year
   - set_name
   - card_number
   - sport (or game for trading cards like Pokemon, Magic)
   - variation (parallel, foil, holo, etc or empty string)
   - manufacturer (Topps, Panini, PSA, Pokemon Company, etc)
   - condition_notes (specific defects you can see)
   - confidence (0-100 how confident you are in the identification)
4. Grade assessment:
   - estimated_grade_range (e.g. "7-8", "8-9", "9-10")
   - centering_score (1-10)
   - corners_score (1-10)
   - edges_score (1-10)
   - surface_score (1-10)
   - confidence_score (0-100)
   - explanation (brief explanation of grade)

Respond ONLY with a JSON object in this exact format:
{
  "card_count": number,
  "cards": [
    {
      "position": number,
      "bbox": {"x": number, "y": number, "width": number, "height": number},
      "identification": {
        "player_name": string,
        "year": string,
        "set_name": string,
        "card_number": string,
        "sport": string,
        "variation": string,
        "manufacturer": string,
        "condition_notes": string,
        "confidence": number
      },
      "grading": {
        "estimated_grade_range": string,
        "centering_score": number,
        "corners_score": number,
        "edges_score": number,
        "surface_score": number,
        "confidence_score": number,
        "explanation": string
      }
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
    if (typeof parsed.card_count !== 'number' || !Array.isArray(parsed.cards)) {
      throw new Error('Response missing card_count or cards array');
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
