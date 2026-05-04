export async function fetchCardImage(cardName: string, game: 'pokemon' | 'mtg' | 'yugioh' = 'pokemon'): Promise<string | null> {
  try {
    if (game === 'pokemon') {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"&pageSize=1`)
      const data = await res.json()
      return data.data?.[0]?.images?.large ?? data.data?.[0]?.images?.small ?? null
    }
    if (game === 'mtg') {
      const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`)
      const data = await res.json()
      return data.image_uris?.normal ?? data.image_uris?.large ?? null
    }
    if (game === 'yugioh') {
      const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(cardName)}`)
      const data = await res.json()
      return data.data?.[0]?.card_images?.[0]?.image_url ?? null
    }
  } catch { return null }
  return null
}
