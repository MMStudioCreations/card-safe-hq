import { cleanName, parseOptionalNumber, type NormalizedCardRecord } from '../normalize/normalizeCardRecord';

export interface CsvRow {
  [key: string]: string | undefined;
}

export interface MarketRow {
  product_id: string;
  name: string;
  game: string;
  rarity: string;
  market_price: string;
  low_price: string;
  mid_price: string;
  high_price: string;
  price_date: string;
}

export interface VolatilityRow {
  product_id: string;
  name: string;
  game: string;
  drift_7d: string;
  volatility_7d: string;
  last_price: string;
  sharpe_ratio: string;
}

export interface PricingSnapshot {
  product_id: string;
  game: string;
  name: string;
  market_price: number | null;
  low_price: number | null;
  mid_price: number | null;
  high_price: number | null;
  last_price: number | null;
  drift_7d: number | null;
  volatility_7d: number | null;
  sharpe_ratio: number | null;
  price_date: string | null;
}

export interface PricingIndexes {
  byProductId: Map<string, PricingSnapshot>;
  byGameAndCleanName: Map<string, PricingSnapshot>;
}

function marketGameKey(game: string | undefined): string {
  const normalized = (game ?? '').trim().toLowerCase();
  if (normalized.includes('magic')) return 'magic';
  if (normalized.includes('yu-gi-oh') || normalized.includes('yugioh')) return 'yugioh';
  if (normalized.includes('one piece')) return 'one_piece';
  if (normalized.includes('lorcana') || normalized.includes('disney')) return 'lorcana';
  return normalized;
}

export function buildPricingIndexes(marketRows: MarketRow[], volatilityRows: VolatilityRow[]): PricingIndexes {
  const byProductId = new Map<string, PricingSnapshot>();
  const byGameAndCleanName = new Map<string, PricingSnapshot>();
  const volatilityByProductId = new Map(volatilityRows.map((row) => [row.product_id, row]));

  for (const row of marketRows) {
    const stats = volatilityByProductId.get(row.product_id);
    const snapshot: PricingSnapshot = {
      product_id: row.product_id,
      game: marketGameKey(row.game),
      name: row.name,
      market_price: parseOptionalNumber(row.market_price),
      low_price: parseOptionalNumber(row.low_price),
      mid_price: parseOptionalNumber(row.mid_price),
      high_price: parseOptionalNumber(row.high_price),
      last_price: parseOptionalNumber(stats?.last_price),
      drift_7d: parseOptionalNumber(stats?.drift_7d),
      volatility_7d: parseOptionalNumber(stats?.volatility_7d),
      sharpe_ratio: parseOptionalNumber(stats?.sharpe_ratio),
      price_date: row.price_date || null,
    };

    byProductId.set(row.product_id, snapshot);
    byGameAndCleanName.set(`${snapshot.game}:${cleanName(row.name)}`, snapshot);
  }

  return { byProductId, byGameAndCleanName };
}

export function mergePricing(
  record: NormalizedCardRecord,
  pricing: PricingIndexes,
  productId?: string | null,
): NormalizedCardRecord {
  const byProduct = productId ? pricing.byProductId.get(productId) : undefined;
  const byName = pricing.byGameAndCleanName.get(`${record.game}:${record.clean_name}`);
  const chosen = byProduct ?? byName;
  if (!chosen) return record;

  return {
    ...record,
    market_price: chosen.market_price,
    low_price: chosen.low_price,
    mid_price: chosen.mid_price,
    high_price: chosen.high_price,
    last_price: chosen.last_price,
    drift_7d: chosen.drift_7d,
    volatility_7d: chosen.volatility_7d,
    sharpe_ratio: chosen.sharpe_ratio,
    price_date: chosen.price_date,
  };
}
