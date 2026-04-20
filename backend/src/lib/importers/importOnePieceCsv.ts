import { buildSearchableText, cleanName, trimOrNull, type NormalizedCardRecord } from '../normalize/normalizeCardRecord';
import { mergePricing, type CsvRow, type PricingIndexes } from './importSharedMarketData';

export function importOnePieceCsv(row: CsvRow, pricing: PricingIndexes): NormalizedCardRecord | null {
  const name = trimOrNull(row.card_name);
  const sourceId = trimOrNull(row.card_id);
  if (!name || !sourceId) return null;

  const base: NormalizedCardRecord = {
    source_id: sourceId,
    source: 'onepiece_repo_csv',
    game: 'one_piece',
    name,
    clean_name: cleanName(name),
    set_name: trimOrNull(row.card_expansion),
    set_code: trimOrNull(row.card_expansion),
    card_number: trimOrNull(row.card_code),
    rarity: trimOrNull(row.card_rarity),
    type: trimOrNull(row.card_type),
    subtype: null,
    attribute_or_color: trimOrNull(row.card_color),
    cost_or_mana: trimOrNull(row.card_cost),
    attack: trimOrNull(row.card_power),
    defense: trimOrNull(row.card_counter),
    description: trimOrNull(row.card_effect) ?? trimOrNull(row.card_trigger),
    image_url: trimOrNull(row.card_image),
    market_price: null,
    low_price: null,
    mid_price: null,
    high_price: null,
    last_price: null,
    drift_7d: null,
    volatility_7d: null,
    sharpe_ratio: null,
    price_date: null,
    searchable_text: '',
    is_sealed: 0,
    metadata_json: JSON.stringify({
      card_art_variant: trimOrNull(row.card_art_variant),
      card_banned: trimOrNull(row.card_banned),
    }),
  };

  const merged = mergePricing(base, pricing, null);
  return { ...merged, searchable_text: buildSearchableText(merged) };
}
