/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { importOnePieceCsv } from '../src/lib/importers/importOnePieceCsv';
import { importYugiohCsv } from '../src/lib/importers/importYugiohCsv';
import { importLorcanaCsv } from '../src/lib/importers/importLorcanaCsv';
import { importMagicCsv } from '../src/lib/importers/importMagicCsv';
import {
  buildPricingIndexes,
  type CsvRow,
  type MarketRow,
  type VolatilityRow,
} from '../src/lib/importers/importSharedMarketData';
import { cleanName, type NormalizedCardRecord } from '../src/lib/normalize/normalizeCardRecord';

const IMPORT_DIR = path.resolve(process.cwd(), 'backend/data/imports');
const OUTPUT_SQL = path.join(IMPORT_DIR, 'card_records_import.sql');

type HeaderAwareRows = { headers: string[]; rows: CsvRow[] };

function parseCsv(content: string): HeaderAwareRows {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((header) => header.trim());
  const dataRows = rows.slice(1).map((cols) => {
    const out: CsvRow = {};
    headers.forEach((header, index) => {
      out[header] = cols[index] ?? '';
    });
    return out;
  });

  return { headers, rows: dataRows };
}

function readCsv(fileName: string): HeaderAwareRows {
  const fullPath = path.join(IMPORT_DIR, fileName);
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = parseCsv(raw);
  console.log(`\n[headers] ${fileName}`);
  console.log(parsed.headers.join(' | '));
  return parsed;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dedupe(records: NormalizedCardRecord[]): NormalizedCardRecord[] {
  const priorityBySource: Record<string, number> = {
    onepiece_repo_csv: 30,
    yugioh_repo_csv: 30,
    lorcana_repo_csv: 30,
    pricecharting_magic_csv: 20,
  };

  const map = new Map<string, NormalizedCardRecord>();

  for (const record of records) {
    const dedupeKey = `${record.game}:${record.clean_name}:${record.set_code ?? ''}:${record.card_number ?? ''}`;
    const existing = map.get(dedupeKey);
    if (!existing) {
      map.set(dedupeKey, record);
      continue;
    }

    const existingPriority = priorityBySource[existing.source] ?? 0;
    const incomingPriority = priorityBySource[record.source] ?? 0;
    const keepIncoming =
      incomingPriority > existingPriority ||
      (!!record.market_price && !existing.market_price) ||
      (!!record.image_url && !existing.image_url);

    if (keepIncoming) {
      map.set(dedupeKey, {
        ...existing,
        ...record,
        metadata_json: JSON.stringify({ merged_from: [existing.source, record.source] }),
      });
    } else if (!existing.market_price && record.market_price) {
      existing.market_price = record.market_price;
      existing.low_price = record.low_price;
      existing.mid_price = record.mid_price;
      existing.high_price = record.high_price;
      existing.last_price = record.last_price;
      existing.drift_7d = record.drift_7d;
      existing.volatility_7d = record.volatility_7d;
      existing.sharpe_ratio = record.sharpe_ratio;
      existing.price_date = record.price_date;
      map.set(dedupeKey, existing);
    }
  }

  return [...map.values()];
}

function buildSql(records: NormalizedCardRecord[]): string {
  const rowsSql = records.map((record) => `(
${[
    record.source_id,
    record.source,
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
    record.cost_or_mana,
    record.attack,
    record.defense,
    record.description,
    record.image_url,
    record.market_price,
    record.low_price,
    record.mid_price,
    record.high_price,
    record.last_price,
    record.drift_7d,
    record.volatility_7d,
    record.sharpe_ratio,
    record.price_date,
    record.searchable_text,
    record.is_sealed,
    record.metadata_json,
  ].map(sqlValue).join(',\n')}
)`).join(',\n');

  return `BEGIN TRANSACTION;
DELETE FROM card_records WHERE source IN ('onepiece_repo_csv', 'yugioh_repo_csv', 'lorcana_repo_csv', 'pricecharting_magic_csv');
INSERT INTO card_records (
  source_id, source, game, name, clean_name, set_name, set_code, card_number, rarity,
  type, subtype, attribute_or_color, cost_or_mana, attack, defense, description, image_url,
  market_price, low_price, mid_price, high_price, last_price, drift_7d, volatility_7d,
  sharpe_ratio, price_date, searchable_text, is_sealed, metadata_json
)
VALUES
${rowsSql}
ON CONFLICT(source, source_id) DO UPDATE SET
  game = excluded.game,
  name = excluded.name,
  clean_name = excluded.clean_name,
  set_name = excluded.set_name,
  set_code = excluded.set_code,
  card_number = excluded.card_number,
  rarity = excluded.rarity,
  type = excluded.type,
  subtype = excluded.subtype,
  attribute_or_color = excluded.attribute_or_color,
  cost_or_mana = excluded.cost_or_mana,
  attack = excluded.attack,
  defense = excluded.defense,
  description = excluded.description,
  image_url = excluded.image_url,
  market_price = excluded.market_price,
  low_price = excluded.low_price,
  mid_price = excluded.mid_price,
  high_price = excluded.high_price,
  last_price = excluded.last_price,
  drift_7d = excluded.drift_7d,
  volatility_7d = excluded.volatility_7d,
  sharpe_ratio = excluded.sharpe_ratio,
  price_date = excluded.price_date,
  searchable_text = excluded.searchable_text,
  is_sealed = excluded.is_sealed,
  metadata_json = excluded.metadata_json,
  updated_at = CURRENT_TIMESTAMP;
COMMIT;`;
}

function importPriceChartingMagic(pricing: ReturnType<typeof buildPricingIndexes>): NormalizedCardRecord[] {
  const candidates = fs
    .readdirSync(IMPORT_DIR)
    .filter((file) => /^pricecharting[-_ ]?magic.*\.csv$/i.test(file));

  const results: NormalizedCardRecord[] = [];
  for (const file of candidates) {
    const parsed = readCsv(file);
    for (const row of parsed.rows) {
      const record = importMagicCsv(row, pricing);
      if (record) results.push(record);
    }
  }

  return results;
}

function main(): void {
  const market = readCsv('tcg_market_data.csv').rows as MarketRow[];
  const volatility = readCsv('tcg_volatility_stats.csv').rows as VolatilityRow[];
  const pricing = buildPricingIndexes(market, volatility);

  const onePieceRows = readCsv('OnePieceTCG_Cards.csv').rows;
  const ygoRows = readCsv('yugioh-ccd-2025SEP12-163128.csv').rows;
  const lorcanaRows = readCsv('cards.csv').rows;

  const output: NormalizedCardRecord[] = [];

  for (const row of onePieceRows) {
    const record = importOnePieceCsv(row, pricing);
    if (record) output.push(record);
  }

  for (const row of ygoRows) {
    const record = importYugiohCsv(row, pricing);
    if (record) output.push(record);
  }

  for (const row of lorcanaRows) {
    const record = importLorcanaCsv(row, pricing);
    if (record) output.push(record);
  }

  output.push(...importPriceChartingMagic(pricing));

  // Enrich searchable text and ensure stable clean_name fallbacks.
  const normalized = output.map((record) => ({
    ...record,
    clean_name: record.clean_name || cleanName(record.name),
    searchable_text: record.searchable_text || `${record.game} ${record.name}`.toLowerCase(),
  }));

  const deduped = dedupe(normalized);
  const sql = buildSql(deduped);
  fs.writeFileSync(OUTPUT_SQL, sql, 'utf8');

  console.log(`\n[done] wrote ${deduped.length} normalized records to ${OUTPUT_SQL}`);
  console.log('[next] Apply with: wrangler d1 execute <DB_NAME> --file backend/data/imports/card_records_import.sql');
}

main();
