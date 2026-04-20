export type SupportedGame = 'magic' | 'yugioh' | 'one_piece' | 'lorcana';

export interface NormalizedCardRecord {
  id?: number;
  source_id: string;
  source: string;
  game: SupportedGame;
  name: string;
  clean_name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  rarity: string | null;
  type: string | null;
  subtype: string | null;
  attribute_or_color: string | null;
  cost_or_mana: string | null;
  attack: string | null;
  defense: string | null;
  description: string | null;
  image_url: string | null;
  market_price: number | null;
  low_price: number | null;
  mid_price: number | null;
  high_price: number | null;
  last_price: number | null;
  drift_7d: number | null;
  volatility_7d: number | null;
  sharpe_ratio: number | null;
  price_date: string | null;
  searchable_text: string;
  is_sealed: number;
  metadata_json: string | null;
}

export function cleanName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseOptionalNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function trimOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildSearchableText(record: Partial<NormalizedCardRecord>): string {
  return [
    record.game,
    record.name,
    record.clean_name,
    record.set_name,
    record.set_code,
    record.card_number,
    record.rarity,
    record.type,
    record.subtype,
    record.attribute_or_color,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase();
}
