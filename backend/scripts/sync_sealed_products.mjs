import fs from 'fs'

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const DATABASE_ID = process.env.D1_DATABASE_ID // get from: wrangler d1 info cardsafehq-db

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`

async function d1Query(sql, params = []) {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })
  return res.json()
}

// Sealed product type detection from TCGPlayer product names
function detectProductType(name) {
  const n = name.toLowerCase()
  // Order matters — more specific patterns first
  if (n.includes('mini tin')) return 'mini_tin'
  if (n.includes('ultra premium') || n.includes('upc')) return 'ultra_premium_collection'
  if (n.includes('super premium')) return 'super_premium_collection'
  if (n.includes('elite trainer box') || n.includes(' etb') || n.endsWith('etb')) return 'elite_trainer_box'
  if (n.includes('booster box') || n.includes('36-pack') || n.includes('booster display')) return 'booster_box'
  if (n.includes('premium collection')) return 'premium_collection'
  if (n.includes('special collection')) return 'special_collection'
  if (n.includes('booster bundle') || n.includes('6-pack')) return 'booster_bundle'
  if (n.includes('figure collection')) return 'figure_collection'
  if (n.includes('poster collection')) return 'poster_collection'
  if (n.includes('pin collection') || n.includes('pin box')) return 'pin_collection'
  if (n.includes('collection chest')) return 'collection_box'
  if (n.includes('collection box')) return 'collection_box'
  if (n.includes('build & battle') || n.includes('build and battle')) return 'build_and_battle'
  if (n.includes('world championship')) return 'world_championship_deck'
  if (n.includes('league battle deck') || n.includes('battle deck')) return 'battle_deck'
  if (n.includes('theme deck') || n.includes('starter deck')) return 'theme_deck'
  if (n.includes('blister') || n.includes('3-pack')) return 'blister_pack'
  if (n.includes('gift box') || n.includes('holiday gift')) return 'gift_set'
  if (n.includes('binder')) return 'binder_collection'
  // EX box / special promo box detection
  if (/\bex\s+box\b/.test(n) || n.includes(' ex box') || n.endsWith(' ex')) return 'ex_box'
  // Promo packs (Black Star promos, promo packs, promo sets)
  if (n.includes('promo pack') || n.includes('black star promo') || n.includes('promo set') || n.includes('promotional')) return 'promo_pack'
  // Tins (check after more specific patterns)
  if (n.includes('tin') && !n.includes('collection') && !n.includes('platinum')) return 'tin'
  // Single booster packs
  if (n.includes('booster pack') && !n.includes('box') && !n.includes('bundle')) return 'booster_pack'
  // Catch-all collection
  if (n.includes('collection') && !n.includes('box')) return 'special_collection'
  return 'other'
}

async function main() {
  console.log('Fetching Pokemon groups from TCGCSV...')
  
  // Get all Pokemon groups (sets)
  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/3/groups')
  const groupsData = await groupsRes.json()
  const groups = groupsData.results ?? []
  
  console.log(`Found ${groups.length} groups`)
  
  let totalInserted = 0
  
  for (const group of groups) {
    const groupId = group.groupId
    const groupName = group.name
    const publishedOn = group.publishedOn?.split('T')[0].replace(/-/g, '/') ?? null
    
    // Fetch products for this group
    const productsRes = await fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`)
    if (!productsRes.ok) continue
    
    const productsData = await productsRes.json()
    const products = productsData.results ?? []
    
    // Fetch prices for this group  
    const pricesRes = await fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/prices`)
    const pricesData = pricesRes.ok ? await pricesRes.json() : { results: [] }
    const prices = pricesData.results ?? []
    
    // Build price map by productId
    const priceMap = {}
    for (const price of prices) {
      if (!priceMap[price.productId]) priceMap[price.productId] = {}
      priceMap[price.productId][price.subTypeName] = price
    }
    
    // Filter to sealed products only (no individual cards)
    // TCGPlayer sealed products have subTypeName like "Normal" and no card number
    const sealedKeywords = [
      'box', 'pack', 'bundle', 'collection', 'tin', 'deck', 
      'binder', 'blister', 'set', 'display', 'case',
      'promo', 'chest', 'gift', 'holiday', 'premium'
    ]
    
    const sealedProducts = products.filter(p => {
      const n = (p.name ?? '').toLowerCase()
      return sealedKeywords.some(k => n.includes(k)) && !p.number
    })
    
    for (const product of sealedProducts) {
      const productType = detectProductType(product.name)
      const productPrices = priceMap[product.productId] ?? {}
      
      // Get market price — prefer Normal subtype
      const normalPrice = productPrices['Normal']
      const marketPrice = normalPrice?.marketPrice ?? normalPrice?.midPrice ?? null
      const marketCents = marketPrice ? Math.round(marketPrice * 100) : null
      
      const tcgplayerUrl = product.url ?? 
        `https://www.tcgplayer.com/product/${product.productId}`
      
      await d1Query(
        `INSERT OR REPLACE INTO sealed_products 
         (name, set_name, set_id, product_type, tcgplayer_url, 
          market_price_cents, release_date, tcgplayer_product_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.name,
          groupName,
          group.abbreviation ?? null,
          productType,
          tcgplayerUrl,
          marketCents,
          publishedOn,
          product.productId,
        ]
      )
      
      totalInserted++
    }
    
    if (sealedProducts.length > 0) {
      console.log(`  ${groupName}: ${sealedProducts.length} sealed products`)
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 100))
  }
  
  console.log(`Done. Total sealed products synced: ${totalInserted}`)
}

main().catch(console.error)
