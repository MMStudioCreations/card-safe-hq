// Fetches current market price for a sealed product from TCGCSV
// Used to refresh stale prices on card detail view
export async function fetchSealedPrice(
  tcgplayerProductId: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://tcgcsv.com/tcgplayer/3/products/${tcgplayerProductId}/prices`,
      { cf: { cacheTtl: 3600 } } // cache for 1 hour in Workers
    )
    if (!res.ok) return null
    const data = await res.json() as { results: Array<{
      subTypeName: string
      marketPrice: number | null
      midPrice: number | null
    }> }
    const normal = data.results?.find(p => p.subTypeName === 'Normal')
    const price = normal?.marketPrice ?? normal?.midPrice ?? null
    return price ? Math.round(price * 100) : null
  } catch {
    return null
  }
}

// Fetches current market price for a single card from TCGCSV
export async function fetchCardPrice(
  tcgplayerProductId: number
): Promise<{ normal: number | null; holofoil: number | null; reverseHolo: number | null }> {
  try {
    const res = await fetch(
      `https://tcgcsv.com/tcgplayer/3/products/${tcgplayerProductId}/prices`,
      { cf: { cacheTtl: 3600 } }
    )
    if (!res.ok) return { normal: null, holofoil: null, reverseHolo: null }
    const data = await res.json() as { results: Array<{
      subTypeName: string
      marketPrice: number | null
      midPrice: number | null
    }> }
    
    const get = (type: string) => {
      const p = data.results?.find(r => r.subTypeName === type)
      const price = p?.marketPrice ?? p?.midPrice ?? null
      return price ? Math.round(price * 100) : null
    }
    
    return {
      normal: get('Normal'),
      holofoil: get('Holofoil'),
      reverseHolo: get('Reverse Holofoil'),
    }
  } catch {
    return { normal: null, holofoil: null, reverseHolo: null }
  }
}
