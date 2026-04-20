import { buildSearchableText, cleanName, trimOrNull, type NormalizedCardRecord } from '../normalize/normalizeCardRecord';
import { mergePricing, type CsvRow, type PricingIndexes } from './importSharedMarketData';

export function importLorcanaCsv(row: CsvRow, pricing: PricingIndexes): NormalizedCardRecord | null {
  const baseName = trimOrNull(row.name);
  const version = trimOrNull(row.version);
  const cardId = trimOrNull(row.card_id);
  if (!baseName || !cardId) return null;

  const fullName = version ? `${baseName} - ${version}` : baseName;
  const base: NormalizedCardRecord = {
    source_id: cardId,
    source: 'lorcana_repo_csv',
    game: 'lorcana',
    name: fullName,
    clean_name: cleanName(fullName),
    set_name: trimOrNull(row.set),
    set_code: null,
    card_number: cardId,
    rarity: trimOrNull(row.rarity),
    type: trimOrNull(row.card_type),
    subtype: trimOrNull(row.classifications),
    attribute_or_color: trimOrNull(row.ink_color),
    cost_or_mana: trimOrNull(row.ink_cost),
    attack: trimOrNull(row.strength),
    defense: trimOrNull(row.willpower),
    description: trimOrNull(row.card_text),
    image_url: null,
    market_price: null,
    low_price: null,
    mid_price: null,
    high_price: null,
    last_price: null,
    drift_7d: null,
    volatility_7d: null,
    sharpe_ratio: null,
    price_date: trimOrNull(row.release_date),
    searchable_text: '',
    is_sealed: 0,
    metadata_json: JSON.stringify({
      inkwell: trimOrNull(row.inkwell),
      lore: trimOrNull(row.lore),
      flavor_text: trimOrNull(row.flavor_text),
      illustrator: trimOrNull(row.illustrator),
      keywords_abilities: trimOrNull(row.keywords_abilities),
    }),
  };

  const merged = mergePricing(base, pricing, null);
  return { ...merged, searchable_text: buildSearchableText(merged) };
}
