import type { Env, User } from '../types';
import { ok, serverError, forbidden } from '../lib/json';

const ADMIN_EMAIL = 'michaelamarino16@gmail.com';

function requireAdmin(user: User): Response | null {
  const adminEmail = ADMIN_EMAIL;
  if (user.email !== adminEmail) return forbidden('Forbidden');
  return null;
}

const TCGCSV_BASE = 'https://tcgcsv.com/tcgplayer/3';

function detectProductType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('ultra premium') || n.includes('upc')) return 'ultra_premium_collection';
  if (n.includes('super premium')) return 'super_premium_collection';
  if (n.includes('elite trainer box') || n.includes('etb')) return 'elite_trainer_box';
  if (n.includes('premium collection')) return 'premium_collection';
  if (n.includes('special collection')) return 'special_collection';
  if (n.includes('figure collection')) return 'figure_collection';
  if (n.includes('poster collection')) return 'poster_collection';
  if (n.includes('pin collection')) return 'pin_collection';
  if (n.includes('collection box')) return 'collection_box';
  if (n.includes('collection')) return 'special_collection';
  if (n.includes('booster bundle') || n.includes('bundle')) return 'booster_bundle';
  if (n.includes('booster box') || n.includes('booster case')) return 'booster_box';
  if (n.includes('booster pack') || n.includes('booster')) return 'booster_pack';
  if (n.includes('build & battle') || n.includes('build and battle')) return 'build_and_battle';
  if (n.includes('battle deck') || n.includes('battle box')) return 'battle_deck';
  if (n.includes('world championship')) return 'world_championship_deck';
  if (n.includes('theme deck') || n.includes('starter deck') || n.includes('trainer kit')) return 'theme_deck';
  if (n.includes('blister')) return 'blister_pack';
  if (n.includes('gift set') || n.includes('gift box')) return 'gift_set';
  if (n.includes('binder')) return 'binder_collection';
  if (n.includes('ex box') || n.includes(' ex ') || n.endsWith(' ex')) return 'ex_box';
  if (n.includes('promo') || n.includes('promo pack')) return 'promo_pack';
  if (n.includes('tin')) return 'tin';
  if (n.includes('mini tin')) return 'mini_tin';
  return 'other_sealed';
}

const SEALED_KEYWORDS = [
  'box', 'tin', 'bundle', 'collection', 'pack', 'deck', 'kit', 'binder',
  'set', 'case', 'blister', 'gift', 'promo', 'etb', 'trainer', 'battle',
  'championship', 'premium', 'ultra', 'special', 'figure', 'poster', 'pin',
];

function isLikelySealed(name: string): boolean {
  const n = name.toLowerCase();
  return SEALED_KEYWORDS.some(kw => n.includes(kw));
}

interface TCGCSVGroup {
  groupId: number;
  name: string;
  publishedOn?: string;
}

interface TCGCSVProduct {
  productId: number;
  name: string;
  number?: string;
  groupId: number;
  url?: string;
}

interface TCGCSVPrice {
  productId: number;
  subTypeName: string;
  marketPrice?: number;
}

export async function handleSealedSync(env: Env, user: User): Promise<Response> {
  const denied = requireAdmin(user);
  if (denied) return denied;

  try {
    // 1. Fetch all groups (sets)
    const groupsRes = await fetch(`${TCGCSV_BASE}/groups`);
    if (!groupsRes.ok) throw new Error(`Failed to fetch groups: ${groupsRes.status}`);
    const groupsData = await groupsRes.json() as { results: TCGCSVGroup[] };
    const groups = groupsData.results ?? [];

    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // Process groups in batches to avoid timeout
    const BATCH_SIZE = 10;
    for (let i = 0; i < Math.min(groups.length, 100); i += BATCH_SIZE) {
      const batch = groups.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (group) => {
        try {
          const [productsRes, pricesRes] = await Promise.all([
            fetch(`${TCGCSV_BASE}/${group.groupId}/products`),
            fetch(`${TCGCSV_BASE}/${group.groupId}/prices`),
          ]);

          if (!productsRes.ok || !pricesRes.ok) return;

          const [productsData, pricesData] = await Promise.all([
            productsRes.json() as Promise<{ results: TCGCSVProduct[] }>,
            pricesRes.json() as Promise<{ results: TCGCSVPrice[] }>,
          ]);

          const products = productsData.results ?? [];
          const prices = pricesData.results ?? [];

          // Build price map: productId -> market price in cents
          const priceMap = new Map<number, number>();
          for (const p of prices) {
            if (p.marketPrice && !priceMap.has(p.productId)) {
              priceMap.set(p.productId, Math.round(p.marketPrice * 100));
            }
          }

          // Filter to sealed products only (no card number = sealed)
          const sealedProducts = products.filter(p => !p.number && isLikelySealed(p.name));

          for (const product of sealedProducts) {
            const productType = detectProductType(product.name);
            const marketPriceCents = priceMap.get(product.productId) ?? null;
            const tcgplayerUrl = product.url ?? `https://www.tcgplayer.com/product/${product.productId}`;
            const releaseDate = group.publishedOn ? group.publishedOn.split('T')[0] : null;

            try {
              await env.DB.prepare(
                `INSERT OR REPLACE INTO sealed_products
                   (name, set_name, set_id, product_type, tcgplayer_url, market_price_cents, release_date, tcgplayer_product_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                product.name,
                group.name,
                String(group.groupId),
                productType,
                tcgplayerUrl,
                marketPriceCents,
                releaseDate,
                product.productId,
              ).run();
              totalInserted++;
            } catch {
              totalSkipped++;
            }
          }
        } catch (err) {
          errors.push(`Group ${group.groupId}: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }));
    }

    return ok({
      inserted: totalInserted,
      skipped: totalSkipped,
      groups_processed: Math.min(groups.length, 100),
      total_groups: groups.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[sealed-sync] error', err);
    return serverError(err instanceof Error ? err.message : 'Sync failed');
  }
}

/**
 * Live search fallback — queries TCGCSV directly when sealed_products table is empty.
 * Returns results in the same format as the DB query.
 */
export async function searchSealedLive(query: string, limit: number): Promise<Array<{
  id: number;
  name: string;
  set_name: string;
  product_type: string;
  tcgplayer_url: string | null;
  market_price_cents: number | null;
  release_date: string | null;
  tcgplayer_product_id: number | null;
}>> {
  try {
    const q = query.toLowerCase();
    const groupsRes = await fetch(`${TCGCSV_BASE}/groups`);
    if (!groupsRes.ok) return [];
    const groupsData = await groupsRes.json() as { results: TCGCSVGroup[] };
    const allGroups = groupsData.results ?? [];

    const results: Array<{
      id: number; name: string; set_name: string; product_type: string;
      tcgplayer_url: string | null; market_price_cents: number | null;
      release_date: string | null; tcgplayer_product_id: number | null;
    }> = [];

    // Sort all groups by groupId descending (newest first — higher IDs = more recent sets)
    const sortedGroups = [...allGroups].sort((a, b) => b.groupId - a.groupId);
    // Split query into significant words (3+ chars) for group name matching
    const queryWords = q.split(/\s+/).filter(w => w.length >= 3);
    // Search groups whose name contains ANY significant query word
    const groupNameMatches = sortedGroups.filter(g => {
      const gn = g.name.toLowerCase();
      return queryWords.some(w => gn.includes(w));
    });
    // Also check the 80 most recent groups for product-level name matches
    const recentGroups = sortedGroups.slice(0, 80);
    // Merge: group name matches + recent groups, deduplicated, up to 60 total
    const groupsToSearch = [...new Map([...groupNameMatches, ...recentGroups].map(g => [g.groupId, g])).values()].slice(0, 60);

    await Promise.all(groupsToSearch.map(async (group) => {
      try {
        const [productsRes, pricesRes] = await Promise.all([
          fetch(`${TCGCSV_BASE}/${group.groupId}/products`),
          fetch(`${TCGCSV_BASE}/${group.groupId}/prices`),
        ]);
        if (!productsRes.ok || !pricesRes.ok) return;

        const [productsData, pricesData] = await Promise.all([
          productsRes.json() as Promise<{ results: TCGCSVProduct[] }>,
          pricesRes.json() as Promise<{ results: TCGCSVPrice[] }>,
        ]);

        const products = productsData.results ?? [];
        const prices = pricesData.results ?? [];
        const priceMap = new Map<number, number>();
        for (const p of prices) {
          if (p.marketPrice && !priceMap.has(p.productId)) {
            priceMap.set(p.productId, Math.round(p.marketPrice * 100));
          }
        }

        const sealedProducts = products.filter(p => !p.number && isLikelySealed(p.name));
        for (const product of sealedProducts) {
          // Match on product name OR set name
          if (product.name.toLowerCase().includes(q) || group.name.toLowerCase().includes(q)) {
            results.push({
              id: product.productId,
              name: product.name,
              set_name: group.name,
              product_type: detectProductType(product.name),
              tcgplayer_url: product.url ?? `https://www.tcgplayer.com/product/${product.productId}`,
              market_price_cents: priceMap.get(product.productId) ?? null,
              release_date: group.publishedOn ? group.publishedOn.split('T')[0] : null,
              tcgplayer_product_id: product.productId,
            });
          }
        }
      } catch {
        // ignore individual group errors
      }
    }));

    // Sort by relevance: exact product name match first, then set name match
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bExact = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aExact - bExact;
    });

    return results.slice(0, limit);
  } catch {
    return [];
  }
}
