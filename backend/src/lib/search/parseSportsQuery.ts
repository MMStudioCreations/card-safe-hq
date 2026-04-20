export type ParsedSportsQuery = {
  raw: string;
  player?: string;
  brand?: string;
  setYear?: string;
  setName?: string;
  cardNumber?: string;
  keywords: string[];
};

type BrandDef = {
  canonical: string;
  tokens: string[];
};

const BRAND_DEFS: BrandDef[] = [
  { canonical: 'topps', tokens: ['topps'] },
  { canonical: 'panini', tokens: ['panini'] },
  { canonical: 'upper deck', tokens: ['upper', 'deck'] },
  { canonical: 'donruss', tokens: ['donruss'] },
  { canonical: 'bowman', tokens: ['bowman'] },
  { canonical: 'fleer', tokens: ['fleer'] },
];

const SET_KEYWORD_TO_BRAND: Record<string, { brand: string; setName?: string }> = {
  prizm: { brand: 'panini', setName: 'prizm' },
};

const SET_DETAIL_KEYWORDS = new Set([
  'chrome',
  'finest',
  'refractor',
  'optic',
  'select',
  'mosaic',
  'heritage',
  'stadium',
  'club',
  'update',
  'series',
  'draft',
  'tiffany',
]);

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isYearToken(token: string): boolean {
  return /^\d{2}$/.test(token) || /^\d{4}$/.test(token);
}

function toFourDigitYear(token: string): string {
  if (/^\d{4}$/.test(token)) return token;
  if (!/^\d{2}$/.test(token)) return token;
  return `19${token}`;
}

function findBrand(tokens: string[]): { brand?: string; setName?: string; consumed: Set<number> } {
  const consumed = new Set<number>();
  for (const def of BRAND_DEFS) {
    if (def.tokens.length === 1) {
      const idx = tokens.indexOf(def.tokens[0]);
      if (idx >= 0) {
        consumed.add(idx);
        return { brand: def.canonical, consumed };
      }
      continue;
    }

    for (let i = 0; i <= tokens.length - def.tokens.length; i += 1) {
      const isMatch = def.tokens.every((piece, j) => tokens[i + j] === piece);
      if (isMatch) {
        for (let j = 0; j < def.tokens.length; j += 1) consumed.add(i + j);
        return { brand: def.canonical, consumed };
      }
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const fallback = SET_KEYWORD_TO_BRAND[tokens[i]];
    if (fallback) {
      consumed.add(i);
      return { brand: fallback.brand, setName: fallback.setName, consumed };
    }
  }

  return { consumed };
}

function toDisplayCase(text: string): string {
  const special: Record<string, string> = {
    psa: 'PSA',
    bgs: 'BGS',
    sgc: 'SGC',
    cgc: 'CGC',
    rc: 'RC',
    nba: 'NBA',
    nfl: 'NFL',
    mlb: 'MLB',
    nhl: 'NHL',
    ufc: 'UFC',
    f1: 'F1',
    lebron: 'LeBron',
  };

  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const found = special[word.toLowerCase()];
      if (found) return found;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}

export function parseSportsQuery(query: string): ParsedSportsQuery {
  const raw = query;
  const normalized = normalizeQuery(query);
  if (!normalized) return { raw, keywords: [] };

  const tokens = normalized.split(' ');
  const consumed = new Set<number>();

  const { brand, setName: inferredSetName, consumed: brandConsumed } = findBrand(tokens);
  brandConsumed.forEach((idx) => consumed.add(idx));

  const parsed: ParsedSportsQuery = { raw, keywords: [] };
  if (brand) parsed.brand = brand;
  if (inferredSetName) parsed.setName = inferredSetName;

  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    const token = tokens[i];

    if (isYearToken(token) && !parsed.setYear) {
      parsed.setYear = toFourDigitYear(token);
      consumed.add(i);
      continue;
    }

    if (/^#\w+$/i.test(token) && !parsed.cardNumber) {
      parsed.cardNumber = token.replace(/^#/, '');
      consumed.add(i);
      continue;
    }
  }

  if (parsed.brand && !parsed.setName) {
    const brandIndex = tokens.findIndex((t) => t === parsed.brand || SET_KEYWORD_TO_BRAND[t]?.brand === parsed.brand);
    if (brandIndex >= 0) {
      const detailTokens: string[] = [];
      for (let i = brandIndex + 1; i < tokens.length; i += 1) {
        if (consumed.has(i)) continue;
        const t = tokens[i];
        if (SET_DETAIL_KEYWORDS.has(t) || t === 'prizm') {
          detailTokens.push(t);
          consumed.add(i);
        } else {
          break;
        }
      }
      if (detailTokens.length > 0) {
        parsed.setName = detailTokens.join(' ');
      }
    }
  }

  if (!parsed.brand) {
    for (let i = 0; i < tokens.length; i += 1) {
      const fallback = SET_KEYWORD_TO_BRAND[tokens[i]];
      if (fallback) {
        parsed.brand = fallback.brand;
        if (fallback.setName) parsed.setName = fallback.setName;
        consumed.add(i);
        break;
      }
    }
  }

  const first = tokens[0];
  if (first && !consumed.has(0) && !isYearToken(first) && !SET_KEYWORD_TO_BRAND[first] && !BRAND_DEFS.some((d) => d.tokens[0] === first)) {
    consumed.add(0);
    const playerTokens = [first];

    const second = tokens[1];
    if (
      second
      && !consumed.has(1)
      && !isYearToken(second)
      && !SET_KEYWORD_TO_BRAND[second]
      && !BRAND_DEFS.some((d) => d.tokens.includes(second))
    ) {
      playerTokens.push(second);
      consumed.add(1);
    }

    parsed.player = playerTokens.join(' ');
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    const token = tokens[i];
    const previous = tokens[i - 1] || '';

    if (
      !parsed.cardNumber
      && /^\d{1,3}[a-z]?$/i.test(token)
      && parsed.brand
      && !['psa', 'bgs', 'sgc', 'cgc'].includes(previous)
    ) {
      parsed.cardNumber = token;
      consumed.add(i);
      continue;
    }

    parsed.keywords.push(token);
  }

  return parsed;
}

export function buildSportsSearchQuery(parsed: ParsedSportsQuery): string {
  const parts: string[] = [];

  if (parsed.player) parts.push(toDisplayCase(parsed.player));

  if (parsed.brand) {
    parts.push(toDisplayCase(parsed.brand));
  }

  if (parsed.setName) {
    const normalizedSetName = parsed.brand === 'panini' && parsed.setName === 'prizm'
      ? 'Prizm'
      : toDisplayCase(parsed.setName);
    if (!parts.some((part) => part.toLowerCase() === normalizedSetName.toLowerCase())) {
      parts.push(normalizedSetName);
    }
  }

  if (parsed.setYear) parts.push(parsed.setYear);
  if (parsed.cardNumber) parts.push(`#${parsed.cardNumber}`);

  if (parsed.keywords.length > 0) {
    parts.push(...parsed.keywords.map((token) => toDisplayCase(token)));
  }

  const built = parts.join(' ').trim();
  return built || parsed.raw.trim();
}
