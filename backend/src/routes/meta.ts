import type { Env } from '../types';
import { ok } from '../lib/json';
import { queryAll } from '../lib/db';

type FullDeckCard = {
  name: string;
  qty: number;
  category: 'pokemon' | 'trainer' | 'energy';
  search: string;
};

// Get curated meta deck templates per game
const META_DECKS: Record<string, Array<{
  name: string;
  archetype: string;
  game: string;
  format: string;
  theme: string;
  description: string;
  key_cards: string[];
  strategy: string;
  full_deck?: FullDeckCard[];
}>> = {
  pokemon: [
    {
      name: 'Charizard ex / Pidgeot ex',
      archetype: 'Charizard ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Use Pidgeot ex to search for any card each turn, powering up Charizard ex for massive damage.',
      key_cards: ['Charizard ex', 'Pidgeot ex', 'Charmander', 'Charmeleon', 'Pidgey', 'Pidgeot'],
      strategy: 'aggro',
      full_deck: [
        { name: 'Charmander', qty: 4, category: 'pokemon', search: 'Charmander OBF 026 pokemon card' },
        { name: 'Charmeleon', qty: 2, category: 'pokemon', search: 'Charmeleon OBF pokemon card' },
        { name: 'Charizard ex', qty: 3, category: 'pokemon', search: 'Charizard ex OBF 125 pokemon card' },
        { name: 'Pidgey', qty: 3, category: 'pokemon', search: 'Pidgey OBF pokemon card' },
        { name: 'Pidgeotto', qty: 1, category: 'pokemon', search: 'Pidgeotto OBF pokemon card' },
        { name: 'Pidgeot ex', qty: 3, category: 'pokemon', search: 'Pidgeot ex OBF 164 pokemon card' },
        { name: 'Mew ex', qty: 2, category: 'pokemon', search: 'Mew ex MEW 232 pokemon card' },
        { name: 'Lumineon V', qty: 1, category: 'pokemon', search: 'Lumineon V BRS 040 pokemon card' },
        { name: 'Radiant Charizard', qty: 1, category: 'pokemon', search: 'Radiant Charizard PGO 011 pokemon card' },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professor's Research pokemon trainer card" },
        { name: 'Arven', qty: 4, category: 'trainer', search: 'Arven SVI pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss's Orders PAL pokemon trainer card" },
        { name: 'Rare Candy', qty: 4, category: 'trainer', search: 'Rare Candy SVI pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI pokemon trainer card' },
        { name: 'Nest Ball', qty: 4, category: 'trainer', search: 'Nest Ball SVI pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ pokemon trainer card' },
        { name: 'Counter Catcher', qty: 2, category: 'trainer', search: 'Counter Catcher PAR pokemon trainer card' },
        { name: 'Pokégear 3.0', qty: 2, category: 'trainer', search: 'Pokegear 3.0 pokemon trainer card' },
        { name: 'Magma Basin', qty: 3, category: 'trainer', search: 'Magma Basin BRS pokemon trainer card' },
        { name: 'Fire Energy', qty: 11, category: 'energy', search: 'Fire Energy Basic pokemon energy card' },
      ],
    },
    {
      name: 'Gardevoir ex',
      archetype: 'Gardevoir ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Control',
      description: 'Accelerate Psychic energy from hand with Gardevoir ex ability for powerful attacks.',
      key_cards: ['Gardevoir ex', 'Ralts', 'Kirlia', 'Zacian V', 'Psychic Energy'],
      strategy: 'control',
      full_deck: [
        { name: 'Ralts', qty: 4, category: 'pokemon', search: 'Ralts SIT 067 pokemon card' },
        { name: 'Kirlia', qty: 3, category: 'pokemon', search: 'Kirlia SIT 068 pokemon card' },
        { name: 'Gardevoir ex', qty: 3, category: 'pokemon', search: 'Gardevoir ex SVI 086 pokemon card' },
        { name: 'Zacian V', qty: 2, category: 'pokemon', search: 'Zacian V SHF 016 pokemon card' },
        { name: 'Drifloon', qty: 2, category: 'pokemon', search: 'Drifloon SIT pokemon card' },
        { name: 'Drifblim', qty: 1, category: 'pokemon', search: 'Drifblim SIT pokemon card' },
        { name: 'Cresselia', qty: 2, category: 'pokemon', search: 'Cresselia LOR pokemon card' },
        { name: 'Mew ex', qty: 1, category: 'pokemon', search: 'Mew ex MEW 232 pokemon card' },
        { name: 'Lumineon V', qty: 1, category: 'pokemon', search: 'Lumineon V BRS 040 pokemon card' },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professor's Research pokemon trainer" },
        { name: 'Arven', qty: 3, category: 'trainer', search: 'Arven SVI pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss's Orders PAL pokemon trainer card" },
        { name: 'Iono', qty: 3, category: 'trainer', search: 'Iono PAF pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI pokemon trainer card' },
        { name: 'Rare Candy', qty: 4, category: 'trainer', search: 'Rare Candy SVI pokemon trainer card' },
        { name: 'Fog Crystal', qty: 3, category: 'trainer', search: 'Fog Crystal CRE pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ pokemon trainer card' },
        { name: 'Technical Machine: Devolution', qty: 1, category: 'trainer', search: 'Technical Machine Devolution PAR pokemon card' },
        { name: 'Psychic Energy', qty: 11, category: 'energy', search: 'Psychic Energy Basic pokemon energy card' },
      ],
    },
    {
      name: 'Miraidon ex',
      archetype: 'Miraidon ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Fast electric deck using Miraidon ex to bench Basic Pokémon and attack immediately.',
      key_cards: ['Miraidon ex', 'Raichu V', 'Electric Generator', 'Flaaffy'],
      strategy: 'aggro',
      full_deck: [
        { name: 'Miraidon ex', qty: 4, category: 'pokemon', search: 'Miraidon ex SVI 81 pokemon card' },
        { name: 'Raichu V', qty: 2, category: 'pokemon', search: 'Raichu V SIT 045 pokemon card' },
        { name: 'Flaaffy', qty: 2, category: 'pokemon', search: 'Flaaffy EVS 055 pokemon card' },
        { name: 'Regieleki V', qty: 2, category: 'pokemon', search: 'Regieleki V SIT pokemon card' },
        { name: 'Raikou V', qty: 1, category: 'pokemon', search: 'Raikou V BRS pokemon card' },
        { name: 'Lumineon V', qty: 1, category: 'pokemon', search: 'Lumineon V BRS 040 pokemon card' },
        { name: 'Tapu Koko Prism Star', qty: 1, category: 'pokemon', search: 'Tapu Koko Prism Star TM pokemon card' },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professor's Research pokemon trainer" },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss's Orders PAL pokemon trainer card" },
        { name: 'Iono', qty: 2, category: 'trainer', search: 'Iono PAF pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI pokemon trainer card' },
        { name: 'Nest Ball', qty: 4, category: 'trainer', search: 'Nest Ball SVI pokemon trainer card' },
        { name: 'Electric Generator', qty: 4, category: 'trainer', search: 'Electric Generator SVI pokemon trainer card' },
        { name: 'Energy Search', qty: 2, category: 'trainer', search: 'Energy Search pokemon trainer card' },
        { name: 'Switch', qty: 3, category: 'trainer', search: 'Switch SVI pokemon trainer card' },
        { name: 'Path to the Peak', qty: 3, category: 'trainer', search: 'Path to the Peak CRE pokemon trainer card' },
        { name: 'Lightning Energy', qty: 15, category: 'energy', search: 'Lightning Energy Basic pokemon energy card' },
      ],
    },
    {
      name: 'Lost Box',
      archetype: 'Cramorant/Sableye',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Control',
      description: 'Use the Lost Zone mechanic to power up Cramorant and Sableye for free attacks.',
      key_cards: ['Cramorant', 'Sableye', 'Comfey', 'Mirage Gate', 'Colress Machine'],
      strategy: 'control',
      full_deck: [
        { name: 'Comfey', qty: 4, category: 'pokemon', search: 'Comfey LOR 079 pokemon card' },
        { name: 'Cramorant', qty: 3, category: 'pokemon', search: 'Cramorant LOR 050 pokemon card' },
        { name: 'Sableye', qty: 3, category: 'pokemon', search: 'Sableye LOR 070 pokemon card' },
        { name: 'Radiant Greninja', qty: 1, category: 'pokemon', search: 'Radiant Greninja ASR pokemon card' },
        { name: 'Rotom V', qty: 1, category: 'pokemon', search: 'Rotom V LOR pokemon card' },
        { name: "Colress's Experiment", qty: 4, category: 'trainer', search: "Colress's Experiment LOR pokemon trainer card" },
        { name: 'Mirage Gate', qty: 4, category: 'trainer', search: 'Mirage Gate LOR pokemon trainer card' },
        { name: 'Colress Machine', qty: 4, category: 'trainer', search: 'Colress Machine LOR pokemon trainer card' },
        { name: 'Switch Cart', qty: 4, category: 'trainer', search: 'Switch Cart ASR pokemon trainer card' },
        { name: 'Escape Rope', qty: 2, category: 'trainer', search: 'Escape Rope BST pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 4, category: 'trainer', search: 'Lost Vacuum CRZ pokemon trainer card' },
        { name: 'Battle VIP Pass', qty: 4, category: 'trainer', search: 'Battle VIP Pass FST pokemon trainer card' },
        { name: 'Poker Face', qty: 2, category: 'trainer', search: 'Poker Face LOR pokemon trainer card' },
        { name: 'Watchtower', qty: 1, category: 'trainer', search: 'Watchtower PAF pokemon trainer card' },
        { name: 'Water Energy', qty: 4, category: 'energy', search: 'Water Energy Basic pokemon energy card' },
        { name: 'Psychic Energy', qty: 4, category: 'energy', search: 'Psychic Energy Basic pokemon energy card' },
        { name: 'Fire Energy', qty: 1, category: 'energy', search: 'Fire Energy Basic pokemon energy card' },
        { name: 'Grass Energy', qty: 1, category: 'energy', search: 'Grass Energy Basic pokemon energy card' },
        { name: 'Lightning Energy', qty: 1, category: 'energy', search: 'Lightning Energy Basic pokemon energy card' },
        { name: 'Fighting Energy', qty: 1, category: 'energy', search: 'Fighting Energy Basic pokemon energy card' },
        { name: 'Darkness Energy', qty: 1, category: 'energy', search: 'Darkness Energy Basic pokemon energy card' },
      ],
    },
    {
      name: 'Iron Thorns ex',
      archetype: 'Iron Thorns ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Control',
      description: 'Ancient/Future hybrid deck using Iron Thorns ex to lock opponent out of evolving.',
      key_cards: ['Iron Thorns ex', 'Iron Valiant ex', 'Future Booster Energy'],
      strategy: 'control',
    },
    {
      name: 'Lugia VSTAR',
      archetype: 'Lugia VSTAR',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Combo',
      description: 'Use Lugia VSTAR to put Colorless Pokémon from discard directly into play.',
      key_cards: ['Lugia VSTAR', 'Lugia V', 'Archeops', 'Yveltal'],
      strategy: 'combo',
    },
  ],
  magic: [
    {
      name: 'Domain Ramp',
      archetype: 'Domain',
      game: 'magic',
      format: 'Standard',
      theme: 'Control',
      description: 'Collect all basic land types to power up Domain spells for massive value.',
      key_cards: ['Atraxa, Grand Unifier', 'Sunfall', 'Up the Beanstalk', 'Sunlance'],
      strategy: 'control',
    },
    {
      name: 'Esper Midrange',
      archetype: 'Esper',
      game: 'magic',
      format: 'Standard',
      theme: 'Midrange',
      description: 'Blue/White/Black midrange using powerful planeswalkers and removal.',
      key_cards: ['The Wandering Emperor', 'Raffine', 'Teferi'],
      strategy: 'midrange',
    },
    {
      name: 'Mono Red Aggro',
      archetype: 'Mono Red',
      game: 'magic',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Fast red creatures and burn spells to end games quickly.',
      key_cards: ['Monastery Swiftspear', 'Light Up the Stage', 'Goblin Guide'],
      strategy: 'aggro',
    },
  ],
  yugioh: [
    {
      name: 'Snake-Eye Fire',
      archetype: 'Snake-Eye',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Combo',
      description: 'FIRE attribute combo deck using Snake-Eye monsters for explosive plays.',
      key_cards: ['Snake-Eye Ash', 'Snake-Eye Oak', 'Diabellstar the Black Witch'],
      strategy: 'combo',
    },
    {
      name: 'Tenpai Dragon',
      archetype: 'Tenpai',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Aggro',
      description: 'Aggressive dragon deck focused on direct attacks and synchro summoning.',
      key_cards: ['Tenpai Dragon Chundra', 'Tenpai Dragon Paidra'],
      strategy: 'aggro',
    },
  ],
  lorcana: [
    {
      name: 'Amber/Amethyst Control',
      archetype: 'Control',
      game: 'lorcana',
      format: 'Standard',
      theme: 'Control',
      description: 'Use Amber and Amethyst ink for powerful singing and control effects.',
      key_cards: ['Ariel', 'Elsa', 'Be Our Guest'],
      strategy: 'control',
    },
  ],
  onepiece: [
    {
      name: 'Red Luffy Aggro',
      archetype: 'Red Luffy',
      game: 'onepiece',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Fast Luffy-based deck using Red cards for aggressive attacks.',
      key_cards: ['Monkey D. Luffy', 'Gear 5'],
      strategy: 'aggro',
    },
  ],
};

// GET /api/meta/:game
export async function getMetaDecks(env: Env, game: string): Promise<Response> {
  const decks = META_DECKS[game.toLowerCase()] ?? [];
  return ok({ game, decks });
}

// POST /api/deck/analyze
// Given a user's collection and a meta deck, show have/need analysis
export async function analyzeDeckAgainstCollection(
  env: Env,
  request: Request,
  userId: number,
): Promise<Response> {
  const body = await request.json() as {
    key_cards: string[];
    full_deck?: Array<{ name: string; qty: number; category: string; search: string }>;
    game: string;
    deck_size: number;
  };

  // Get user's collection for this game
  const collection = await queryAll<{
    id: number;
    card_name: string;
    player_name: string;
    card_id: number;
    game: string;
    sport: string;
    set_name: string;
    estimated_value_cents: number;
    front_image_url: string;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
  }>(
    env.DB,
    `SELECT ci.id, ci.card_id, ci.estimated_value_cents,
            ci.front_image_url, ci.bbox_x, ci.bbox_y, ci.bbox_width, ci.bbox_height,
            c.card_name, c.player_name, c.game, c.sport, c.set_name
     FROM collection_items ci
     JOIN cards c ON ci.card_id = c.id
     WHERE ci.user_id = ?`,
    [userId],
  );

  // Use full_deck if provided, otherwise fall back to key_cards
  const cardList = body.full_deck
    ? body.full_deck
    : body.key_cards.map(name => ({ name, qty: 1, category: 'pokemon', search: `${name} pokemon card` }));

  const haveCards: Array<typeof collection[0] & { deck_qty: number; deck_category: string }> = [];
  const needCards: Array<{ name: string; qty: number; category: string; search: string; ebay_url: string; tcgplayer_url: string }> = [];

  for (const deckCard of cardList) {
    const found = collection.find(c => {
      const name = (c.player_name || c.card_name || '').toLowerCase();
      return name.includes(deckCard.name.toLowerCase()) ||
             deckCard.name.toLowerCase().includes(name);
    });

    if (found) {
      haveCards.push({ ...found, deck_qty: deckCard.qty, deck_category: deckCard.category });
    } else {
      needCards.push({
        name: deckCard.name,
        qty: deckCard.qty,
        category: deckCard.category,
        search: deckCard.search,
        ebay_url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(deckCard.search)}`,
        tcgplayer_url: `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(deckCard.name)}`,
      });
    }
  }

  const completionPct = cardList.length > 0
    ? Math.round((haveCards.length / cardList.length) * 100)
    : 0;

  return ok({
    have: haveCards,
    need: needCards,
    completion_pct: completionPct,
    have_count: haveCards.length,
    need_count: needCards.length,
    total_key_cards: cardList.length,
    full_deck: cardList,
  });
}
