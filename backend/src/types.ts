export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  CORS_ORIGIN?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY: string;
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  POKEMON_TCG_API_KEY?: string;
  ADMIN_EMAIL?: string;
  // Email
  RESEND_API_KEY?: string; // legacy
  MAILEROO_API_KEY?: string;
  MAIL_FROM?: string;
  APP_URL?: string; // legacy
  APP_BASE_URL?: string;
  ENFORCE_EMAIL_VERIFICATION?: string;
  // Payments (Stripe)
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SHOP_OWNER_EMAIL?: string;
  STRIPE_PRICE_ID_MONTHLY?: string;
  STRIPE_PRICE_ID_YEARLY?: string;
}
export interface User {
  id: number;
  email: string;
  username: string | null;
  created_at: string;
}
export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
}
export interface Card {
  id: number;
  game: string;
  set_name: string | null;
  card_name: string;
  card_number: string | null;
  rarity: string | null;
  image_url: string | null;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductType =
  | 'single_card'
  | 'booster_pack'
  | 'booster_box'
  | 'etb'
  | 'elite_trainer_box'
  | 'tin'
  | 'mini_tin'
  | 'bundle'
  | 'booster_bundle'
  | 'promo_pack'
  | 'other_sealed'
  | 'ultra_premium_collection'
  | 'premium_collection'
  | 'special_collection'
  | 'super_premium_collection'
  | 'figure_collection'
  | 'poster_collection'
  | 'pin_collection'
  | 'collection_box'
  | 'build_and_battle'
  | 'battle_deck'
  | 'theme_deck'
  | 'blister_pack'
  | 'gift_set'
  | 'binder_collection'
  | 'world_championship_deck'
  | 'ex_box'

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  single_card: 'Single Card',
  booster_pack: 'Booster Pack',
  booster_box: 'Booster Box',
  etb: 'Elite Trainer Box',
  elite_trainer_box: 'Elite Trainer Box',
  tin: 'Tin',
  mini_tin: 'Mini Tin',
  bundle: 'Bundle',
  booster_bundle: 'Booster Bundle',
  promo_pack: 'Promo Pack',
  other_sealed: 'Other Sealed',
  ultra_premium_collection: 'Ultra Premium Collection',
  premium_collection: 'Premium Collection',
  special_collection: 'Special Collection',
  super_premium_collection: 'Super Premium Collection',
  figure_collection: 'Figure Collection',
  poster_collection: 'Poster Collection',
  pin_collection: 'Pin Collection',
  collection_box: 'Collection Box',
  build_and_battle: 'Build & Battle Box',
  battle_deck: 'Battle Deck',
  theme_deck: 'Theme / Starter Deck',
  blister_pack: 'Blister Pack',
  gift_set: 'Gift Set',
  binder_collection: 'Binder Collection',
  world_championship_deck: 'World Championship Deck',
  ex_box: 'EX Box',
}
