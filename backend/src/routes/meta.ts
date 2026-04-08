import type { Env } from '../types';
import { ok } from '../lib/json';
import { queryAll } from '../lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeckCard = {
  name: string;
  qty: number;
  category: string;
  search: string;
  isEvolution?: boolean;
  cmc?: number;
};

type MetaDeck = {
  name: string;
  archetype: string;
  game: string;
  format: string;
  theme: string;
  description: string;
  key_cards: string[];
  strategy: string;
  estimated_budget_usd?: number;
  difficulty?: string;
  commander?: DeckCard | null;
  full_deck?: DeckCard[];
  main_deck?: DeckCard[];
  extra_deck?: DeckCard[];
  side_deck?: DeckCard[];
  sideboard?: DeckCard[];
};

// ── Full META_DECKS Data ───────────────────────────────────────────────────────

const META_DECKS: Record<string, MetaDeck[]> = {

  // ============================================================
  // POKÉMON TCG — 8 DECKS WITH FULL 60-CARD LISTS
  // ============================================================

  pokemon: [

    // DECK 1: Charizard ex / Pidgeot ex — Aggro
    {
      name: 'Charizard ex / Pidgeot ex',
      archetype: 'Charizard ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Aggro',
      description: 'The most consistent deck in Standard. Pidgeot ex searches any card each turn, fueling Charizard ex for 330 damage while healing damage counters.',
      key_cards: ['Charizard ex', 'Pidgeot ex', 'Charmander', 'Rare Candy', 'Arven'],
      strategy: 'aggro',
      estimated_budget_usd: 350,
      difficulty: 'Intermediate',
      full_deck: [
        { name: 'Charmander', qty: 4, category: 'pokemon', search: 'Charmander OBF 026 pokemon card', isEvolution: false },
        { name: 'Charmeleon', qty: 2, category: 'pokemon', search: 'Charmeleon OBF 027 pokemon card', isEvolution: true },
        { name: 'Charizard ex', qty: 3, category: 'pokemon', search: 'Charizard ex OBF 125 pokemon card', isEvolution: true },
        { name: 'Pidgey', qty: 3, category: 'pokemon', search: 'Pidgey OBF 162 pokemon card', isEvolution: false },
        { name: 'Pidgeotto', qty: 1, category: 'pokemon', search: 'Pidgeotto OBF 163 pokemon card', isEvolution: true },
        { name: 'Pidgeot ex', qty: 3, category: 'pokemon', search: 'Pidgeot ex OBF 164 pokemon card', isEvolution: true },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: 'Arven', qty: 4, category: 'trainer', search: 'Arven SVI 166 pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Rare Candy', qty: 4, category: 'trainer', search: 'Rare Candy SVI 191 pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Nest Ball', qty: 3, category: 'trainer', search: 'Nest Ball SVI 181 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Counter Catcher', qty: 2, category: 'trainer', search: 'Counter Catcher PAR 160 pokemon trainer card' },
        { name: 'Earthen Vessel', qty: 2, category: 'trainer', search: 'Earthen Vessel PAR 163 pokemon trainer card' },
        { name: 'Pokégear 3.0', qty: 2, category: 'trainer', search: 'Pokegear 3.0 SVI 186 pokemon trainer card' },
        { name: 'Fire Energy', qty: 11, category: 'energy', search: 'Fire Energy Basic pokemon energy card' },
      ],
    },

    // DECK 2: Gardevoir ex — Control
    {
      name: 'Gardevoir ex',
      archetype: 'Gardevoir ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Control',
      description: 'Psychic Embrace lets you attach Psychic Energy from discard each turn. Gardevoir ex scales its attack with energy attached, while Zacian V provides a reliable attacker.',
      key_cards: ['Gardevoir ex', 'Kirlia', 'Ralts', 'Zacian V', 'Rare Candy'],
      strategy: 'control',
      estimated_budget_usd: 300,
      difficulty: 'Advanced',
      full_deck: [
        { name: 'Ralts', qty: 4, category: 'pokemon', search: 'Ralts SIT 067 pokemon card', isEvolution: false },
        { name: 'Kirlia', qty: 3, category: 'pokemon', search: 'Kirlia SIT 068 pokemon card', isEvolution: true },
        { name: 'Gardevoir ex', qty: 3, category: 'pokemon', search: 'Gardevoir ex SVI 086 pokemon card', isEvolution: true },
        { name: 'Zacian V', qty: 2, category: 'pokemon', search: 'Zacian V CRZ 083 pokemon card', isEvolution: false },
        { name: 'Drifloon', qty: 1, category: 'pokemon', search: 'Drifloon SIT 075 pokemon card', isEvolution: false },
        { name: 'Drifblim', qty: 1, category: 'pokemon', search: 'Drifblim SIT 076 pokemon card', isEvolution: true },
        { name: 'Mew ex', qty: 1, category: 'pokemon', search: 'Mew ex MEW 151 pokemon card', isEvolution: false },
        { name: 'Munkidori', qty: 1, category: 'pokemon', search: 'Munkidori TWM 095 pokemon card', isEvolution: false },
        { name: 'Scream Tail', qty: 1, category: 'pokemon', search: 'Scream Tail PAR 086 pokemon card', isEvolution: false },
        { name: 'Cresselia', qty: 1, category: 'pokemon', search: 'Cresselia CRZ 064 pokemon card', isEvolution: false },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: 'Arven', qty: 3, category: 'trainer', search: 'Arven SVI 166 pokemon trainer card' },
        { name: 'Iono', qty: 3, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Rare Candy', qty: 3, category: 'trainer', search: 'Rare Candy SVI 191 pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Fog Crystal', qty: 3, category: 'trainer', search: 'Fog Crystal CRZ 140 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Counter Catcher', qty: 2, category: 'trainer', search: 'Counter Catcher PAR 160 pokemon trainer card' },
        { name: 'Scoop Up Cyclone', qty: 2, category: 'trainer', search: 'Scoop Up Cyclone PAL 170 pokemon trainer card' },
        { name: 'Psychic Energy', qty: 12, category: 'energy', search: 'Psychic Energy Basic pokemon energy card' },
      ],
    },

    // DECK 3: Miraidon ex — Aggro
    {
      name: 'Miraidon ex',
      archetype: 'Miraidon ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Tandem Unit benches two Basic Lightning Pokémon from deck. Electric Generator accelerates energy. Raichu V and Regieleki VMAX provide secondary attackers.',
      key_cards: ['Miraidon ex', 'Electric Generator', 'Flaaffy', 'Raichu V'],
      strategy: 'aggro',
      estimated_budget_usd: 200,
      difficulty: 'Beginner',
      full_deck: [
        { name: 'Miraidon ex', qty: 4, category: 'pokemon', search: 'Miraidon ex SVI 081 pokemon card', isEvolution: false },
        { name: 'Raichu V', qty: 2, category: 'pokemon', search: 'Raichu V BRS 045 pokemon card', isEvolution: false },
        { name: 'Flaaffy', qty: 2, category: 'pokemon', search: 'Flaaffy EVS 055 pokemon card', isEvolution: true },
        { name: 'Mareep', qty: 1, category: 'pokemon', search: 'Mareep SSH 078 pokemon card', isEvolution: false },
        { name: 'Iron Hands ex', qty: 2, category: 'pokemon', search: 'Iron Hands ex PAR 070 pokemon card', isEvolution: false },
        { name: 'Regieleki VMAX', qty: 1, category: 'pokemon', search: 'Regieleki VMAX EVS 058 pokemon card', isEvolution: true },
        { name: 'Regieleki V', qty: 1, category: 'pokemon', search: 'Regieleki V EVS 057 pokemon card', isEvolution: false },
        { name: 'Hawlucha', qty: 1, category: 'pokemon', search: 'Hawlucha SVI 118 pokemon card', isEvolution: false },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: 'Arven', qty: 4, category: 'trainer', search: 'Arven SVI 166 pokemon trainer card' },
        { name: 'Electric Generator', qty: 4, category: 'trainer', search: 'Electric Generator SVI 170 pokemon trainer card' },
        { name: 'Iono', qty: 3, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Nest Ball', qty: 3, category: 'trainer', search: 'Nest Ball SVI 181 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Path to the Peak', qty: 2, category: 'trainer', search: 'Path to the Peak CRE 148 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Lightning Energy', qty: 14, category: 'energy', search: 'Lightning Energy Basic pokemon energy card' },
      ],
    },

    // DECK 4: Lost Box (Comfey / Sableye) — Control
    {
      name: 'Lost Box (Comfey / Sableye)',
      archetype: 'Lost Zone Control',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Control',
      description: 'Flower Selecting (Comfey) cycles cards into the Lost Zone. At 10 Lost Zone cards: Cramorant attacks for free, Sableye stalls and discards opponent resources.',
      key_cards: ['Comfey', 'Sableye', 'Cramorant', 'Mirage Gate', "Colress's Experiment"],
      strategy: 'control',
      estimated_budget_usd: 250,
      difficulty: 'Expert',
      full_deck: [
        { name: 'Comfey', qty: 4, category: 'pokemon', search: 'Comfey LOR 079 pokemon card', isEvolution: false },
        { name: 'Sableye', qty: 3, category: 'pokemon', search: 'Sableye LOR 070 pokemon card', isEvolution: false },
        { name: 'Cramorant', qty: 2, category: 'pokemon', search: 'Cramorant LOR 050 pokemon card', isEvolution: false },
        { name: 'Radiant Greninja', qty: 1, category: 'pokemon', search: 'Radiant Greninja ASR 046 pokemon card', isEvolution: false },
        { name: 'Manaphy', qty: 1, category: 'pokemon', search: 'Manaphy BRS 041 pokemon card', isEvolution: false },
        { name: 'Dragonite V', qty: 1, category: 'pokemon', search: 'Dragonite V PR-SW 154 pokemon card', isEvolution: false },
        { name: 'Zamazenta', qty: 1, category: 'pokemon', search: 'Zamazenta CRZ 095 pokemon card', isEvolution: false },
        { name: 'Giratina V', qty: 1, category: 'pokemon', search: 'Giratina V LOR 130 pokemon card', isEvolution: false },
        { name: "Colress's Experiment", qty: 4, category: 'trainer', search: "Colress Experiment LOR 155 pokemon trainer card" },
        { name: 'Battle VIP Pass', qty: 4, category: 'trainer', search: 'Battle VIP Pass FST 225 pokemon trainer card' },
        { name: 'Mirage Gate', qty: 4, category: 'trainer', search: 'Mirage Gate LOR 163 pokemon trainer card' },
        { name: 'Escape Rope', qty: 3, category: 'trainer', search: 'Escape Rope BST 125 pokemon trainer card' },
        { name: 'Switch Cart', qty: 3, category: 'trainer', search: 'Switch Cart ASR 154 pokemon trainer card' },
        { name: 'Iono', qty: 3, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Nest Ball', qty: 3, category: 'trainer', search: 'Nest Ball SVI 181 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 3, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Scoop Up Cyclone', qty: 2, category: 'trainer', search: 'Scoop Up Cyclone PAL 170 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Klara', qty: 2, category: 'trainer', search: 'Klara CRE 145 pokemon trainer card' },
        { name: 'Beach Court', qty: 1, category: 'trainer', search: 'Beach Court SVI 167 pokemon trainer card' },
        { name: 'Collapsed Stadium', qty: 1, category: 'trainer', search: 'Collapsed Stadium BRS 137 pokemon trainer card' },
        { name: 'Water Energy', qty: 3, category: 'energy', search: 'Water Energy Basic pokemon energy card' },
        { name: 'Psychic Energy', qty: 2, category: 'energy', search: 'Psychic Energy Basic pokemon energy card' },
        { name: 'Grass Energy', qty: 1, category: 'energy', search: 'Grass Energy Basic pokemon energy card' },
        { name: 'Lightning Energy', qty: 1, category: 'energy', search: 'Lightning Energy Basic pokemon energy card' },
      ],
    },

    // DECK 5: Lugia VSTAR — Combo
    {
      name: 'Lugia VSTAR',
      archetype: 'Lugia VSTAR',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Combo',
      description: 'Summoning Star VSTAR puts 2 Colorless Pokémon from discard directly into play. Archeops provides free Powerful Colorless energy acceleration every turn.',
      key_cards: ['Lugia VSTAR', 'Lugia V', 'Archeops', 'Powerful Colorless Energy'],
      strategy: 'combo',
      estimated_budget_usd: 280,
      difficulty: 'Intermediate',
      full_deck: [
        { name: 'Lugia V', qty: 3, category: 'pokemon', search: 'Lugia V SIT 138 pokemon card', isEvolution: false },
        { name: 'Lugia VSTAR', qty: 3, category: 'pokemon', search: 'Lugia VSTAR SIT 139 pokemon card', isEvolution: true },
        { name: 'Archeops', qty: 4, category: 'pokemon', search: 'Archeops SIT 147 pokemon card', isEvolution: false },
        { name: 'Yveltal', qty: 1, category: 'pokemon', search: 'Yveltal CRZ 096 pokemon card', isEvolution: false },
        { name: 'Lumineon V', qty: 1, category: 'pokemon', search: 'Lumineon V BRS 040 pokemon card', isEvolution: false },
        { name: 'Stoutland V', qty: 1, category: 'pokemon', search: 'Stoutland V SIT 136 pokemon card', isEvolution: false },
        { name: 'Ditto', qty: 1, category: 'pokemon', search: 'Ditto MEW 132 pokemon card', isEvolution: false },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Iono', qty: 3, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Nest Ball', qty: 4, category: 'trainer', search: 'Nest Ball SVI 181 pokemon trainer card' },
        { name: 'Rare Candy', qty: 1, category: 'trainer', search: 'Rare Candy SVI 191 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Counter Catcher', qty: 2, category: 'trainer', search: 'Counter Catcher PAR 160 pokemon trainer card' },
        { name: 'PokéStop', qty: 3, category: 'trainer', search: 'Pokestop PGO 068 pokemon trainer card' },
        { name: 'Collapsed Stadium', qty: 2, category: 'trainer', search: 'Collapsed Stadium BRS 137 pokemon trainer card' },
        { name: 'Temple of Sinnoh', qty: 2, category: 'trainer', search: 'Temple of Sinnoh ASR 155 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Arven', qty: 1, category: 'trainer', search: 'Arven SVI 166 pokemon trainer card' },
        { name: 'Powerful Colorless Energy', qty: 4, category: 'energy', search: 'Powerful Colorless Energy DAA 176 pokemon energy card' },
        { name: 'Double Turbo Energy', qty: 4, category: 'energy', search: 'Double Turbo Energy BRS 151 pokemon energy card' },
        { name: 'Colorless Energy', qty: 4, category: 'energy', search: 'Colorless Energy Basic pokemon energy card' },
      ],
    },

    // DECK 6: Roaring Moon ex — Aggro
    {
      name: 'Roaring Moon ex',
      archetype: 'Roaring Moon ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Frenzied Gouging does 220 damage but discards top 2 prizes. Ancient Booster Energy Capsule turbo charges while Munkidori and Prof\'s Research maintain hand size.',
      key_cards: ['Roaring Moon ex', 'Munkidori', 'Ancient Booster Energy Capsule', 'Sparkling Crystal'],
      strategy: 'aggro',
      estimated_budget_usd: 220,
      difficulty: 'Intermediate',
      full_deck: [
        { name: 'Roaring Moon ex', qty: 4, category: 'pokemon', search: 'Roaring Moon ex PAR 124 pokemon card', isEvolution: false },
        { name: 'Munkidori', qty: 2, category: 'pokemon', search: 'Munkidori TWM 095 pokemon card', isEvolution: false },
        { name: 'Squawkabilly ex', qty: 2, category: 'pokemon', search: 'Squawkabilly ex PAL 169 pokemon card', isEvolution: false },
        { name: 'Iron Bundle', qty: 1, category: 'pokemon', search: 'Iron Bundle PAR 056 pokemon card', isEvolution: false },
        { name: 'Fezandipiti ex', qty: 1, category: 'pokemon', search: 'Fezandipiti ex TWM 092 pokemon card', isEvolution: false },
        { name: 'Bloodmoon Ursaluna ex', qty: 1, category: 'pokemon', search: 'Bloodmoon Ursaluna ex TWM 141 pokemon card', isEvolution: false },
        { name: 'Walking Wake ex', qty: 1, category: 'pokemon', search: 'Walking Wake ex PAR 039 pokemon card', isEvolution: false },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Iono', qty: 4, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: 'Sparkling Crystal', qty: 3, category: 'trainer', search: 'Sparkling Crystal TWM 155 pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Nest Ball', qty: 3, category: 'trainer', search: 'Nest Ball SVI 181 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Canceling Cologne', qty: 2, category: 'trainer', search: 'Canceling Cologne ASR 136 pokemon trainer card' },
        { name: 'Mesagoza', qty: 2, category: 'trainer', search: 'Mesagoza SVI 178 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Basic Darkness Energy', qty: 14, category: 'energy', search: 'Darkness Energy Basic pokemon energy card' },
      ],
    },

    // DECK 7: Terapagos ex — Midrange
    {
      name: 'Terapagos ex',
      archetype: 'Terapagos ex',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Midrange',
      description: 'Stellar Veil protects all your Pokémon. Tera Shell scales damage by number of basic energy. Uses Rainbow Energy and Arceus to accelerate any type of energy.',
      key_cards: ['Terapagos ex', 'Arceus V', 'Arceus VSTAR', 'Rainbow Energy'],
      strategy: 'midrange',
      estimated_budget_usd: 260,
      difficulty: 'Intermediate',
      full_deck: [
        { name: 'Terapagos ex', qty: 4, category: 'pokemon', search: 'Terapagos ex TWM 128 pokemon card', isEvolution: false },
        { name: 'Arceus V', qty: 2, category: 'pokemon', search: 'Arceus V BRS 122 pokemon card', isEvolution: false },
        { name: 'Arceus VSTAR', qty: 2, category: 'pokemon', search: 'Arceus VSTAR BRS 123 pokemon card', isEvolution: true },
        { name: 'Mew ex', qty: 1, category: 'pokemon', search: 'Mew ex MEW 151 pokemon card', isEvolution: false },
        { name: 'Lumineon V', qty: 1, category: 'pokemon', search: 'Lumineon V BRS 040 pokemon card', isEvolution: false },
        { name: 'Dudunsparce', qty: 2, category: 'pokemon', search: 'Dudunsparce TWM 031 pokemon card', isEvolution: true },
        { name: 'Dunsparce', qty: 2, category: 'pokemon', search: 'Dunsparce TWM 030 pokemon card', isEvolution: false },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: 'Arven', qty: 4, category: 'trainer', search: 'Arven SVI 166 pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Iono', qty: 3, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Nest Ball', qty: 2, category: 'trainer', search: 'Nest Ball SVI 181 pokemon trainer card' },
        { name: 'Counter Catcher', qty: 2, category: 'trainer', search: 'Counter Catcher PAR 160 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Collapsed Stadium', qty: 1, category: 'trainer', search: 'Collapsed Stadium BRS 137 pokemon trainer card' },
        { name: 'Escape Rope', qty: 2, category: 'trainer', search: 'Escape Rope BST 125 pokemon trainer card' },
        { name: 'Rainbow Energy', qty: 4, category: 'energy', search: 'Rainbow Energy CES 151 pokemon energy card' },
        { name: 'Basic Grass Energy', qty: 3, category: 'energy', search: 'Grass Energy Basic pokemon energy card' },
        { name: 'Basic Fire Energy', qty: 3, category: 'energy', search: 'Fire Energy Basic pokemon energy card' },
        { name: 'Basic Water Energy', qty: 3, category: 'energy', search: 'Water Energy Basic pokemon energy card' },
        { name: 'Basic Lightning Energy', qty: 3, category: 'energy', search: 'Lightning Energy Basic pokemon energy card' },
      ],
    },

    // DECK 8: Iron Thorns ex / Iron Crown ex — Control
    {
      name: 'Iron Thorns ex / Iron Crown ex',
      archetype: 'Future Control',
      game: 'pokemon',
      format: 'Standard',
      theme: 'Control',
      description: 'Iron Thorns ex prevents opponents from evolving. Iron Crown ex deals spread damage. Future Booster Energy Capsule enables free retreating Future Pokémon.',
      key_cards: ['Iron Thorns ex', 'Iron Crown ex', 'Future Booster Energy Capsule', 'Techno Radar'],
      strategy: 'control',
      estimated_budget_usd: 200,
      difficulty: 'Intermediate',
      full_deck: [
        { name: 'Iron Thorns ex', qty: 3, category: 'pokemon', search: 'Iron Thorns ex PAR 122 pokemon card', isEvolution: false },
        { name: 'Iron Crown ex', qty: 3, category: 'pokemon', search: 'Iron Crown ex TEF 081 pokemon card', isEvolution: false },
        { name: 'Iron Valiant ex', qty: 2, category: 'pokemon', search: 'Iron Valiant ex PAR 089 pokemon card', isEvolution: false },
        { name: 'Iron Hands ex', qty: 2, category: 'pokemon', search: 'Iron Hands ex PAR 070 pokemon card', isEvolution: false },
        { name: 'Iron Bundle', qty: 2, category: 'pokemon', search: 'Iron Bundle PAR 056 pokemon card', isEvolution: false },
        { name: 'Iron Jugulis', qty: 1, category: 'pokemon', search: 'Iron Jugulis PAR 075 pokemon card', isEvolution: false },
        { name: 'Miraidon ex', qty: 2, category: 'pokemon', search: 'Miraidon ex SVI 081 pokemon card', isEvolution: false },
        { name: "Professor's Research", qty: 4, category: 'trainer', search: "Professors Research SVI 189 pokemon trainer card" },
        { name: 'Techno Radar', qty: 4, category: 'trainer', search: 'Techno Radar PAR 180 pokemon trainer card' },
        { name: 'Future Booster Energy Capsule', qty: 4, category: 'trainer', search: 'Future Booster Energy Capsule PAR 164 pokemon trainer card' },
        { name: 'Iono', qty: 4, category: 'trainer', search: 'Iono PAF 080 pokemon trainer card' },
        { name: "Boss's Orders", qty: 2, category: 'trainer', search: "Boss Orders PAL 172 pokemon trainer card" },
        { name: 'Ultra Ball', qty: 4, category: 'trainer', search: 'Ultra Ball SVI 196 pokemon trainer card' },
        { name: 'Escape Rope', qty: 2, category: 'trainer', search: 'Escape Rope BST 125 pokemon trainer card' },
        { name: 'Lost Vacuum', qty: 2, category: 'trainer', search: 'Lost Vacuum CRZ 135 pokemon trainer card' },
        { name: 'Counter Catcher', qty: 2, category: 'trainer', search: 'Counter Catcher PAR 160 pokemon trainer card' },
        { name: 'Super Rod', qty: 2, category: 'trainer', search: 'Super Rod PAL 188 pokemon trainer card' },
        { name: 'Pal Pad', qty: 2, category: 'trainer', search: 'Pal Pad SVI 182 pokemon trainer card' },
        { name: 'Basic Lightning Energy', qty: 9, category: 'energy', search: 'Lightning Energy Basic pokemon energy card' },
        { name: 'Basic Psychic Energy', qty: 4, category: 'energy', search: 'Psychic Energy Basic pokemon energy card' },
      ],
    },

  ],

  // ============================================================
  // MAGIC: THE GATHERING — 7 DECKS WITH FULL LISTS
  // ============================================================

  magic: [

    // MTG DECK 1: Boros Convoke — Aggro (Standard)
    {
      name: 'Boros Convoke',
      archetype: 'Convoke Aggro',
      game: 'magic',
      format: 'Standard',
      theme: 'Aggro',
      description: 'Flood the board with tokens, then Convoke out Gleeful Demolition and Knight-Errant of Eos ahead of schedule for overwhelming board presence.',
      key_cards: ['Knight-Errant of Eos', 'Gleeful Demolition', 'Resolute Reinforcements', "Imodane's Recruiter"],
      strategy: 'aggro',
      estimated_budget_usd: 180,
      difficulty: 'Beginner',
      commander: null,
      full_deck: [
        { name: 'Voldaren Epicure', qty: 4, category: 'creature', cmc: 1, search: 'Voldaren Epicure VOW magic card' },
        { name: 'Thraben Inspector', qty: 4, category: 'creature', cmc: 1, search: 'Thraben Inspector SOI magic card' },
        { name: 'Resolute Reinforcements', qty: 4, category: 'creature', cmc: 2, search: 'Resolute Reinforcements WOE magic card' },
        { name: "Imodane's Recruiter", qty: 4, category: 'creature', cmc: 2, search: 'Imodanes Recruiter WOE magic card' },
        { name: 'Goddric, Cloaked Reveler', qty: 4, category: 'creature', cmc: 3, search: 'Goddric Cloaked Reveler WOE magic card' },
        { name: 'Knight-Errant of Eos', qty: 4, category: 'creature', cmc: 5, search: 'Knight-Errant of Eos MOM magic card' },
        { name: 'Captivating Vampire', qty: 4, category: 'creature', cmc: 3, search: 'Captivating Vampire M11 magic card' },
        { name: 'Gleeful Demolition', qty: 4, category: 'instant', cmc: 1, search: 'Gleeful Demolition WOE magic card' },
        { name: "Warleader's Call", qty: 4, category: 'enchantment', cmc: 2, search: 'Warleaders Call MKM magic card' },
        { name: 'Wedding Announcement', qty: 4, category: 'enchantment', cmc: 3, search: 'Wedding Announcement VOW magic card' },
        { name: 'Sacred Foundry', qty: 4, category: 'land', cmc: 0, search: 'Sacred Foundry GRN magic card' },
        { name: 'Battlefield Forge', qty: 4, category: 'land', cmc: 0, search: 'Battlefield Forge M15 magic card' },
        { name: 'Sundown Pass', qty: 4, category: 'land', cmc: 0, search: 'Sundown Pass VOW magic card' },
        { name: 'Inspiring Vantage', qty: 4, category: 'land', cmc: 0, search: 'Inspiring Vantage KLD magic card' },
        { name: 'Mountain', qty: 4, category: 'land', cmc: 0, search: 'Mountain Basic Land magic card' },
        { name: 'Plains', qty: 4, category: 'land', cmc: 0, search: 'Plains Basic Land magic card' },
      ],
      sideboard: [
        { name: 'Destroy Evil', qty: 3, category: 'instant', cmc: 2, search: 'Destroy Evil SNC magic card' },
        { name: 'Rending Volley', qty: 2, category: 'instant', cmc: 1, search: 'Rending Volley DTK magic card' },
        { name: 'Lithomantic Barrage', qty: 2, category: 'instant', cmc: 1, search: 'Lithomantic Barrage MOM magic card' },
        { name: 'Sunfall', qty: 2, category: 'sorcery', cmc: 5, search: 'Sunfall MOM magic card' },
        { name: 'Temporary Lockdown', qty: 3, category: 'enchantment', cmc: 3, search: 'Temporary Lockdown DMU magic card' },
        { name: 'Elspeth Resplendent', qty: 3, category: 'planeswalker', cmc: 5, search: 'Elspeth Resplendent SNC magic card' },
      ],
    },

    // MTG DECK 2: Azorius Soldiers — Midrange (Standard)
    {
      name: 'Azorius Soldiers',
      archetype: 'Soldiers Midrange',
      game: 'magic',
      format: 'Standard',
      theme: 'Midrange',
      description: 'White/Blue tribal synergy. Harbin triggers flying on all Soldiers when you have 5+. Skystrike Officer generates card advantage. Fortified Beachhead provides incredible consistency.',
      key_cards: ['Harbin, Vanguard Aviator', 'Skystrike Officer', 'Siege Veteran', 'Fortified Beachhead'],
      strategy: 'midrange',
      estimated_budget_usd: 220,
      difficulty: 'Beginner',
      commander: null,
      full_deck: [
        { name: 'Recruitment Officer', qty: 4, category: 'creature', cmc: 1, search: 'Recruitment Officer DMU magic card' },
        { name: 'Harbin, Vanguard Aviator', qty: 4, category: 'creature', cmc: 2, search: 'Harbin Vanguard Aviator DMU magic card' },
        { name: 'Valiant Veteran', qty: 4, category: 'creature', cmc: 2, search: 'Valiant Veteran DMU magic card' },
        { name: 'Siege Veteran', qty: 4, category: 'creature', cmc: 2, search: 'Siege Veteran DMU magic card' },
        { name: 'Skystrike Officer', qty: 4, category: 'creature', cmc: 3, search: 'Skystrike Officer DMU magic card' },
        { name: 'Yotian Frontliner', qty: 4, category: 'creature', cmc: 1, search: 'Yotian Frontliner DMU magic card' },
        { name: 'Zephyr Sentinel', qty: 4, category: 'creature', cmc: 2, search: 'Zephyr Sentinel DMU magic card' },
        { name: 'Resolute Reinforcements', qty: 4, category: 'creature', cmc: 2, search: 'Resolute Reinforcements WOE magic card' },
        { name: "Otharri, Suns' Glory", qty: 4, category: 'creature', cmc: 5, search: 'Otharri Suns Glory MOM magic card' },
        { name: 'Protect the Negotiators', qty: 4, category: 'instant', cmc: 2, search: 'Protect the Negotiators DMU magic card' },
        { name: 'Fortified Beachhead', qty: 4, category: 'land', cmc: 0, search: 'Fortified Beachhead DMU magic card' },
        { name: 'Adarkar Wastes', qty: 4, category: 'land', cmc: 0, search: 'Adarkar Wastes DMU magic card' },
        { name: 'Glacial Fortress', qty: 4, category: 'land', cmc: 0, search: 'Glacial Fortress M13 magic card' },
        { name: 'Hallowed Fountain', qty: 4, category: 'land', cmc: 0, search: 'Hallowed Fountain RNA magic card' },
        { name: 'Plains', qty: 4, category: 'land', cmc: 0, search: 'Plains Basic Land magic card' },
        { name: 'Island', qty: 4, category: 'land', cmc: 0, search: 'Island Basic Land magic card' },
      ],
      sideboard: [
        { name: 'Negate', qty: 4, category: 'instant', cmc: 2, search: 'Negate magic card' },
        { name: 'Farewell', qty: 3, category: 'sorcery', cmc: 6, search: 'Farewell NEO magic card' },
        { name: 'Temporary Lockdown', qty: 4, category: 'enchantment', cmc: 3, search: 'Temporary Lockdown DMU magic card' },
        { name: 'Extraction Specialist', qty: 4, category: 'creature', cmc: 3, search: 'Extraction Specialist SNC magic card' },
      ],
    },

    // MTG DECK 3: Mono-Red Aggro (Standard)
    {
      name: 'Mono-Red Aggro',
      archetype: 'Burn Aggro',
      game: 'magic',
      format: 'Standard',
      theme: 'Aggro',
      description: 'The most consistent aggro deck in Standard. Cheap creatures + reach spells. Monastery Swiftspear and Monstrous Rage enable blisteringly fast goldfishes.',
      key_cards: ['Monastery Swiftspear', 'Heartfire Hero', 'Monstrous Rage', 'Felonious Rage'],
      strategy: 'aggro',
      estimated_budget_usd: 150,
      difficulty: 'Beginner',
      commander: null,
      full_deck: [
        { name: 'Monastery Swiftspear', qty: 4, category: 'creature', cmc: 1, search: 'Monastery Swiftspear KTK magic card' },
        { name: 'Voldaren Epicure', qty: 4, category: 'creature', cmc: 1, search: 'Voldaren Epicure VOW magic card' },
        { name: 'Cacophony Scamp', qty: 4, category: 'creature', cmc: 1, search: 'Cacophony Scamp MKM magic card' },
        { name: 'Heartfire Hero', qty: 4, category: 'creature', cmc: 1, search: 'Heartfire Hero OTJ magic card' },
        { name: 'Slickshot Show-Off', qty: 4, category: 'creature', cmc: 2, search: 'Slickshot Show-Off OTJ magic card' },
        { name: 'Monstrous Rage', qty: 4, category: 'instant', cmc: 1, search: 'Monstrous Rage WOE magic card' },
        { name: 'Felonious Rage', qty: 4, category: 'instant', cmc: 1, search: 'Felonious Rage OTJ magic card' },
        { name: 'Shock', qty: 4, category: 'instant', cmc: 1, search: 'Shock magic card' },
        { name: 'Lightning Strike', qty: 4, category: 'instant', cmc: 2, search: 'Lightning Strike magic card' },
        { name: 'Play with Fire', qty: 4, category: 'instant', cmc: 1, search: 'Play with Fire MID magic card' },
        { name: 'Sunscorched Divide', qty: 4, category: 'land', cmc: 0, search: 'Sunscorched Divide OTJ magic card' },
        { name: 'Sokenzan, Crucible of Defiance', qty: 1, category: 'land', cmc: 0, search: 'Sokenzan Crucible of Defiance NEO magic card' },
        { name: 'Mountain', qty: 15, category: 'land', cmc: 0, search: 'Mountain Basic Land magic card' },
      ],
      sideboard: [
        { name: 'Torch the Tower', qty: 4, category: 'instant', cmc: 1, search: 'Torch the Tower WOE magic card' },
        { name: 'Rending Volley', qty: 3, category: 'instant', cmc: 1, search: 'Rending Volley DTK magic card' },
        { name: 'Obliterating Bolt', qty: 4, category: 'sorcery', cmc: 2, search: 'Obliterating Bolt OTJ magic card' },
        { name: 'Shivan Devastator', qty: 4, category: 'creature', cmc: 1, search: 'Shivan Devastator DMU magic card' },
      ],
    },

    // MTG DECK 4: Esper Midrange (Standard)
    {
      name: 'Esper Midrange',
      archetype: 'Esper Control/Midrange',
      game: 'magic',
      format: 'Standard',
      theme: 'Control',
      description: 'Blue/White/Black powerhouse. Raffine connects to fill your hand. The Wandering Emperor flashes in as a surprise. Sheoldred generates massive life swing.',
      key_cards: ['Raffine, Scheming Seer', 'The Wandering Emperor', 'Sheoldred, the Apocalypse', 'Atraxa, Grand Unifier'],
      strategy: 'control',
      estimated_budget_usd: 550,
      difficulty: 'Advanced',
      commander: null,
      full_deck: [
        { name: 'Raffine, Scheming Seer', qty: 4, category: 'creature', cmc: 3, search: 'Raffine Scheming Seer SNC magic card' },
        { name: 'Sheoldred, the Apocalypse', qty: 4, category: 'creature', cmc: 4, search: 'Sheoldred the Apocalypse DMU magic card' },
        { name: 'Atraxa, Grand Unifier', qty: 3, category: 'creature', cmc: 7, search: 'Atraxa Grand Unifier ONE magic card' },
        { name: 'Skrelv, Defector Mite', qty: 3, category: 'creature', cmc: 1, search: 'Skrelv Defector Mite ONE magic card' },
        { name: 'The Wandering Emperor', qty: 4, category: 'planeswalker', cmc: 4, search: 'The Wandering Emperor NEO magic card' },
        { name: 'Teferi, Temporal Pilgrim', qty: 2, category: 'planeswalker', cmc: 5, search: 'Teferi Temporal Pilgrim BRO magic card' },
        { name: 'Make Disappear', qty: 4, category: 'instant', cmc: 2, search: 'Make Disappear SNC magic card' },
        { name: 'Infernal Grasp', qty: 4, category: 'instant', cmc: 2, search: 'Infernal Grasp MID magic card' },
        { name: 'Cut Down', qty: 4, category: 'instant', cmc: 1, search: 'Cut Down DMU magic card' },
        { name: 'Sunfall', qty: 4, category: 'sorcery', cmc: 5, search: 'Sunfall MOM magic card' },
        { name: "Raffine's Tower", qty: 4, category: 'land', cmc: 0, search: 'Raffines Tower SNC magic card' },
        { name: 'Underground River', qty: 4, category: 'land', cmc: 0, search: 'Underground River DMU magic card' },
        { name: 'Adarkar Wastes', qty: 4, category: 'land', cmc: 0, search: 'Adarkar Wastes DMU magic card' },
        { name: 'Caves of Koilos', qty: 4, category: 'land', cmc: 0, search: 'Caves of Koilos DMU magic card' },
        { name: 'Plains', qty: 4, category: 'land', cmc: 0, search: 'Plains Basic Land magic card' },
        { name: 'Swamp', qty: 4, category: 'land', cmc: 0, search: 'Swamp Basic Land magic card' },
      ],
      sideboard: [
        { name: 'Negate', qty: 4, category: 'instant', cmc: 2, search: 'Negate magic card' },
        { name: 'Go for the Throat', qty: 3, category: 'instant', cmc: 2, search: 'Go for the Throat magic card' },
        { name: 'Farewell', qty: 3, category: 'sorcery', cmc: 6, search: 'Farewell NEO magic card' },
        { name: 'Duress', qty: 3, category: 'sorcery', cmc: 1, search: 'Duress magic card' },
        { name: "Elspeth, Sun's Champion", qty: 2, category: 'planeswalker', cmc: 6, search: 'Elspeth Suns Champion THS magic card' },
      ],
    },

    // MTG DECK 5: Jund Sacrifice (Pioneer)
    {
      name: 'Jund Sacrifice',
      archetype: 'Aristocrats Combo',
      game: 'magic',
      format: 'Pioneer',
      theme: 'Combo',
      description: "Sacrifice Cauldron Familiar repeatedly for infinite Witch's Oven value. Mayhem Devil punishes every sacrifice. Korvold draws cards and grows every sacrifice.",
      key_cards: ["Cauldron Familiar", "Witch's Oven", 'Mayhem Devil', 'Korvold, Fae-Cursed King'],
      strategy: 'combo',
      estimated_budget_usd: 400,
      difficulty: 'Expert',
      commander: null,
      full_deck: [
        { name: 'Cauldron Familiar', qty: 4, category: 'creature', cmc: 1, search: 'Cauldron Familiar ELD magic card' },
        { name: 'Mayhem Devil', qty: 4, category: 'creature', cmc: 3, search: 'Mayhem Devil WAR magic card' },
        { name: 'Korvold, Fae-Cursed King', qty: 4, category: 'creature', cmc: 5, search: 'Korvold Fae-Cursed King ELD magic card' },
        { name: 'Gilded Goose', qty: 4, category: 'creature', cmc: 1, search: 'Gilded Goose ELD magic card' },
        { name: 'Claim the Firstborn', qty: 4, category: 'sorcery', cmc: 1, search: 'Claim the Firstborn ELD magic card' },
        { name: 'Nightmare Shepherd', qty: 4, category: 'creature', cmc: 4, search: 'Nightmare Shepherd THB magic card' },
        { name: 'Woe Strider', qty: 4, category: 'creature', cmc: 3, search: 'Woe Strider THB magic card' },
        { name: "Witch's Oven", qty: 4, category: 'artifact', cmc: 1, search: 'Witchs Oven ELD magic card' },
        { name: 'Thoughtseize', qty: 4, category: 'sorcery', cmc: 1, search: 'Thoughtseize magic card' },
        { name: 'Overgrown Tomb', qty: 4, category: 'land', cmc: 0, search: 'Overgrown Tomb GRN magic card' },
        { name: 'Blood Crypt', qty: 4, category: 'land', cmc: 0, search: 'Blood Crypt RNA magic card' },
        { name: 'Stomping Ground', qty: 4, category: 'land', cmc: 0, search: 'Stomping Ground RNA magic card' },
        { name: 'Golgari Rot Farm', qty: 2, category: 'land', cmc: 0, search: 'Golgari Rot Farm magic card' },
        { name: 'Forest', qty: 4, category: 'land', cmc: 0, search: 'Forest Basic Land magic card' },
        { name: 'Swamp', qty: 4, category: 'land', cmc: 0, search: 'Swamp Basic Land magic card' },
        { name: 'Mountain', qty: 2, category: 'land', cmc: 0, search: 'Mountain Basic Land magic card' },
      ],
      sideboard: [
        { name: 'Leyline of the Void', qty: 4, category: 'enchantment', cmc: 4, search: 'Leyline of the Void magic card' },
        { name: 'Duress', qty: 3, category: 'sorcery', cmc: 1, search: 'Duress magic card' },
        { name: 'Abrupt Decay', qty: 4, category: 'instant', cmc: 2, search: 'Abrupt Decay magic card' },
        { name: 'Scavenging Ooze', qty: 4, category: 'creature', cmc: 2, search: 'Scavenging Ooze magic card' },
      ],
    },

    // MTG DECK 6: Izzet Storm (Modern)
    {
      name: 'Izzet Storm',
      archetype: 'Storm Combo',
      game: 'magic',
      format: 'Modern',
      theme: 'Combo',
      description: 'Cast cheap cantrips and rituals to storm off. Grapeshot or Empty the Warrens finish the game. Gifts Ungiven tutors up the key pieces.',
      key_cards: ['Grapeshot', 'Gifts Ungiven', 'Seething Song', 'Baral, Chief of Compliance'],
      strategy: 'combo',
      estimated_budget_usd: 600,
      difficulty: 'Expert',
      commander: null,
      full_deck: [
        { name: 'Baral, Chief of Compliance', qty: 4, category: 'creature', cmc: 2, search: 'Baral Chief of Compliance AER magic card' },
        { name: 'Goblin Electromancer', qty: 4, category: 'creature', cmc: 2, search: 'Goblin Electromancer GRN magic card' },
        { name: 'Seething Song', qty: 4, category: 'instant', cmc: 3, search: 'Seething Song magic card' },
        { name: 'Pyretic Ritual', qty: 4, category: 'instant', cmc: 2, search: 'Pyretic Ritual M11 magic card' },
        { name: 'Manamorphose', qty: 4, category: 'instant', cmc: 2, search: 'Manamorphose SHM magic card' },
        { name: 'Gifts Ungiven', qty: 4, category: 'instant', cmc: 4, search: 'Gifts Ungiven magic card' },
        { name: 'Grapeshot', qty: 4, category: 'sorcery', cmc: 2, search: 'Grapeshot magic card' },
        { name: 'Empty the Warrens', qty: 2, category: 'sorcery', cmc: 4, search: 'Empty the Warrens TSP magic card' },
        { name: 'Past in Flames', qty: 4, category: 'sorcery', cmc: 4, search: 'Past in Flames ISD magic card' },
        { name: 'Opt', qty: 4, category: 'instant', cmc: 1, search: 'Opt XLN magic card' },
        { name: 'Sleight of Hand', qty: 4, category: 'sorcery', cmc: 1, search: 'Sleight of Hand magic card' },
        { name: 'Desperate Ravings', qty: 2, category: 'instant', cmc: 2, search: 'Desperate Ravings ISD magic card' },
        { name: 'Steam Vents', qty: 4, category: 'land', cmc: 0, search: 'Steam Vents GRN magic card' },
        { name: 'Scalding Tarn', qty: 4, category: 'land', cmc: 0, search: 'Scalding Tarn ZEN magic card' },
        { name: 'Spirebluff Canal', qty: 4, category: 'land', cmc: 0, search: 'Spirebluff Canal KLD magic card' },
        { name: 'Mountain', qty: 4, category: 'land', cmc: 0, search: 'Mountain Basic Land magic card' },
        { name: 'Island', qty: 4, category: 'land', cmc: 0, search: 'Island Basic Land magic card' },
      ],
      sideboard: [
        { name: 'Swan Song', qty: 3, category: 'instant', cmc: 1, search: 'Swan Song THS magic card' },
        { name: 'Pieces of the Puzzle', qty: 2, category: 'sorcery', cmc: 3, search: 'Pieces of the Puzzle SOI magic card' },
        { name: 'Flusterstorm', qty: 3, category: 'instant', cmc: 1, search: 'Flusterstorm magic card' },
        { name: 'Blood Moon', qty: 4, category: 'enchantment', cmc: 3, search: 'Blood Moon magic card' },
        { name: 'Lightning Bolt', qty: 3, category: 'instant', cmc: 1, search: 'Lightning Bolt magic card' },
      ],
    },

    // MTG DECK 7: Atraxa Superfriends Commander
    {
      name: 'Atraxa Superfriends',
      archetype: 'Planeswalker Control',
      game: 'magic',
      format: 'Commander',
      theme: 'Control',
      description: "Atraxa proliferates ALL planeswalkers each turn. Overwhelming number of walkers that generate value every turn. Win with Doubling Season + any planeswalker ultimate.",
      key_cards: ["Atraxa, Praetors' Voice", 'Doubling Season', 'Deepglow Skate', 'The Chain Veil'],
      strategy: 'control',
      estimated_budget_usd: 800,
      difficulty: 'Expert',
      commander: { name: "Atraxa, Praetors' Voice", qty: 1, category: 'creature', cmc: 4, search: 'Atraxa Praetors Voice C16 magic card' },
      full_deck: [
        { name: 'Doubling Season', qty: 1, category: 'enchantment', cmc: 5, search: 'Doubling Season magic card' },
        { name: 'Deepglow Skate', qty: 1, category: 'creature', cmc: 5, search: 'Deepglow Skate C16 magic card' },
        { name: 'The Chain Veil', qty: 1, category: 'artifact', cmc: 4, search: 'The Chain Veil M15 magic card' },
        { name: 'Teferi, Hero of Dominaria', qty: 1, category: 'planeswalker', cmc: 5, search: 'Teferi Hero of Dominaria DOM magic card' },
        { name: 'Ugin, the Spirit Dragon', qty: 1, category: 'planeswalker', cmc: 8, search: 'Ugin the Spirit Dragon FRF magic card' },
        { name: "Elspeth, Sun's Champion", qty: 1, category: 'planeswalker', cmc: 6, search: 'Elspeth Suns Champion THS magic card' },
        { name: 'Garruk, Wildspeaker', qty: 1, category: 'planeswalker', cmc: 4, search: 'Garruk Wildspeaker magic card' },
        { name: 'Liliana Vess', qty: 1, category: 'planeswalker', cmc: 5, search: 'Liliana Vess magic card' },
        { name: 'Tamiyo, Field Researcher', qty: 1, category: 'planeswalker', cmc: 4, search: 'Tamiyo Field Researcher EMN magic card' },
        { name: 'Jace, the Mind Sculptor', qty: 1, category: 'planeswalker', cmc: 4, search: 'Jace the Mind Sculptor WWK magic card' },
        { name: 'Ob Nixilis Reignited', qty: 1, category: 'planeswalker', cmc: 5, search: 'Ob Nixilis Reignited BFZ magic card' },
        { name: 'Nissa, Vital Force', qty: 1, category: 'planeswalker', cmc: 5, search: 'Nissa Vital Force KLD magic card' },
        { name: 'Vivien, Arkbow Ranger', qty: 1, category: 'planeswalker', cmc: 4, search: 'Vivien Arkbow Ranger M20 magic card' },
        { name: 'Dovin, Grand Arbiter', qty: 1, category: 'planeswalker', cmc: 3, search: 'Dovin Grand Arbiter RNA magic card' },
        { name: 'Sol Ring', qty: 1, category: 'artifact', cmc: 1, search: 'Sol Ring magic card' },
        { name: 'Arcane Signet', qty: 1, category: 'artifact', cmc: 2, search: 'Arcane Signet ELD magic card' },
        { name: 'Chromatic Lantern', qty: 1, category: 'artifact', cmc: 3, search: 'Chromatic Lantern GRN magic card' },
        { name: "Kodama's Reach", qty: 1, category: 'sorcery', cmc: 3, search: 'Kodamas Reach magic card' },
        { name: 'Cultivate', qty: 1, category: 'sorcery', cmc: 3, search: 'Cultivate magic card' },
        { name: 'Farseek', qty: 1, category: 'sorcery', cmc: 2, search: 'Farseek magic card' },
        { name: "Nature's Lore", qty: 1, category: 'sorcery', cmc: 2, search: 'Natures Lore magic card' },
        { name: 'Cyclonic Rift', qty: 1, category: 'instant', cmc: 7, search: 'Cyclonic Rift RTR magic card' },
        { name: 'Swords to Plowshares', qty: 1, category: 'instant', cmc: 1, search: 'Swords to Plowshares magic card' },
        { name: 'Path to Exile', qty: 1, category: 'instant', cmc: 1, search: 'Path to Exile magic card' },
        { name: 'Counterspell', qty: 1, category: 'instant', cmc: 2, search: 'Counterspell magic card' },
        { name: "Dovin's Veto", qty: 1, category: 'instant', cmc: 2, search: 'Dovins Veto WAR magic card' },
        { name: 'Swan Song', qty: 1, category: 'instant', cmc: 1, search: 'Swan Song THS magic card' },
        { name: 'Wrath of God', qty: 1, category: 'sorcery', cmc: 4, search: 'Wrath of God magic card' },
        { name: 'Supreme Verdict', qty: 1, category: 'sorcery', cmc: 4, search: 'Supreme Verdict RTR magic card' },
        { name: 'Command Tower', qty: 1, category: 'land', cmc: 0, search: 'Command Tower magic card' },
        { name: 'Breeding Pool', qty: 1, category: 'land', cmc: 0, search: 'Breeding Pool RNA magic card' },
        { name: 'Hallowed Fountain', qty: 1, category: 'land', cmc: 0, search: 'Hallowed Fountain RNA magic card' },
        { name: 'Godless Shrine', qty: 1, category: 'land', cmc: 0, search: 'Godless Shrine RNA magic card' },
        { name: 'Watery Grave', qty: 1, category: 'land', cmc: 0, search: 'Watery Grave GRN magic card' },
        { name: 'Overgrown Tomb', qty: 1, category: 'land', cmc: 0, search: 'Overgrown Tomb GRN magic card' },
        { name: 'Temple Garden', qty: 1, category: 'land', cmc: 0, search: 'Temple Garden GRN magic card' },
        { name: 'Misty Rainforest', qty: 1, category: 'land', cmc: 0, search: 'Misty Rainforest ZEN magic card' },
        { name: 'Verdant Catacombs', qty: 1, category: 'land', cmc: 0, search: 'Verdant Catacombs ZEN magic card' },
        { name: 'Polluted Delta', qty: 1, category: 'land', cmc: 0, search: 'Polluted Delta KTK magic card' },
        { name: 'Flooded Strand', qty: 1, category: 'land', cmc: 0, search: 'Flooded Strand KTK magic card' },
        { name: 'Windswept Heath', qty: 1, category: 'land', cmc: 0, search: 'Windswept Heath KTK magic card' },
        { name: 'Forest', qty: 6, category: 'land', cmc: 0, search: 'Forest Basic Land magic card' },
        { name: 'Plains', qty: 6, category: 'land', cmc: 0, search: 'Plains Basic Land magic card' },
        { name: 'Island', qty: 6, category: 'land', cmc: 0, search: 'Island Basic Land magic card' },
        { name: 'Swamp', qty: 6, category: 'land', cmc: 0, search: 'Swamp Basic Land magic card' },
      ],
    },

  ],

  // ============================================================
  // YU-GI-OH! — 6 DECKS WITH FULL MAIN/EXTRA/SIDE STRUCTURE
  // ============================================================

  yugioh: [

    // YGO DECK 1: Snake-Eye Fire King — Combo
    {
      name: 'Snake-Eye Fire King',
      archetype: 'Snake-Eye',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Combo',
      description: 'Tier 1 combo deck. Snake-Eye Ash searches and special summons monsters from the Spell/Trap Zone. Fire King support adds recycling and board extension.',
      key_cards: ['Snake-Eye Ash', 'Snake-Eye Oak', 'Fire King Island', 'Diabellstar'],
      strategy: 'combo',
      estimated_budget_usd: 500,
      difficulty: 'Expert',
      main_deck: [
        { name: 'Snake-Eye Ash', qty: 3, category: 'monster', search: 'Snake-Eye Ash yugioh card' },
        { name: 'Snake-Eye Oak', qty: 3, category: 'monster', search: 'Snake-Eye Oak yugioh card' },
        { name: 'Diabellstar the Black Witch', qty: 3, category: 'monster', search: 'Diabellstar the Black Witch yugioh card' },
        { name: 'Fire King Avatar Arvata', qty: 1, category: 'monster', search: 'Fire King Avatar Arvata yugioh card' },
        { name: 'Fire King High Avatar Garunix', qty: 1, category: 'monster', search: 'Fire King High Avatar Garunix yugioh card' },
        { name: 'Poplar', qty: 1, category: 'monster', search: 'Poplar Snake-Eye yugioh card' },
        { name: 'Ash Blossom & Joyous Spring', qty: 3, category: 'monster', search: 'Ash Blossom Joyous Spring yugioh card' },
        { name: 'Nibiru, the Primal Being', qty: 3, category: 'monster', search: 'Nibiru the Primal Being yugioh card' },
        { name: 'Effect Veiler', qty: 2, category: 'monster', search: 'Effect Veiler yugioh card' },
        { name: 'Droll & Lock Bird', qty: 3, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Original Sinful Spoils - Snake-Eye', qty: 3, category: 'spell', search: 'Original Sinful Spoils Snake-Eye yugioh card' },
        { name: 'Fire King Island', qty: 3, category: 'spell', search: 'Fire King Island yugioh card' },
        { name: 'Bonfire', qty: 3, category: 'spell', search: 'Bonfire yugioh card' },
        { name: 'Called by the Grave', qty: 2, category: 'spell', search: 'Called by the Grave yugioh card' },
        { name: 'Foolish Burial', qty: 1, category: 'spell', search: 'Foolish Burial yugioh card' },
        { name: 'Monster Reborn', qty: 1, category: 'spell', search: 'Monster Reborn yugioh card' },
        { name: 'Triple Tactics Talent', qty: 2, category: 'spell', search: 'Triple Tactics Talent yugioh card' },
        { name: 'Infinite Impermanence', qty: 3, category: 'trap', search: 'Infinite Impermanence yugioh card' },
        { name: 'Torrential Tribute', qty: 1, category: 'trap', search: 'Torrential Tribute yugioh card' },
      ],
      extra_deck: [
        { name: 'Linkuriboh', qty: 1, category: 'extra', search: 'Linkuriboh yugioh card' },
        { name: 'I:P Masquerena', qty: 1, category: 'extra', search: 'IP Masquerena yugioh card' },
        { name: 'Snake-Eye Doomed Dragon', qty: 1, category: 'extra', search: 'Snake-Eye Doomed Dragon yugioh card' },
        { name: 'Baronne de Fleur', qty: 1, category: 'extra', search: 'Baronne de Fleur yugioh card' },
        { name: 'Apollousa, Bow of the Goddess', qty: 1, category: 'extra', search: 'Apollousa Bow of the Goddess yugioh card' },
        { name: 'S:P Little Knight', qty: 1, category: 'extra', search: 'SP Little Knight yugioh card' },
        { name: 'Promethean Princess, Bestower of Flames', qty: 1, category: 'extra', search: 'Promethean Princess Bestower of Flames yugioh card' },
        { name: 'Hiita the Fire Charmer, Ablaze', qty: 1, category: 'extra', search: 'Hiita the Fire Charmer Ablaze yugioh card' },
        { name: 'Fire King High Avatar Kirin', qty: 1, category: 'extra', search: 'Fire King High Avatar Kirin yugioh card' },
        { name: 'Curious, the Lightsworn Dominion', qty: 1, category: 'extra', search: 'Curious the Lightsworn Dominion yugioh card' },
        { name: 'Accesscode Talker', qty: 1, category: 'extra', search: 'Accesscode Talker yugioh card' },
        { name: 'Topologic Zeroboros', qty: 1, category: 'extra', search: 'Topologic Zeroboros yugioh card' },
        { name: 'Striker Dragon', qty: 1, category: 'extra', search: 'Striker Dragon yugioh card' },
        { name: 'Knightmare Phoenix', qty: 1, category: 'extra', search: 'Knightmare Phoenix yugioh card' },
        { name: 'Knightmare Unicorn', qty: 1, category: 'extra', search: 'Knightmare Unicorn yugioh card' },
      ],
      side_deck: [
        { name: 'Dimension Shifter', qty: 3, category: 'monster', search: 'Dimension Shifter yugioh card' },
        { name: 'Droll & Lock Bird', qty: 2, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Forbidden Droplet', qty: 3, category: 'spell', search: 'Forbidden Droplet yugioh card' },
        { name: 'Cosmic Cyclone', qty: 3, category: 'spell', search: 'Cosmic Cyclone yugioh card' },
        { name: 'Evenly Matched', qty: 2, category: 'trap', search: 'Evenly Matched yugioh card' },
        { name: 'Solemn Judgment', qty: 2, category: 'trap', search: 'Solemn Judgment yugioh card' },
      ],
    },

    // YGO DECK 2: Purrely — Combo/Grind
    {
      name: 'Purrely',
      archetype: 'Purrely',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Combo',
      description: 'Attach Quick Effect Spells to Purrely monsters as Xyz materials. My Friend Purrely searches the core pieces. Exciton Knight wipes the board on demand.',
      key_cards: ['Purrely', 'My Friend Purrely', 'Epurrely Beauty', 'Purrelyly'],
      strategy: 'combo',
      estimated_budget_usd: 350,
      difficulty: 'Advanced',
      main_deck: [
        { name: 'Purrely', qty: 3, category: 'monster', search: 'Purrely yugioh card' },
        { name: 'Ash Blossom & Joyous Spring', qty: 3, category: 'monster', search: 'Ash Blossom Joyous Spring yugioh card' },
        { name: 'Effect Veiler', qty: 3, category: 'monster', search: 'Effect Veiler yugioh card' },
        { name: 'Nibiru, the Primal Being', qty: 1, category: 'monster', search: 'Nibiru the Primal Being yugioh card' },
        { name: 'Droll & Lock Bird', qty: 3, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Ghost Belle & Haunted Mansion', qty: 2, category: 'monster', search: 'Ghost Belle Haunted Mansion yugioh card' },
        { name: 'My Friend Purrely', qty: 3, category: 'spell', search: 'My Friend Purrely yugioh card' },
        { name: 'Purrely Sleepy Memory', qty: 3, category: 'spell', search: 'Purrely Sleepy Memory yugioh card' },
        { name: 'Purrely Happy Memory', qty: 3, category: 'spell', search: 'Purrely Happy Memory yugioh card' },
        { name: 'Purrely Delicious Memory', qty: 3, category: 'spell', search: 'Purrely Delicious Memory yugioh card' },
        { name: 'Purrely Pretty Memory', qty: 2, category: 'spell', search: 'Purrely Pretty Memory yugioh card' },
        { name: 'Called by the Grave', qty: 2, category: 'spell', search: 'Called by the Grave yugioh card' },
        { name: 'Infinite Impermanence', qty: 3, category: 'trap', search: 'Infinite Impermanence yugioh card' },
        { name: 'Evenly Matched', qty: 3, category: 'trap', search: 'Evenly Matched yugioh card' },
        { name: 'Purrely Sharely!?', qty: 3, category: 'trap', search: 'Purrely Sharely yugioh card' },
      ],
      extra_deck: [
        { name: 'Purrelyly', qty: 3, category: 'extra', search: 'Purrelyly yugioh card' },
        { name: 'Epurrely Beauty', qty: 3, category: 'extra', search: 'Epurrely Beauty yugioh card' },
        { name: 'Epurrely Plump', qty: 2, category: 'extra', search: 'Epurrely Plump yugioh card' },
        { name: 'Epurrely Happiness', qty: 2, category: 'extra', search: 'Epurrely Happiness yugioh card' },
        { name: 'Number 60: Dugares the Timeless', qty: 1, category: 'extra', search: 'Number 60 Dugares the Timeless yugioh card' },
        { name: 'Divine Arsenal AA-ZEUS - Sky Thunder', qty: 1, category: 'extra', search: 'Divine Arsenal AA-ZEUS Sky Thunder yugioh card' },
        { name: 'S:P Little Knight', qty: 1, category: 'extra', search: 'SP Little Knight yugioh card' },
        { name: 'I:P Masquerena', qty: 1, category: 'extra', search: 'IP Masquerena yugioh card' },
        { name: 'Accesscode Talker', qty: 1, category: 'extra', search: 'Accesscode Talker yugioh card' },
      ],
      side_deck: [
        { name: 'Dimension Shifter', qty: 3, category: 'monster', search: 'Dimension Shifter yugioh card' },
        { name: 'Forbidden Droplet', qty: 3, category: 'spell', search: 'Forbidden Droplet yugioh card' },
        { name: 'Cosmic Cyclone', qty: 3, category: 'spell', search: 'Cosmic Cyclone yugioh card' },
        { name: 'Anti-Spell Fragrance', qty: 3, category: 'trap', search: 'Anti-Spell Fragrance yugioh card' },
        { name: 'Solemn Judgment', qty: 3, category: 'trap', search: 'Solemn Judgment yugioh card' },
      ],
    },

    // YGO DECK 3: Labrynth — Trap Control
    {
      name: 'Labrynth',
      archetype: 'Labrynth',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Control',
      description: 'Normal Spell/Trap-heavy control deck. Lady Labrynth of the Silver Castle triggers whenever a normal trap destroys a card. Big Welcome Labrynth recurses your boss monsters.',
      key_cards: ['Lady Labrynth of the Silver Castle', 'Labrynth Chandraglier', 'Big Welcome Labrynth', 'Arianna the Labrynth Servant'],
      strategy: 'control',
      estimated_budget_usd: 300,
      difficulty: 'Intermediate',
      main_deck: [
        { name: 'Lady Labrynth of the Silver Castle', qty: 2, category: 'monster', search: 'Lady Labrynth of the Silver Castle yugioh card' },
        { name: 'Labrynth Chandraglier', qty: 3, category: 'monster', search: 'Labrynth Chandraglier yugioh card' },
        { name: 'Arianna the Labrynth Servant', qty: 3, category: 'monster', search: 'Arianna the Labrynth Servant yugioh card' },
        { name: 'Ariane the Labrynth Servant', qty: 1, category: 'monster', search: 'Ariane the Labrynth Servant yugioh card' },
        { name: 'Ash Blossom & Joyous Spring', qty: 3, category: 'monster', search: 'Ash Blossom Joyous Spring yugioh card' },
        { name: 'Ghost Belle & Haunted Mansion', qty: 3, category: 'monster', search: 'Ghost Belle Haunted Mansion yugioh card' },
        { name: 'Lovely Labrynth of the Silver Castle', qty: 3, category: 'spell', search: 'Lovely Labrynth of the Silver Castle yugioh card' },
        { name: 'Welcome Labrynth', qty: 3, category: 'trap', search: 'Welcome Labrynth yugioh card' },
        { name: 'Big Welcome Labrynth', qty: 3, category: 'trap', search: 'Big Welcome Labrynth yugioh card' },
        { name: 'Infinite Impermanence', qty: 3, category: 'trap', search: 'Infinite Impermanence yugioh card' },
        { name: 'Compulsory Evacuation Device', qty: 2, category: 'trap', search: 'Compulsory Evacuation Device yugioh card' },
        { name: 'Evenly Matched', qty: 3, category: 'trap', search: 'Evenly Matched yugioh card' },
        { name: 'Solemn Judgment', qty: 3, category: 'trap', search: 'Solemn Judgment yugioh card' },
        { name: 'Skill Drain', qty: 2, category: 'trap', search: 'Skill Drain yugioh card' },
        { name: "Ice Dragon's Prison", qty: 3, category: 'trap', search: 'Ice Dragons Prison yugioh card' },
      ],
      extra_deck: [
        { name: 'Labrynth Archfiend', qty: 1, category: 'extra', search: 'Labrynth Archfiend yugioh card' },
        { name: 'Knightmare Phoenix', qty: 2, category: 'extra', search: 'Knightmare Phoenix yugioh card' },
        { name: 'Knightmare Unicorn', qty: 1, category: 'extra', search: 'Knightmare Unicorn yugioh card' },
        { name: 'I:P Masquerena', qty: 1, category: 'extra', search: 'IP Masquerena yugioh card' },
        { name: 'S:P Little Knight', qty: 1, category: 'extra', search: 'SP Little Knight yugioh card' },
        { name: 'Accesscode Talker', qty: 1, category: 'extra', search: 'Accesscode Talker yugioh card' },
        { name: 'Dharc the Dark Charmer, Gloomy', qty: 1, category: 'extra', search: 'Dharc the Dark Charmer Gloomy yugioh card' },
        { name: 'Mechaba the Celestial Paladin', qty: 1, category: 'extra', search: 'Mechaba the Celestial Paladin yugioh card' },
      ],
      side_deck: [
        { name: 'Droll & Lock Bird', qty: 3, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Nibiru, the Primal Being', qty: 3, category: 'monster', search: 'Nibiru the Primal Being yugioh card' },
        { name: 'Forbidden Droplet', qty: 3, category: 'spell', search: 'Forbidden Droplet yugioh card' },
        { name: 'Anti-Spell Fragrance', qty: 3, category: 'trap', search: 'Anti-Spell Fragrance yugioh card' },
        { name: 'There Can Be Only One', qty: 3, category: 'trap', search: 'There Can Be Only One yugioh card' },
      ],
    },

    // YGO DECK 4: Branded Despia — Grind/Combo
    {
      name: 'Branded Despia',
      archetype: 'Branded Fusion',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Combo',
      description: "Albaz fusions on both turns. Mirrorjade locks down the opponent's board. Aluber and Dramaturge provide consistent search. Incredible grind game through Branded in Red.",
      key_cards: ['Aluber the Jester of Despia', 'Albion the Shrouded Dragon', 'Mirrorjade the Iceblade Dragon', 'Branded Fusion'],
      strategy: 'midrange',
      estimated_budget_usd: 450,
      difficulty: 'Advanced',
      main_deck: [
        { name: 'Aluber the Jester of Despia', qty: 3, category: 'monster', search: 'Aluber the Jester of Despia yugioh card' },
        { name: 'Albion the Shrouded Dragon', qty: 1, category: 'monster', search: 'Albion the Shrouded Dragon yugioh card' },
        { name: 'Dramaturge of Despia', qty: 1, category: 'monster', search: 'Dramaturge of Despia yugioh card' },
        { name: 'Fallen of Albaz', qty: 1, category: 'monster', search: 'Fallen of Albaz yugioh card' },
        { name: 'Ad Libitum of Despia', qty: 1, category: 'monster', search: 'Ad Libitum of Despia yugioh card' },
        { name: 'Ash Blossom & Joyous Spring', qty: 3, category: 'monster', search: 'Ash Blossom Joyous Spring yugioh card' },
        { name: 'Effect Veiler', qty: 2, category: 'monster', search: 'Effect Veiler yugioh card' },
        { name: 'Nibiru, the Primal Being', qty: 3, category: 'monster', search: 'Nibiru the Primal Being yugioh card' },
        { name: 'Branded Fusion', qty: 3, category: 'spell', search: 'Branded Fusion yugioh card' },
        { name: 'Branded in Red', qty: 3, category: 'spell', search: 'Branded in Red yugioh card' },
        { name: 'Branded in White', qty: 1, category: 'spell', search: 'Branded in White yugioh card' },
        { name: 'Branded Opening', qty: 2, category: 'spell', search: 'Branded Opening yugioh card' },
        { name: 'Polymerization', qty: 1, category: 'spell', search: 'Polymerization yugioh card' },
        { name: 'Called by the Grave', qty: 2, category: 'spell', search: 'Called by the Grave yugioh card' },
        { name: 'Infinite Impermanence', qty: 3, category: 'trap', search: 'Infinite Impermanence yugioh card' },
        { name: 'Branded Lost', qty: 3, category: 'trap', search: 'Branded Lost yugioh card' },
        { name: 'Branded Retribution', qty: 2, category: 'trap', search: 'Branded Retribution yugioh card' },
      ],
      extra_deck: [
        { name: 'Mirrorjade the Iceblade Dragon', qty: 3, category: 'extra', search: 'Mirrorjade the Iceblade Dragon yugioh card' },
        { name: 'Albion the Branded Dragon', qty: 1, category: 'extra', search: 'Albion the Branded Dragon yugioh card' },
        { name: 'Albion the Sanctifire Dragon', qty: 1, category: 'extra', search: 'Albion the Sanctifire Dragon yugioh card' },
        { name: 'Granguignol the Dusk Dragon', qty: 1, category: 'extra', search: 'Granguignol the Dusk Dragon yugioh card' },
        { name: 'Lubellion the Searing Dragon', qty: 1, category: 'extra', search: 'Lubellion the Searing Dragon yugioh card' },
        { name: 'Titaniklad the Ash Dragon', qty: 1, category: 'extra', search: 'Titaniklad the Ash Dragon yugioh card' },
        { name: 'Guardian Chimera', qty: 1, category: 'extra', search: 'Guardian Chimera yugioh card' },
        { name: 'Despian Quaeritis', qty: 1, category: 'extra', search: 'Despian Quaeritis yugioh card' },
        { name: 'El Shaddoll Apkallone', qty: 1, category: 'extra', search: 'El Shaddoll Apkallone yugioh card' },
        { name: 'I:P Masquerena', qty: 1, category: 'extra', search: 'IP Masquerena yugioh card' },
        { name: 'S:P Little Knight', qty: 1, category: 'extra', search: 'SP Little Knight yugioh card' },
        { name: 'Predaplant Dragostapelia', qty: 1, category: 'extra', search: 'Predaplant Dragostapelia yugioh card' },
        { name: 'Mudragon of the Swamp', qty: 1, category: 'extra', search: 'Mudragon of the Swamp yugioh card' },
      ],
      side_deck: [
        { name: 'Droll & Lock Bird', qty: 3, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Dimension Shifter', qty: 3, category: 'monster', search: 'Dimension Shifter yugioh card' },
        { name: 'Forbidden Droplet', qty: 3, category: 'spell', search: 'Forbidden Droplet yugioh card' },
        { name: 'Cosmic Cyclone', qty: 3, category: 'spell', search: 'Cosmic Cyclone yugioh card' },
        { name: 'Evenly Matched', qty: 3, category: 'trap', search: 'Evenly Matched yugioh card' },
      ],
    },

    // YGO DECK 5: Kashtira — Aggressive Resource Lock
    {
      name: 'Kashtira',
      archetype: 'Kashtira',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Control',
      description: "Banish opponent's cards face-down to lock zones. Shangri-Ira takes control of monster zones. Fenrir searches the whole archetype and is the most consistent starter.",
      key_cards: ['Kashtira Fenrir', 'Kashtira Arise-Heart', 'Kashtira Shangri-Ira', 'Kashtira Unicorn'],
      strategy: 'control',
      estimated_budget_usd: 400,
      difficulty: 'Intermediate',
      main_deck: [
        { name: 'Kashtira Fenrir', qty: 3, category: 'monster', search: 'Kashtira Fenrir yugioh card' },
        { name: 'Kashtira Unicorn', qty: 3, category: 'monster', search: 'Kashtira Unicorn yugioh card' },
        { name: 'Kashtira Riseheart', qty: 3, category: 'monster', search: 'Kashtira Riseheart yugioh card' },
        { name: 'Kashtira Ogre', qty: 1, category: 'monster', search: 'Kashtira Ogre yugioh card' },
        { name: 'Ash Blossom & Joyous Spring', qty: 3, category: 'monster', search: 'Ash Blossom Joyous Spring yugioh card' },
        { name: 'Dimension Shifter', qty: 3, category: 'monster', search: 'Dimension Shifter yugioh card' },
        { name: 'Droll & Lock Bird', qty: 3, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Kashtiratheosis', qty: 3, category: 'spell', search: 'Kashtiratheosis yugioh card' },
        { name: 'Pressured Planet Wraitsoth', qty: 3, category: 'spell', search: 'Pressured Planet Wraitsoth yugioh card' },
        { name: 'Scareclaw Kastela', qty: 1, category: 'spell', search: 'Scareclaw Kastela yugioh card' },
        { name: 'Called by the Grave', qty: 2, category: 'spell', search: 'Called by the Grave yugioh card' },
        { name: 'Triple Tactics Talent', qty: 2, category: 'spell', search: 'Triple Tactics Talent yugioh card' },
        { name: 'Infinite Impermanence', qty: 3, category: 'trap', search: 'Infinite Impermanence yugioh card' },
        { name: 'Evenly Matched', qty: 3, category: 'trap', search: 'Evenly Matched yugioh card' },
        { name: 'Kashtira Birth', qty: 2, category: 'trap', search: 'Kashtira Birth yugioh card' },
        { name: 'Kashtira Akstra', qty: 1, category: 'trap', search: 'Kashtira Akstra yugioh card' },
      ],
      extra_deck: [
        { name: 'Kashtira Shangri-Ira', qty: 3, category: 'extra', search: 'Kashtira Shangri-Ira yugioh card' },
        { name: 'Kashtira Arise-Heart', qty: 3, category: 'extra', search: 'Kashtira Arise-Heart yugioh card' },
        { name: 'Number 89: Diablosis the Mind Hacker', qty: 1, category: 'extra', search: 'Number 89 Diablosis the Mind Hacker yugioh card' },
        { name: 'Dingirsu, the Orcust of the Evening Star', qty: 1, category: 'extra', search: 'Dingirsu the Orcust of the Evening Star yugioh card' },
        { name: 'Divine Arsenal AA-ZEUS - Sky Thunder', qty: 1, category: 'extra', search: 'Divine Arsenal AA-ZEUS Sky Thunder yugioh card' },
        { name: 'S:P Little Knight', qty: 1, category: 'extra', search: 'SP Little Knight yugioh card' },
        { name: 'I:P Masquerena', qty: 1, category: 'extra', search: 'IP Masquerena yugioh card' },
        { name: 'Knightmare Phoenix', qty: 1, category: 'extra', search: 'Knightmare Phoenix yugioh card' },
        { name: 'Knightmare Unicorn', qty: 1, category: 'extra', search: 'Knightmare Unicorn yugioh card' },
        { name: 'Accesscode Talker', qty: 1, category: 'extra', search: 'Accesscode Talker yugioh card' },
        { name: 'Topologic Zeroboros', qty: 1, category: 'extra', search: 'Topologic Zeroboros yugioh card' },
      ],
      side_deck: [
        { name: 'Nibiru, the Primal Being', qty: 3, category: 'monster', search: 'Nibiru the Primal Being yugioh card' },
        { name: 'Ghost Mourner & Moonlit Chill', qty: 3, category: 'monster', search: 'Ghost Mourner Moonlit Chill yugioh card' },
        { name: 'Forbidden Droplet', qty: 3, category: 'spell', search: 'Forbidden Droplet yugioh card' },
        { name: 'Cosmic Cyclone', qty: 3, category: 'spell', search: 'Cosmic Cyclone yugioh card' },
        { name: 'Anti-Spell Fragrance', qty: 3, category: 'trap', search: 'Anti-Spell Fragrance yugioh card' },
      ],
    },

    // YGO DECK 6: Tearlaments — Graveyard Combo
    {
      name: 'Tearlaments',
      archetype: 'Tearlaments Fusion',
      game: 'yugioh',
      format: 'Advanced',
      theme: 'Combo',
      description: 'Mill cards to trigger Tearlaments Quick Effects and Fusion Summon directly from GY. Consistently makes Kitkallos and Rulkallos. Scheiren is the best starter.',
      key_cards: ['Tearlaments Scheiren', 'Tearlaments Kitkallos', 'Tearlaments Reinoheart', 'Ishizu Fairy'],
      strategy: 'combo',
      estimated_budget_usd: 550,
      difficulty: 'Expert',
      main_deck: [
        { name: 'Tearlaments Scheiren', qty: 3, category: 'monster', search: 'Tearlaments Scheiren yugioh card' },
        { name: 'Tearlaments Reinoheart', qty: 3, category: 'monster', search: 'Tearlaments Reinoheart yugioh card' },
        { name: 'Tearlaments Merrli', qty: 2, category: 'monster', search: 'Tearlaments Merrli yugioh card' },
        { name: 'Tearlaments Havnis', qty: 2, category: 'monster', search: 'Tearlaments Havnis yugioh card' },
        { name: 'Keldo the Sacred Protector', qty: 3, category: 'monster', search: 'Keldo the Sacred Protector yugioh card' },
        { name: 'Agido the Ancient Sentinel', qty: 3, category: 'monster', search: 'Agido the Ancient Sentinel yugioh card' },
        { name: 'Ash Blossom & Joyous Spring', qty: 2, category: 'monster', search: 'Ash Blossom Joyous Spring yugioh card' },
        { name: 'Mudora the Sword Oracle', qty: 3, category: 'monster', search: 'Mudora the Sword Oracle yugioh card' },
        { name: 'Kelbek the Ancient Vanguard', qty: 3, category: 'monster', search: 'Kelbek the Ancient Vanguard yugioh card' },
        { name: 'Primeval Planet Perlereino', qty: 3, category: 'spell', search: 'Primeval Planet Perlereino yugioh card' },
        { name: 'Foolish Burial', qty: 1, category: 'spell', search: 'Foolish Burial yugioh card' },
        { name: 'Foolish Burial Goods', qty: 1, category: 'spell', search: 'Foolish Burial Goods yugioh card' },
        { name: 'Called by the Grave', qty: 2, category: 'spell', search: 'Called by the Grave yugioh card' },
        { name: 'Infinite Impermanence', qty: 3, category: 'trap', search: 'Infinite Impermanence yugioh card' },
        { name: 'Tearlaments Cryme', qty: 2, category: 'trap', search: 'Tearlaments Cryme yugioh card' },
        { name: 'Tearlaments Sulliek', qty: 3, category: 'trap', search: 'Tearlaments Sulliek yugioh card' },
      ],
      extra_deck: [
        { name: 'Tearlaments Kitkallos', qty: 3, category: 'extra', search: 'Tearlaments Kitkallos yugioh card' },
        { name: 'Tearlaments Rulkallos', qty: 2, category: 'extra', search: 'Tearlaments Rulkallos yugioh card' },
        { name: 'Tearlaments Kaleido-Heart', qty: 2, category: 'extra', search: 'Tearlaments Kaleido-Heart yugioh card' },
        { name: 'Mudragon of the Swamp', qty: 1, category: 'extra', search: 'Mudragon of the Swamp yugioh card' },
        { name: 'El Shaddoll Apkallone', qty: 1, category: 'extra', search: 'El Shaddoll Apkallone yugioh card' },
        { name: 'El Shaddoll Winda', qty: 1, category: 'extra', search: 'El Shaddoll Winda yugioh card' },
        { name: 'Predaplant Dragostapelia', qty: 1, category: 'extra', search: 'Predaplant Dragostapelia yugioh card' },
        { name: 'Grapha, Dragon Overlord of Dark World', qty: 1, category: 'extra', search: 'Grapha Dragon Overlord of Dark World yugioh card' },
        { name: 'I:P Masquerena', qty: 1, category: 'extra', search: 'IP Masquerena yugioh card' },
        { name: 'S:P Little Knight', qty: 1, category: 'extra', search: 'SP Little Knight yugioh card' },
        { name: 'Spright Sprind', qty: 1, category: 'extra', search: 'Spright Sprind yugioh card' },
      ],
      side_deck: [
        { name: 'Droll & Lock Bird', qty: 3, category: 'monster', search: 'Droll Lock Bird yugioh card' },
        { name: 'Dimension Shifter', qty: 3, category: 'monster', search: 'Dimension Shifter yugioh card' },
        { name: 'Forbidden Droplet', qty: 3, category: 'spell', search: 'Forbidden Droplet yugioh card' },
        { name: 'Mystical Space Typhoon', qty: 3, category: 'spell', search: 'Mystical Space Typhoon yugioh card' },
        { name: 'Evenly Matched', qty: 3, category: 'trap', search: 'Evenly Matched yugioh card' },
      ],
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

// ── Helper: analyze a card list against user collection ───────────────────────

async function analyzeCardList(
  collection: Array<{ id: number; card_name: string; player_name: string; card_id: number; game: string; sport: string; set_name: string; estimated_value_cents: number; front_image_url: string; bbox_x: number; bbox_y: number; bbox_width: number; bbox_height: number }>,
  cardList: DeckCard[],
): Promise<{
  have: typeof collection;
  need: Array<{ name: string; qty: number; category: string; search: string; ebay_url: string; tcgplayer_url: string }>;
  have_count: number;
  need_count: number;
  total_count: number;
}> {
  const have: typeof collection = [];
  const need: Array<{ name: string; qty: number; category: string; search: string; ebay_url: string; tcgplayer_url: string }> = [];

  for (const deckCard of cardList) {
    const found = collection.find(c => {
      const name = (c.player_name || c.card_name || '').toLowerCase();
      return name.includes(deckCard.name.toLowerCase()) || deckCard.name.toLowerCase().includes(name);
    });

    if (found) {
      have.push(found);
    } else {
      need.push({
        name: deckCard.name,
        qty: deckCard.qty,
        category: deckCard.category,
        search: deckCard.search,
        ebay_url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(deckCard.search)}`,
        tcgplayer_url: `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(deckCard.name)}`,
      });
    }
  }

  return {
    have,
    need,
    have_count: have.length,
    need_count: need.length,
    total_count: cardList.length,
  };
}

// ── Route Handlers ────────────────────────────────────────────────────────────

// GET /api/meta/:game
export async function getMetaDecks(env: Env, game: string): Promise<Response> {
  // Strip deckId if present (e.g. /api/meta/pokemon/Charizard%20ex)
  const gamePart = game.split('/')[0].toLowerCase();
  const decks = META_DECKS[gamePart] ?? [];
  // Return summary without full card lists for performance
  const summaries = decks.map(d => ({
    name: d.name,
    archetype: d.archetype,
    game: d.game,
    format: d.format,
    theme: d.theme,
    description: d.description,
    key_cards: d.key_cards,
    strategy: d.strategy,
    estimated_budget_usd: d.estimated_budget_usd,
    difficulty: d.difficulty,
    commander: d.commander ?? null,
    // Include full deck data so frontend can use it directly
    full_deck: d.full_deck ?? d.main_deck ?? [],
    main_deck: d.main_deck ?? d.full_deck ?? [],
    extra_deck: d.extra_deck ?? [],
    side_deck: d.side_deck ?? [],
    sideboard: d.sideboard ?? [],
  }));
  return ok({ game: gamePart, decks: summaries });
}

// GET /api/meta/:game/:deckId
export async function getMetaDeck(env: Env, game: string, deckId: string): Promise<Response> {
  const gameLower = game.toLowerCase();
  const decks = META_DECKS[gameLower] ?? [];
  const deck = decks.find(d =>
    d.archetype.toLowerCase() === deckId.toLowerCase() ||
    d.name.toLowerCase() === deckId.toLowerCase()
  );
  if (!deck) {
    return new Response(JSON.stringify({ ok: false, error: 'Deck not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return ok({ deck });
}

// POST /api/deck/analyze
export async function analyzeDeckAgainstCollection(
  env: Env,
  request: Request,
  userId: number,
): Promise<Response> {
  const body = await request.json() as {
    key_cards: string[];
    full_deck?: DeckCard[] | null;
    extra_deck?: DeckCard[] | null;
    side_deck?: DeckCard[] | null;
    sideboard?: DeckCard[] | null;
    game: string;
    deck_size: number;
  };

  // Get user's collection
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
  const mainCardList: DeckCard[] = body.full_deck && body.full_deck.length > 0
    ? body.full_deck
    : body.key_cards.map(name => ({ name, qty: 1, category: 'pokemon', search: `${name} pokemon card` }));

  const mainAnalysis = await analyzeCardList(collection, mainCardList);

  // Analyze extra deck (YGO)
  let extraAnalysis = null;
  if (body.extra_deck && body.extra_deck.length > 0) {
    extraAnalysis = await analyzeCardList(collection, body.extra_deck);
  }

  // Analyze side deck (YGO) or sideboard (MTG)
  const sideDeckList = body.side_deck ?? body.sideboard ?? null;
  let sideAnalysis = null;
  if (sideDeckList && sideDeckList.length > 0) {
    sideAnalysis = await analyzeCardList(collection, sideDeckList);
  }

  // Calculate overall completion
  const totalCards = mainCardList.length + (body.extra_deck?.length ?? 0) + (sideDeckList?.length ?? 0);
  const totalHave = mainAnalysis.have_count + (extraAnalysis?.have_count ?? 0) + (sideAnalysis?.have_count ?? 0);
  const completionPct = totalCards > 0 ? Math.round((totalHave / totalCards) * 100) : 0;

  return ok({
    // Flat structure for backward compatibility
    have: mainAnalysis.have,
    need: mainAnalysis.need,
    completion_pct: completionPct,
    have_count: mainAnalysis.have_count,
    need_count: mainAnalysis.need_count,
    total_key_cards: mainCardList.length,
    // Extended structure for YGO/MTG
    main_deck: {
      have: mainAnalysis.have,
      need: mainAnalysis.need,
      have_count: mainAnalysis.have_count,
      total_count: mainCardList.length,
    },
    extra_deck: extraAnalysis ? {
      have: extraAnalysis.have,
      need: extraAnalysis.need,
      have_count: extraAnalysis.have_count,
      total_count: body.extra_deck?.length ?? 15,
    } : null,
    side_deck: sideAnalysis ? {
      have: sideAnalysis.have,
      need: sideAnalysis.need,
      have_count: sideAnalysis.have_count,
      total_count: sideDeckList?.length ?? 15,
    } : null,
  });
}
