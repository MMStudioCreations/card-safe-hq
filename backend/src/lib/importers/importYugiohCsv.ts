import {
  buildSearchableText,
  cleanName,
  parseOptionalNumber,
  trimOrNull,
  type NormalizedCardRecord,
} from '../normalize/normalizeCardRecord';
import { mergePricing, type CsvRow, type PricingIndexes } from './importSharedMarketData';

export function importYugiohCsv(row: CsvRow, pricing: PricingIndexes): NormalizedCardRecord | null {
  const name = trimOrNull(row.name_official) ?? trimOrNull(row.name);
  const sourceId = trimOrNull(row.join_id) ?? trimOrNull(row.set_id);
  if (!name || !sourceId) return null;

  const base: NormalizedCardRecord = {
    source_id: sourceId,
    source: 'yugioh_repo_csv',
    game: 'yugioh',
    name,
    clean_name: cleanName(name),
    set_name: trimOrNull(row.set_name),
    set_code: trimOrNull(row.set_id),
    card_number: trimOrNull(row.set_id),
    rarity: trimOrNull(row.rarity),
    type: trimOrNull(row.type),
    subtype: trimOrNull(row.sub_type),
    attribute_or_color: trimOrNull(row.attribute),
    cost_or_mana: trimOrNull(row.rank),
    attack: trimOrNull(row.attack),
    defense: trimOrNull(row.defense),
    description: trimOrNull(row.description),
    image_url: null,
    market_price: parseOptionalNumber(row.price),
    low_price: null,
    mid_price: null,
    high_price: null,
    last_price: null,
    drift_7d: null,
    volatility_7d: null,
    sharpe_ratio: null,
    price_date: trimOrNull(row.set_release),
    searchable_text: '',
    is_sealed: 0,
    metadata_json: JSON.stringify({
      index: trimOrNull(row.index),
      index_market: trimOrNull(row.index_market),
      volatility_label: trimOrNull(row.volatility),
    }),
  };

  const merged = mergePricing(base, pricing, trimOrNull(row.index_market));
  return { ...merged, searchable_text: buildSearchableText(merged) };
}
