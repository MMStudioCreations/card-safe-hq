import type { Env, User } from '../types';
import { queryAll } from '../lib/db';
import { ok } from '../lib/json';

export async function generateDeck(
  env: Env,
  request: Request,
  user: User,
): Promise<Response> {
  const body = await request.json() as {
    game: string;
    format: string;
    strategy?: string;
    must_include?: number[];
  };

  const cards = await queryAll<Record<string, unknown>>(
    env.DB,
    `SELECT ci.id, ci.card_id, ci.estimated_value_cents, ci.estimated_grade,
            ci.front_image_url, ci.bbox_x, ci.bbox_y, ci.bbox_width, ci.bbox_height,
            c.card_name, c.player_name, c.set_name, c.card_number,
            c.game, c.sport, c.variation, c.rarity, c.year
     FROM collection_items ci
     JOIN cards c ON ci.card_id = c.id
     WHERE ci.user_id = ?
       AND (LOWER(c.game) LIKE ? OR LOWER(c.sport) LIKE ?)
       AND ci.confirmed_at IS NOT NULL
     ORDER BY ci.estimated_value_cents DESC`,
    [user.id, `%${body.game}%`, `%${body.game}%`],
  );

  if (cards.length === 0) {
    return ok({
      deck: [],
      message: `No ${body.game} cards found in your collection. Add cards via Scan or Upload first.`,
      stats: null,
    });
  }

  const deckSize = body.game === 'yugioh' ? 40 : 60;
  const maxCopies = body.game === 'yugioh' ? 3 : 4;

  // Group by card_name to handle copies
  const byName = new Map<string, typeof cards>();
  for (const card of cards) {
    const name = (card.player_name || card.card_name || 'Unknown') as string;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(card);
  }

  const deck: Array<{ collection_item_id: number; card_name: string; copies: number }> = [];
  let totalCards = 0;

  // Add must-include cards first
  if (body.must_include?.length) {
    for (const itemId of body.must_include) {
      const card = cards.find((c) => c.id === itemId);
      if (card && totalCards < deckSize) {
        const name = (card.player_name || card.card_name || 'Unknown') as string;
        const existing = deck.find((d) => d.card_name === name);
        if (existing && existing.copies < maxCopies) {
          existing.copies++;
          totalCards++;
        } else if (!existing) {
          deck.push({ collection_item_id: card.id as number, card_name: name, copies: 1 });
          totalCards++;
        }
      }
    }
  }

  // Fill remaining slots with best available cards
  for (const [name, cardCopies] of byName.entries()) {
    if (totalCards >= deckSize) break;
    const copiesToAdd = Math.min(maxCopies, cardCopies.length, deckSize - totalCards);
    if (copiesToAdd > 0) {
      const existing = deck.find((d) => d.card_name === name);
      if (!existing) {
        deck.push({
          collection_item_id: cardCopies[0].id as number,
          card_name: name,
          copies: copiesToAdd,
        });
        totalCards += copiesToAdd;
      }
    }
  }

  const totalValue = deck.reduce((sum, d) => {
    const card = cards.find((c) => (c.player_name || c.card_name) === d.card_name);
    return sum + ((card?.estimated_value_cents as number) ?? 0) * d.copies;
  }, 0);

  return ok({
    deck,
    cards_available: cards.length,
    deck_size: totalCards,
    target_size: deckSize,
    total_value_cents: totalValue,
    message:
      totalCards < deckSize
        ? `Built ${totalCards}/${deckSize} card deck. Add more ${body.game} cards to complete it.`
        : `Complete ${deckSize}-card deck generated from your collection!`,
  });
}
