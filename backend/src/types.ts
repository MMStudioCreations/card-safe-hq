export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  CORS_ORIGIN?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY:string;
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  POKEMON_TCG_API_KEY?: string;
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
  | 'tin'
  | 'bundle'
  | 'promo_pack'
  | 'other_sealed'

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  single_card: 'Single Card',
  booster_pack: 'Booster Pack',
  booster_box: 'Booster Box',
  etb: 'Elite Trainer Box',
  tin: 'Tin',
  bundle: 'Bundle',
  promo_pack: 'Promo Pack',
  other_sealed: 'Other Sealed',
}
