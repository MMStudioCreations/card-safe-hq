import type { Env } from '../types';

export interface GradingEstimate {
  estimated_grade_range: string;
  centering: { score: number; note: string };
  corners: { score: number; note: string };
  edges: { score: number; note: string };
  surface: { score: number; note: string };
  confidence: number;
  explanation: string;
  label: 'AI Estimated Grade';
}

const GRADING_SYSTEM_PROMPT = `You are a professional card grading expert with deep knowledge of PSA, BGS, and SGC grading standards. You analyze card images and provide precise grading estimates based on visible condition attributes.

You evaluate cards on four key criteria scored 0-100:
- Centering: How well centered the image is within the borders (left/right and top/bottom balance)
- Corners: Sharpness of all four corners, any whitening, fraying, or rounding
- Edges: Smoothness of all four edges, any chipping, nicks, or roughness
- Surface: Clarity of front and back surfaces, any scratches, print lines, stains, or glare

PSA Grade mapping (approximate):
- PSA 10: All scores 95-100, virtually perfect
- PSA 9: Scores 85-94, minor imperfections only
- PSA 8: Scores 75-84, slight wear visible
- PSA 7: Scores 65-74, moderate wear
- PSA 6 and below: Scores under 65, significant wear

You MUST respond ONLY with a valid JSON object. No markdown, no explanation outside the JSON.`;

const GRADING_USER_PROMPT = `Analyze this trading card image and provide a detailed grading estimate.

Return a JSON object with exactly these fields:
- "centering_score": integer 0-100 for centering quality
- "centering_note": one sentence describing what you observe about centering
- "corners_score": integer 0-100 for corner condition
- "corners_note": one sentence describing corner condition
- "edges_score": integer 0-100 for edge condition
- "edges_note": one sentence describing edge condition
- "surface_score": integer 0-100 for surface condition
- "surface_note": one sentence describing surface condition
- "confidence": integer 0-100 reflecting your confidence in this estimate based on image clarity
- "estimated_grade_low": the lower bound PSA grade estimate as integer (1-10)
- "estimated_grade_high": the upper bound PSA grade estimate as integer (1-10)
- "explanation": 2-3 sentence summary explaining the grade range and key factors

Base your grade range on the scores. Be honest about uncertainty — wider ranges are appropriate when image quality limits assessment.`;

interface OpenAIGradingResponse {
  centering_score: number;
  centering_note: string;
  corners_score: number;
  corners_note: string;
  edges_score: number;
  edges_note: string;
  surface_score: number;
  surface_note: string;
  confidence: number;
  estimated_grade_low: number;
  estimated_grade_high: number;
  explanation: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(val)));
}

export async function buildAIGradingEstimate(env: Env, imageUrl: string): Promise<GradingEstimate> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: GRADING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              { type: 'text', text: GRADING_USER_PROMPT },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI grading API error', response.status, err);
      return buildDeterministicFallback();
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const rawText = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(rawText) as Partial<OpenAIGradingResponse>;

    const centeringScore = clamp(parsed.centering_score ?? 80, 0, 100);
    const cornersScore   = clamp(parsed.corners_score   ?? 80, 0, 100);
    const edgesScore     = clamp(parsed.edges_score     ?? 80, 0, 100);
    const surfaceScore   = clamp(parsed.surface_score   ?? 80, 0, 100);
    const confidence     = clamp(parsed.confidence      ?? 70, 0, 100);
    const gradeLow       = clamp(parsed.estimated_grade_low  ?? 7, 1, 10);
    const gradeHigh      = clamp(parsed.estimated_grade_high ?? 9, 1, 10);

    return {
      label: 'AI Estimated Grade',
      estimated_grade_range: gradeLow === gradeHigh ? `${gradeLow}` : `${gradeLow}-${gradeHigh}`,
      centering: { score: centeringScore, note: parsed.centering_note ?? 'Centering assessed from image' },
      corners:   { score: cornersScore,   note: parsed.corners_note   ?? 'Corners assessed from image' },
      edges:     { score: edgesScore,     note: parsed.edges_note     ?? 'Edges assessed from image' },
      surface:   { score: surfaceScore,   note: parsed.surface_note   ?? 'Surface assessed from image' },
      confidence,
      explanation: parsed.explanation ?? 'AI grading estimate based on visible card condition.',
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('buildAIGradingEstimate: OpenAI timed out');
    } else {
      console.error('buildAIGradingEstimate: failed', err);
    }
    return buildDeterministicFallback();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildDeterministicFallback(): GradingEstimate {
  return {
    label: 'AI Estimated Grade',
    estimated_grade_range: '7-9',
    centering: { score: 82, note: 'Unable to assess — upload a card image first' },
    corners:   { score: 84, note: 'Unable to assess — upload a card image first' },
    edges:     { score: 81, note: 'Unable to assess — upload a card image first' },
    surface:   { score: 79, note: 'Unable to assess — upload a card image first' },
    confidence: 0,
    explanation: 'AI grading requires a card image. Upload a front image and retry for a real estimate.',
  };
}

// Legacy alias — keep so any other imports do not break
export const buildDeterministicEstimate = buildDeterministicFallback;
