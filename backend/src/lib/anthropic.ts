// OCR layer: focused set-number + card-name extraction for the three-layer identification pipeline.
// Uses GPT-4o vision with a narrow prompt — reads only the collector number and card name.

const CARD_OCR_PROMPT = `You are reading a Pokemon trading card image.
Your ONLY job is to find and read the collector number printed on the card.

The collector number looks like: "025/078" or "171/167" or "SV001/SV122"
It is always located near the bottom of the card, usually bottom-left or bottom-right.
It may appear as just the number portion like "025" or the full "025/078".

Also read the card name printed in large text at the TOP of the card.
Also read the HP number printed at the top-right area.

Return ONLY this JSON, nothing else:
{
  "card_name": "exact name printed at top of card, or null",
  "set_number": "the collector number exactly as printed, or null",
  "hp": number or null,
  "confidence": 0-100
}

Do not guess. If you cannot clearly read the text, return null for that field.
Never invent a card name. Only return what you can literally see printed.`;

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
