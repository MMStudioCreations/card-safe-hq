export interface PriceChartingData {
  loose_price_cents: number | null;
  graded_price_cents: number | null;
  psa_10_price_cents: number | null;
  psa_9_price_cents: number | null;
  url: string | null;
}

export async function fetchPriceChartingData(
  cardName: string,
  setName: string | null,
  cardNumber: string | null,
): Promise<PriceChartingData> {
  const empty: PriceChartingData = {
    loose_price_cents: null,
    graded_price_cents: null,
    psa_10_price_cents: null,
    psa_9_price_cents: null,
    url: null,
  };

  try {
    // Search PriceCharting
    const query = [cardName, setName, cardNumber]
      .filter(Boolean)
      .join(' ');

    const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);

    let html: string;
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CardSafeHQBot/1.0)',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      });
      if (!res.ok) return empty;
      html = await res.text();
    } finally {
      clearTimeout(timeoutId);
    }

    // Find first result link
    const linkMatch = html.match(/href="(\/game\/[^"]+)"/);
    if (!linkMatch) return empty;

    const productUrl = `https://www.pricecharting.com${linkMatch[1]}`;

    // Fetch product page
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 8_000);

    let productHtml: string;
    try {
      const res2 = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CardSafeHQBot/1.0)',
          'Accept': 'text/html',
        },
        signal: controller2.signal,
      });
      if (!res2.ok) return empty;
      productHtml = await res2.text();
    } finally {
      clearTimeout(timeoutId2);
    }

    // Extract prices using regex patterns for PriceCharting's price spans
    function extractPrice(html: string, label: string): number | null {
      const patterns = [
        new RegExp(`${label}[^$]*\\$([\\d,]+\\.?\\d*)`, 'i'),
        new RegExp(`id="${label}"[^>]*>[^$]*\\$([\\d,]+\\.?\\d*)`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const num = parseFloat(match[1].replace(',', ''));
          if (isFinite(num) && num > 0) return Math.round(num * 100);
        }
      }
      return null;
    }

    return {
      loose_price_cents: extractPrice(productHtml, 'used_price') ??
                         extractPrice(productHtml, 'loose'),
      graded_price_cents: extractPrice(productHtml, 'graded'),
      psa_10_price_cents: extractPrice(productHtml, 'psa-10') ??
                          extractPrice(productHtml, 'grade-10'),
      psa_9_price_cents: extractPrice(productHtml, 'psa-9') ??
                         extractPrice(productHtml, 'grade-9'),
      url: productUrl,
    };
  } catch (err) {
    console.error('fetchPriceChartingData failed:', err);
    return empty;
  }
}
