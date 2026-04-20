import {
  buildSearchableText,
  cleanName,
  parseOptionalNumber,
  trimOrNull,
  type NormalizedCardRecord,
} from '../normalize/normalizeCardRecord';
import { mergePricing, type CsvRow, type PricingIndexes } from './importSharedMarketData';

// PriceCharting CSV rows vary by export profile. This importer is intentionally permissive
// so manual CSV downloads can be ingested without frontend/runtime fetches.
export function importMagicCsv(row: CsvRow, pricing: PricingIndexes): NormalizedCardRecord | null {
  const name = trimOrNull(row.name) ?? trimOrNull(row.product_name) ?? trimOrNull(row.title);
  if (!name) return null;
  const sourceId = trimOrNull(row.id) ?? trimOrNull(row.product_id) ?? cleanName(name);

  const base: NormalizedCardRecord = {
    source_id: sourceId,
    source: 'pricecharting_magic_csv',
    game: 'magic',
    name,
    clean_name: cleanName(name),
    set_name: trimOrNull(row.set_name) ?? trimOrNull(row.set),
    set_code: trimOrNull(row.set_code),
    card_number: trimOrNull(row.card_number) ?? trimOrNull(row.number),
    rarity: trimOrNull(row.rarity),
    type: trimOrNull(row.type),
    subtype: trimOrNull(row.subtype),
    attribute_or_color: trimOrNull(row.color),
    cost_or_mana: trimOrNull(row.mana_cost),
    attack: trimOrNull(row.attack),
    defense: trimOrNull(row.defense),
    description: trimOrNull(row.description),
    image_url: trimOrNull(row.image_url),
    market_price: parseOptionalNumber(row.market_price),
    low_price: parseOptionalNumber(row.low_price),
    mid_price: parseOptionalNumber(row.mid_price),
    high_price: parseOptionalNumber(row.high_price),
    last_price: parseOptionalNumber(row.last_price),
    drift_7d: null,
    volatility_7d: null,
    sharpe_ratio: null,
    price_date: trimOrNull(row.price_date),
    searchable_text: '',
    is_sealed: 0,
    metadata_json: JSON.stringify({ source_file: 'pricecharting_magic_manual' }),
  };

  const merged = mergePricing(base, pricing, trimOrNull(row.product_id));
  return { ...merged, searchable_text: buildSearchableText(merged) };
}
