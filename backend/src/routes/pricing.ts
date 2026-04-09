import type { Env } from '../types';
import { queryOne, run } from '../lib/db';
import { notFound, ok } from '../lib/json';
import { getCardById, searchPokemonCard, extractTCGPlayerPrice } from '../lib/pokemontcg';
import { fetchPriceChartingData } from '../lib/pricecharting';
import { lookupCardInCatalog } from '../lib/pokemon-reference';

interface CardRow {
  id: number;
  card_name: string;
  player_name?: string;
  set_name?: string;
  card_number?: string;
  game?: string;
  sport?: string;
  year?: number;
  external_ref?: string;
}

// GET /api/pricing/:cardId
// Returns TCGPlayer + PriceCharting prices for a card
export async function getCardPricing(env: Env, cardId: number): Promise<Response> {
  const card = await queryOne<CardRow>(
    env.DB,
    'SELECT * FROM cards WHERE id = ?',
    [cardId],
  );
  if (!card) return notFound('Card not found');

  const name = card.player_name || card.card_name;
  const isPokemon = (card.game || card.sport || '').toLowerCase().includes('poke') ||
                    (card.game || '').toLowerCase().includes('tcg');

  const results: Record<string, unknown> = { card_id: cardId };

  // TCGPlayer via Pokémon TCG API (Pokémon only)
  if (isPokemon && env.POKEMON_TCG_API_KEY) {
    try {
      let ptcgCard = null;

      // ── Step 1: try exact PTCG ID stored on the card row ──────────────────
      // external_ref is set to the ptcg_id (e.g. "sv3pt5-123") during scan
      if (card.external_ref && /^[a-z0-9]+-\d+/i.test(card.external_ref)) {
        ptcgCard = await getCardById(env.POKEMON_TCG_API_KEY, card.external_ref);
        if (ptcgCard) {
          console.log(`[pricing] resolved via external_ref: ${card.external_ref}`);
        }
      }

      // ── Step 2: look up in local pokemon_catalog by name + number ─────────
      // This avoids the "first search result" ambiguity of the PTCG API
      if (!ptcgCard) {
        const catalogCard = await lookupCardInCatalog(env.DB, name, card.card_number ?? null);
        if (catalogCard?.ptcg_id) {
          ptcgCard = await getCardById(env.POKEMON_TCG_API_KEY, catalogCard.ptcg_id);
          if (ptcgCard) {
            console.log(`[pricing] resolved via catalog: ${catalogCard.ptcg_id} (${catalogCard.set_name})`);
            // Persist the resolved ptcg_id so future lookups skip this step
            await run(
              env.DB,
              `UPDATE cards SET external_ref = ?, set_name = COALESCE(set_name, ?) WHERE id = ?`,
              [catalogCard.ptcg_id, catalogCard.set_name, cardId],
            );
          }
        }
      }

      // ── Step 3: fall back to broad name search (original behaviour) ───────
      if (!ptcgCard) {
        ptcgCard = await searchPokemonCard(
          env.POKEMON_TCG_API_KEY,
          name,
          card.card_number,
          card.set_name,
        );
        if (ptcgCard) {
          console.log(`[pricing] resolved via name search fallback: ${ptcgCard.id}`);
        }
      }

      if (ptcgCard) {
        const tcgPrices = extractTCGPlayerPrice(ptcgCard);
        results.tcgplayer = tcgPrices;
        results.ptcg_id = ptcgCard.id;
        results.ptcg_set_id = ptcgCard.set.id;
        results.ptcg_set_name = ptcgCard.set.name;
        results.ptcg_series = ptcgCard.set.series;
        results.ptcg_legalities = ptcgCard.legalities;
        results.ptcg_image = ptcgCard.images?.large;
        results.tcgplayer_url = ptcgCard.tcgplayer?.url;

        // Auto-update card's set info if missing
        if (!card.set_name && ptcgCard.set?.name) {
          await run(
            env.DB,
            `UPDATE cards SET set_name = ?, external_ref = ? WHERE id = ?`,
            [ptcgCard.set.name, ptcgCard.id, cardId],
          );
        }

        // Update estimated value with TCGPlayer market price
        if (tcgPrices.market) {
          await run(
            env.DB,
            `UPDATE collection_items SET estimated_value_cents = ? WHERE card_id = ?`,
            [tcgPrices.market, cardId],
          );
        }
      }
    } catch (err) {
      console.error('TCGPlayer pricing failed:', err);
      results.tcgplayer = null;
    }
  }

  // PriceCharting (all card types)
  // Use the resolved set_name if available for a tighter match
  try {
    const resolvedSetName = (results.ptcg_set_name as string | undefined) ?? card.set_name ?? null;
    const pcData = await fetchPriceChartingData(name, resolvedSetName, card.card_number ?? null);
    results.pricecharting = pcData;
  } catch (err) {
    console.error('PriceCharting pricing failed:', err);
    results.pricecharting = null;
  }

  return ok(results);
}
