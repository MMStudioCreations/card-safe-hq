// OCR layer: focused set-number + card-name extraction for the three-layer identification pipeline.
// Uses GPT-4o vision with a narrow prompt — reads only the collector number and card name.

const CARD_OCR_PROMPT = `You are reading a Pokemon trading card.

STEP 1 - Find the card name:
Look at the VERY TOP of the card above the artwork.
The name is the largest text on the card, printed in bold.
It may be followed by "ex", "V", "VMAX", "GX", "V-UNION" etc — include these.
Examples: "Pikachu ex", "Charizard VMAX", "Aipom", "Lumineon V"
DO NOT read attack names, ability names, flavor text, or artist names.

STEP 2 - Find the collector number:
Look at the BOTTOM of the card, usually bottom-left or bottom-right.
It looks like "221/182" or "025/078" or "SV001/SV122".
Read ONLY this number, exactly as printed.

STEP 3 - Find the HP:
The HP is at the top-right of the card, a number followed by "HP".
Example: "110 HP" → return 110.

Return ONLY this JSON:
{
  "card_name": "name at top of card exactly as printed",
  "set_number": "collector number at bottom exactly as printed",
  "hp": number or null,
  "confidence": 0-100
}

If you cannot clearly read something, return null. Never guess or infer.
Never return attack names, ability names, or Pokemon descriptions as card_name.`;

export interface OcrResult {
  card_name: string | null;
  set_number: string | null;
  hp: number | null;
  confidence: number;
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

export async function identifyCard(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<OcrResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              { type: 'text', text: CARD_OCR_PROMPT },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[anthropic] OpenAI OCR error', response.status, errBody);
      return { card_name: null, set_number: null, hp: null, confidence: 0 };
    }

    const data = (await response.json()) as OpenAIResponse;
    const rawText = data.choices?.[0]?.message?.content ?? '';
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText) as Partial<OcrResult>;

    return {
      card_name: typeof parsed.card_name === 'string' ? parsed.card_name : null,
      set_number: typeof parsed.set_number === 'string' ? parsed.set_number : null,
      hp: typeof parsed.hp === 'number' && Number.isFinite(parsed.hp) ? Math.round(parsed.hp) : null,
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[anthropic] OCR timed out');
    } else {
      console.error('[anthropic] OCR failed:', err);
    }
    return { card_name: null, set_number: null, hp: null, confidence: 0 };
  } finally {
    clearTimeout(timeoutId);
  }
}
