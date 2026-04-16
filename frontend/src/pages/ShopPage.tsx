import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Shield, Star, ShoppingCart, X, Plus, Minus, Trash2, Sparkles,
  CheckCircle, XCircle, Package, BookOpen, Box, Layers, Archive,
  ChevronRight, Bell, Lock, Users, Zap, Clock,
} from 'lucide-react'

// ── Launch countdown (30 days from build — update to real launch date) ────────
const LAUNCH_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

function useCountdown(target: Date) {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  useEffect(() => {
    function tick() {
      const diff = Math.max(0, target.getTime() - Date.now())
      setT({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])
  return t
}

function useDemandCounter(base: number) {
  const [count, setCount] = useState(base)
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + (Math.random() > 0.88 ? 1 : 0)), 7000)
    return () => clearInterval(id)
  }, [])
  return count
}

// ── Slab types ────────────────────────────────────────────────────────────────
const SLAB_TYPES = [
  { id: 'psa',  label: 'PSA',         fullName: 'PSA Standard',  dims: '3.75" × 2.75" × 0.35"', desc: 'Fits all standard PSA graded card slabs',           color: '#C8102E', popular: true  },
  { id: 'bgs',  label: 'BGS/Beckett', fullName: 'BGS / Beckett', dims: '3.75" × 2.75" × 0.40"', desc: 'Fits BGS and Beckett graded slabs (slightly thicker)', color: '#003087', popular: false },
  { id: 'cgc',  label: 'CGC',         fullName: 'CGC / CSG',     dims: '3.75" × 2.75" × 0.38"', desc: 'Fits CGC and CSG graded card slabs',                 color: '#5B2D8E', popular: false },
  { id: 'tag',  label: 'TAG/HGA',     fullName: 'TAG / HGA',     dims: '3.75" × 2.75" × 0.38"', desc: 'Fits TAG and HGA graded card slabs',                 color: '#1A7A4A', popular: false },
  { id: 'sgc',  label: 'SGC',         fullName: 'SGC Standard',  dims: '3.75" × 2.75" × 0.36"', desc: 'Fits SGC graded card slabs',                        color: '#B8860B', popular: false },
]

// ── 61 silicone slab guard colors ─────────────────────────────────────────────
const SLAB_COLORS = [
  { name: 'Obsidian Black',  hex: '#111111', category: 'Classic'  },
  { name: 'Pristine White',  hex: '#F5F5F5', category: 'Classic'  },
  { name: 'Vault Grey',      hex: '#5A5A5A', category: 'Classic'  },
  { name: 'Smoke',           hex: '#9E9E9E', category: 'Classic'  },
  { name: 'Charcoal',        hex: '#3C3C3C', category: 'Classic'  },
  { name: 'Gem Mint Gold',   hex: '#D4AF37', category: 'Metallic' },
  { name: 'Champagne',       hex: '#F7E7CE', category: 'Metallic' },
  { name: 'Rose Gold',       hex: '#B76E79', category: 'Metallic' },
  { name: 'Silver Chrome',   hex: '#C0C0C0', category: 'Metallic' },
  { name: 'Bronze',          hex: '#CD7F32', category: 'Metallic' },
  { name: 'Collector Blue',  hex: '#0047AB', category: 'Blue'     },
  { name: 'Ocean',           hex: '#006994', category: 'Blue'     },
  { name: 'Sky',             hex: '#87CEEB', category: 'Blue'     },
  { name: 'Navy',            hex: '#001F5B', category: 'Blue'     },
  { name: 'Teal',            hex: '#008080', category: 'Blue'     },
  { name: 'Aqua',            hex: '#00FFFF', category: 'Blue'     },
  { name: 'Slate Blue',      hex: '#6A5ACD', category: 'Blue'     },
  { name: 'Crimson',         hex: '#DC143C', category: 'Red'      },
  { name: 'Scarlet',         hex: '#FF2400', category: 'Red'      },
  { name: 'Coral',           hex: '#FF6B6B', category: 'Red'      },
  { name: 'Hot Pink',        hex: '#FF69B4', category: 'Red'      },
  { name: 'Bubblegum',       hex: '#FFC1CC', category: 'Red'      },
  { name: 'Magenta',         hex: '#FF00FF', category: 'Red'      },
  { name: 'Emerald',         hex: '#50C878', category: 'Green'    },
  { name: 'Forest',          hex: '#228B22', category: 'Green'    },
  { name: 'Mint',            hex: '#98FF98', category: 'Green'    },
  { name: 'Lime',            hex: '#32CD32', category: 'Green'    },
  { name: 'Olive',           hex: '#808000', category: 'Green'    },
  { name: 'Sage',            hex: '#BCB88A', category: 'Green'    },
  { name: 'Hunter Green',    hex: '#355E3B', category: 'Green'    },
  { name: 'Royal Purple',    hex: '#7851A9', category: 'Purple'   },
  { name: 'Lavender',        hex: '#E6E6FA', category: 'Purple'   },
  { name: 'Violet',          hex: '#8B00FF', category: 'Purple'   },
  { name: 'Plum',            hex: '#DDA0DD', category: 'Purple'   },
  { name: 'Grape',           hex: '#6F2DA8', category: 'Purple'   },
  { name: 'Lilac',           hex: '#C8A2C8', category: 'Purple'   },
  { name: 'Sunset Orange',   hex: '#FF4500', category: 'Orange'   },
  { name: 'Tangerine',       hex: '#F28500', category: 'Orange'   },
  { name: 'Amber',           hex: '#FFBF00', category: 'Orange'   },
  { name: 'Canary Yellow',   hex: '#FFFF00', category: 'Orange'   },
  { name: 'Lemon',           hex: '#FFF44F', category: 'Orange'   },
  { name: 'Peach',           hex: '#FFCBA4', category: 'Orange'   },
  { name: 'Chocolate',       hex: '#7B3F00', category: 'Earth'    },
  { name: 'Caramel',         hex: '#C68642', category: 'Earth'    },
  { name: 'Tan',             hex: '#D2B48C', category: 'Earth'    },
  { name: 'Sand',            hex: '#F4A460', category: 'Earth'    },
  { name: 'Mocha',           hex: '#6F4E37', category: 'Earth'    },
  { name: 'Gold Glitter',    hex: '#D4AF37', category: 'Glitter', glitter: true },
  { name: 'Silver Glitter',  hex: '#C0C0C0', category: 'Glitter', glitter: true },
  { name: 'Pink Glitter',    hex: '#FF69B4', category: 'Glitter', glitter: true },
  { name: 'Blue Glitter',    hex: '#1F51FF', category: 'Glitter', glitter: true },
  { name: 'Purple Glitter',  hex: '#7851A9', category: 'Glitter', glitter: true },
  { name: 'Red Glitter',     hex: '#DC143C', category: 'Glitter', glitter: true },
  { name: 'Neon Green',      hex: '#39FF14', category: 'Special'  },
  { name: 'Neon Pink',       hex: '#FF6EC7', category: 'Special'  },
  { name: 'Neon Blue',       hex: '#1F51FF', category: 'Special'  },
  { name: 'Neon Orange',     hex: '#FF6700', category: 'Special'  },
  { name: 'Electric Yellow', hex: '#FFFF33', category: 'Special'  },
  { name: 'Glow White',      hex: '#FAFAFA', category: 'Special'  },
  { name: 'PSA Red',         hex: '#C8102E', category: 'Grading'  },
  { name: 'BGS Blue',        hex: '#003087', category: 'Grading'  },
  { name: 'CGC Purple',      hex: '#5B2D8E', category: 'Grading'  },
]

const COLOR_CATEGORIES = ['All', 'Classic', 'Metallic', 'Glitter', 'Blue', 'Red', 'Green', 'Purple', 'Orange', 'Earth', 'Special', 'Grading']

// ── Pricing ───────────────────────────────────────────────────────────────────
const PRICE_TIERS = [
  { min: 1,  max: 1,        each: 5.00, label: '1 Guard',    total: (n: number) => n * 5.00 },
  { min: 2,  max: 2,        each: 4.50, label: '2 Guards',   total: () => 9.00 },
  { min: 3,  max: 3,        each: 4.00, label: '3 Guards',   total: () => 12.00, best: true },
  { min: 4,  max: 5,        each: 3.80, label: '4–5 Guards', total: (n: number) => n * 3.80 },
  { min: 6,  max: 10,       each: 3.50, label: '6–10',       total: (n: number) => n * 3.50 },
  { min: 11, max: Infinity, each: 3.00, label: '11+',        total: (n: number) => n * 3.00 },
]

function calcTotal(qty: number): number {
  const tier = PRICE_TIERS.find(t => qty >= t.min && qty <= t.max) ?? PRICE_TIERS[PRICE_TIERS.length - 1]
  return tier.total(qty)
}
function calcEach(qty: number): number {
  const tier = PRICE_TIERS.find(t => qty >= t.min && qty <= t.max) ?? PRICE_TIERS[PRICE_TIERS.length - 1]
  return tier.each
}

// ── Product catalog for non-slab-guard categories ─────────────────────────────
interface ProductVariant { label: string; price: number; note?: string }
interface CatalogProduct {
  id: string
  name: string
  description: string
  badge?: string
  variants: ProductVariant[]
  comingSoon?: boolean
}

const PRODUCT_CATALOG: Record<string, CatalogProduct[]> = {
  'penny-sleeves': [
    {
      id: 'ps-standard',
      name: 'Standard Penny Sleeves',
      description: 'Crystal-clear soft poly sleeves for standard TCG cards (Pokémon, MTG, Yu-Gi-Oh!, Lorcana). Acid-free, archival quality.',
      badge: 'Most Popular',
      variants: [
        { label: '100-pack',  price: 1.99 },
        { label: '500-pack',  price: 7.99 },
        { label: '1000-pack', price: 13.99, note: 'Best Value' },
      ],
    },
    {
      id: 'ps-thick',
      name: 'Thick Penny Sleeves (100µm)',
      description: 'Extra-thick 100-micron sleeves for added protection without adding bulk. Perfect for double-sleeving.',
      variants: [
        { label: '100-pack', price: 2.99 },
        { label: '500-pack', price: 11.99 },
      ],
    },
    {
      id: 'ps-pvc-free',
      name: 'PVC-Free Penny Sleeves',
      description: 'Acid-free, PVC-free archival sleeves. Safe for long-term storage — no plasticizer migration.',
      badge: 'Archival Safe',
      variants: [
        { label: '100-pack',  price: 3.49 },
        { label: '500-pack',  price: 14.99 },
        { label: '1000-pack', price: 24.99, note: 'Best Value' },
      ],
    },
  ],
  'top-loaders': [
    {
      id: 'tl-standard',
      name: 'Standard Top Loaders (35pt)',
      description: 'Rigid 35-point PVC top loaders for standard TCG cards. The industry standard for raw card protection.',
      badge: 'Best Seller',
      variants: [
        { label: '25-pack',  price: 4.99 },
        { label: '100-pack', price: 14.99 },
        { label: '200-pack', price: 24.99, note: 'Best Value' },
      ],
    },
    {
      id: 'tl-thick',
      name: 'Thick Card Top Loaders (75pt)',
      description: 'For thicker cards — jersey cards, patches, vintage cards with slight warping. 75-point rigid PVC.',
      variants: [
        { label: '25-pack',  price: 5.99 },
        { label: '100-pack', price: 17.99 },
      ],
    },
    {
      id: 'tl-pvc-free',
      name: 'PVC-Free Top Loaders',
      description: 'Crystal-clear, acid-free, PVC-free rigid loaders. Archival-safe for long-term raw card storage.',
      badge: 'Archival Safe',
      variants: [
        { label: '25-pack',  price: 6.49 },
        { label: '100-pack', price: 19.99 },
      ],
    },
  ],
  'binders': [
    {
      id: 'binder-9pocket',
      name: '9-Pocket Binder (360 cards)',
      description: 'Premium side-loading 9-pocket binder with 40 pages. D-ring spine, padded cover, fits standard sleeves.',
      badge: 'Fan Favorite',
      variants: [
        { label: 'Black',  price: 19.99 },
        { label: 'White',  price: 19.99 },
        { label: 'Gold',   price: 21.99, note: 'Card Safe HQ Edition' },
      ],
    },
    {
      id: 'binder-4pocket',
      name: '4-Pocket Binder (160 cards)',
      description: 'Compact 4-pocket binder for display sets, showcase binders, or travel. Zippered closure option.',
      variants: [
        { label: 'Standard', price: 14.99 },
        { label: 'Zippered', price: 17.99 },
      ],
    },
    {
      id: 'binder-12pocket',
      name: '12-Pocket Binder (480 cards)',
      description: 'High-capacity 12-pocket binder for large collections. Reinforced spine, anti-glare pages.',
      variants: [
        { label: 'Black', price: 24.99 },
        { label: 'Navy',  price: 24.99 },
      ],
    },
  ],
  'acrylic-slab-guards': [
    {
      id: 'asg-psa',
      name: 'PSA Slab Guard with Acrylic Back',
      description: 'Silicone front guard + rigid acrylic backing panel. Dual-layer protection for your most valuable PSA slabs.',
      badge: 'Premium',
      variants: [
        { label: '1-pack',  price: 8.99 },
        { label: '3-pack',  price: 22.99, note: 'Save $4' },
        { label: '5-pack',  price: 34.99, note: 'Best Value' },
      ],
    },
    {
      id: 'asg-bgs',
      name: 'BGS/Beckett Slab Guard with Acrylic Back',
      description: 'Silicone front guard + acrylic backing for BGS/Beckett slabs. Slightly wider fit for the thicker BGS casing.',
      variants: [
        { label: '1-pack', price: 8.99 },
        { label: '3-pack', price: 22.99, note: 'Save $4' },
        { label: '5-pack', price: 34.99, note: 'Best Value' },
      ],
    },
    {
      id: 'asg-cgc',
      name: 'CGC Slab Guard with Acrylic Back',
      description: 'Silicone front guard + acrylic backing for CGC/CSG graded slabs.',
      variants: [
        { label: '1-pack', price: 8.99 },
        { label: '3-pack', price: 22.99 },
      ],
    },
    {
      id: 'asg-tag',
      name: 'TAG/HGA Slab Guard with Acrylic Back',
      description: 'Silicone front guard + acrylic backing for TAG and HGA graded slabs.',
      variants: [
        { label: '1-pack', price: 8.99 },
        { label: '3-pack', price: 22.99 },
      ],
    },
    {
      id: 'asg-sgc',
      name: 'SGC Slab Guard with Acrylic Back',
      description: 'Silicone front guard + acrylic backing for SGC graded slabs.',
      variants: [
        { label: '1-pack', price: 8.99 },
        { label: '3-pack', price: 22.99 },
      ],
    },
  ],
  'enclosed-cases': [
    {
      id: 'ec-psa',
      name: 'Full Enclosed Acrylic Case — PSA',
      description: 'Fully enclosed 4-panel acrylic case for PSA slabs. Magnetic closure, UV-resistant panels, display-ready.',
      badge: 'Display Ready',
      variants: [
        { label: '1-pack', price: 12.99 },
        { label: '3-pack', price: 34.99, note: 'Save $4' },
        { label: '6-pack', price: 62.99, note: 'Best Value' },
      ],
    },
    {
      id: 'ec-bgs',
      name: 'Full Enclosed Acrylic Case — BGS/Beckett',
      description: 'Fully enclosed 4-panel acrylic case for BGS/Beckett slabs. Magnetic closure, UV-resistant.',
      variants: [
        { label: '1-pack', price: 12.99 },
        { label: '3-pack', price: 34.99 },
      ],
    },
    {
      id: 'ec-cgc',
      name: 'Full Enclosed Acrylic Case — CGC',
      description: 'Fully enclosed acrylic case for CGC/CSG graded slabs. Magnetic closure.',
      variants: [
        { label: '1-pack', price: 12.99 },
        { label: '3-pack', price: 34.99 },
      ],
    },
    {
      id: 'ec-tag',
      name: 'Full Enclosed Acrylic Case — TAG/HGA',
      description: 'Fully enclosed acrylic case for TAG and HGA graded slabs.',
      variants: [
        { label: '1-pack', price: 12.99 },
        { label: '3-pack', price: 34.99 },
      ],
    },
    {
      id: 'ec-sgc',
      name: 'Full Enclosed Acrylic Case — SGC',
      description: 'Fully enclosed acrylic case for SGC graded slabs.',
      variants: [
        { label: '1-pack', price: 12.99 },
        { label: '3-pack', price: 34.99 },
      ],
    },
  ],
  'etb-cases': [
    {
      id: 'etb-standard',
      name: 'Acrylic ETB Display Case',
      description: 'Crystal-clear acrylic display case for Elite Trainer Boxes. Fits standard Pokémon ETBs. UV-resistant panels, magnetic lid.',
      badge: 'Most Popular',
      variants: [
        { label: '1-pack', price: 24.99 },
        { label: '2-pack', price: 44.99, note: 'Save $5' },
        { label: '4-pack', price: 79.99, note: 'Best Value' },
      ],
    },
    {
      id: 'etb-stack',
      name: 'Stackable ETB Acrylic Case',
      description: 'Stackable design for displaying multiple ETBs. Interlocking tabs keep your display organized and stable.',
      variants: [
        { label: '1-pack', price: 27.99 },
        { label: '4-pack', price: 99.99, note: 'Best Value' },
      ],
    },
    {
      id: 'etb-pvc',
      name: 'PVC ETB Protective Sleeve',
      description: 'Soft PVC sleeve that slides over your ETB for dust and scratch protection during storage or shipping.',
      variants: [
        { label: '1-pack',  price: 4.99 },
        { label: '5-pack',  price: 19.99 },
        { label: '10-pack', price: 34.99, note: 'Best Value' },
      ],
    },
  ],
  'booster-bundles': [
    {
      id: 'bb-sleeved-5',
      name: 'Sleeved Booster Bundle — 5 Packs',
      description: 'Five individually sleeved booster packs in a Card Safe HQ branded bundle. Each pack sealed in a crystal-clear protective sleeve.',
      badge: 'Gift Ready',
      variants: [
        { label: 'Pokémon',    price: 29.99 },
        { label: 'MTG',        price: 27.99 },
        { label: "Yu-Gi-Oh!",  price: 24.99 },
        { label: 'Lorcana',    price: 32.99 },
      ],
    },
    {
      id: 'bb-sleeved-10',
      name: 'Sleeved Booster Bundle — 10 Packs',
      description: 'Ten individually sleeved booster packs. Perfect for breaks, gifts, or building your collection.',
      variants: [
        { label: 'Pokémon',   price: 54.99 },
        { label: 'MTG',       price: 49.99 },
        { label: "Yu-Gi-Oh!", price: 44.99 },
        { label: 'Lorcana',   price: 59.99 },
      ],
    },
    {
      id: 'bb-pvc-5',
      name: 'PVC-Sleeved Booster Bundle — 5 Packs',
      description: 'Five booster packs in rigid PVC protective sleeves. Ideal for storage or resale — keeps packs pristine.',
      variants: [
        { label: 'Pokémon',   price: 31.99 },
        { label: 'MTG',       price: 29.99 },
        { label: "Yu-Gi-Oh!", price: 26.99 },
      ],
    },
  ],
  'booster-boxes': [
    {
      id: 'bx-acrylic-display',
      name: 'Booster Box Acrylic Display Case',
      description: 'Crystal-clear acrylic display case for sealed booster boxes. Magnetic lid, UV-resistant panels. Fits standard Pokémon, MTG, and Lorcana boxes.',
      badge: 'Display Ready',
      variants: [
        { label: '1-pack', price: 34.99 },
        { label: '2-pack', price: 62.99, note: 'Save $7' },
      ],
    },
    {
      id: 'bx-pvc-sleeve',
      name: 'Booster Box PVC Protective Sleeve',
      description: 'Soft PVC sleeve that wraps your sealed booster box for dust and scratch protection. Fits most standard box sizes.',
      variants: [
        { label: '1-pack',  price: 5.99 },
        { label: '5-pack',  price: 24.99 },
        { label: '10-pack', price: 44.99, note: 'Best Value' },
      ],
    },
    {
      id: 'bx-sleeved-wrap',
      name: 'Sleeved Booster Box Wrap',
      description: 'Premium fabric-backed sleeve with zipper closure for your sealed booster box. Padded interior, handle loop.',
      badge: 'Premium',
      variants: [
        { label: 'Standard Size', price: 14.99 },
        { label: 'Large Size',    price: 17.99 },
      ],
    },
  ],
  'sleeved-packs': [
    {
      id: 'sp-individual',
      name: 'Individual Sleeved Pack Protectors',
      description: 'Soft crystal-clear sleeves sized specifically for individual booster packs. Keeps packs scratch-free and display-ready.',
      variants: [
        { label: '10-pack',  price: 2.99 },
        { label: '50-pack',  price: 11.99 },
        { label: '100-pack', price: 19.99, note: 'Best Value' },
      ],
    },
    {
      id: 'sp-rigid',
      name: 'Rigid Pack Top Loaders',
      description: 'Rigid PVC top loaders sized for booster packs. Perfect for storing or displaying individual packs.',
      badge: 'New',
      variants: [
        { label: '10-pack', price: 5.99 },
        { label: '25-pack', price: 12.99 },
        { label: '50-pack', price: 21.99, note: 'Best Value' },
      ],
    },
  ],
  'pvc-packs': [
    {
      id: 'pvc-card-sleeves',
      name: 'PVC Card Sleeve Pack',
      description: 'Standard PVC card sleeves for general use. Note: for long-term archival storage, consider our PVC-free options.',
      variants: [
        { label: '100-pack',  price: 1.49 },
        { label: '500-pack',  price: 5.99 },
        { label: '1000-pack', price: 9.99, note: 'Best Value' },
      ],
    },
    {
      id: 'pvc-top-loaders',
      name: 'PVC Top Loader Pack',
      description: 'Standard PVC rigid top loaders. Affordable protection for raw cards, bulk lots, or trade binder cards.',
      variants: [
        { label: '25-pack',  price: 3.99 },
        { label: '100-pack', price: 12.99 },
        { label: '200-pack', price: 21.99, note: 'Best Value' },
      ],
    },
    {
      id: 'pvc-etb-sleeve',
      name: 'PVC ETB Sleeve',
      description: 'PVC protective sleeve for Elite Trainer Boxes. Soft, clear, and snug-fitting for dust and scratch protection.',
      variants: [
        { label: '1-pack',  price: 3.99 },
        { label: '5-pack',  price: 16.99 },
        { label: '10-pack', price: 29.99, note: 'Best Value' },
      ],
    },
    {
      id: 'pvc-booster-box',
      name: 'PVC Booster Box Sleeve',
      description: 'PVC sleeve for sealed booster boxes. Keeps boxes pristine during storage or transport.',
      variants: [
        { label: '1-pack',  price: 4.99 },
        { label: '5-pack',  price: 21.99 },
        { label: '10-pack', price: 38.99, note: 'Best Value' },
      ],
    },
    {
      id: 'pvc-pack-sleeve',
      name: 'PVC Individual Pack Sleeves',
      description: 'PVC sleeves sized for individual booster packs. Affordable bulk option for pack sellers and breakers.',
      variants: [
        { label: '50-pack',  price: 7.99 },
        { label: '100-pack', price: 13.99 },
        { label: '200-pack', price: 22.99, note: 'Best Value' },
      ],
    },
  ],
}

// ── Shop categories nav ───────────────────────────────────────────────────────
const SHOP_CATEGORIES = [
  { id: 'slab-guards',      label: 'Slab Guards',             icon: Shield,   description: 'Silicone guards in 61 colors for PSA, BGS, CGC, TAG & SGC' },
  { id: 'acrylic-slab-guards', label: 'Acrylic-Back Guards',  icon: Layers,   description: 'Silicone front + rigid acrylic backing for dual protection' },
  { id: 'enclosed-cases',   label: 'Enclosed Slab Cases',     icon: Box,      description: 'Full 4-panel acrylic enclosures with magnetic closure' },
  { id: 'etb-cases',        label: 'ETB Cases',               icon: Archive,  description: 'Acrylic display cases and PVC sleeves for Elite Trainer Boxes' },
  { id: 'top-loaders',      label: 'Top Loaders',             icon: Package,  description: 'Rigid PVC and PVC-free top loaders in 35pt and 75pt' },
  { id: 'penny-sleeves',    label: 'Penny Sleeves',           icon: Layers,   description: 'Standard, thick, and PVC-free penny sleeves' },
  { id: 'binders',          label: 'Binders',                 icon: BookOpen, description: '4, 9, and 12-pocket binders for display and storage' },
  { id: 'booster-bundles',  label: 'Booster Bundles',         icon: Star,     description: 'Sleeved and PVC-sleeved booster pack bundles' },
  { id: 'booster-boxes',    label: 'Booster Boxes',           icon: Box,      description: 'Acrylic display cases and protective sleeves for sealed boxes' },
  { id: 'sleeved-packs',    label: 'Sleeved Packs',           icon: Package,  description: 'Individual pack protectors — soft sleeves and rigid loaders' },
  { id: 'pvc-packs',        label: 'PVC Packs',               icon: Layers,   description: 'Affordable PVC sleeves and loaders for all product types' },
]

// ── Cart types ────────────────────────────────────────────────────────────────
type CartItem =
  | { kind: 'guard'; color: string; hex: string; slabType: string; qty: number; glitter: boolean }
  | { kind: 'product'; productId: string; productName: string; variantLabel: string; price: number; qty: number }

// ── Checkout modal ────────────────────────────────────────────────────────────
function CheckoutModal({ cart, onClose }: { cart: CartItem[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const guardItems = cart.filter(i => i.kind === 'guard') as Extract<CartItem, { kind: 'guard' }>[]
  const productItems = cart.filter(i => i.kind === 'product') as Extract<CartItem, { kind: 'product' }>[]

  const guardQty = guardItems.reduce((s, i) => s + i.qty, 0)
  const guardTotal = calcTotal(guardQty)
  const productTotal = productItems.reduce((s, i) => s + i.price * i.qty, 0)
  const grandTotal = guardTotal + productTotal

  async function handleCheckout() {
    setLoading(true)
    setError('')
    try {
      const apiBase = (import.meta as any).env?.VITE_API_URL ?? ''
      const items = [
        ...guardItems.map(i => ({
          color: i.color, slab_type: i.slabType, quantity: i.qty, glitter: i.glitter,
        })),
        ...productItems.map(i => ({
          color: i.productName, slab_type: i.variantLabel, quantity: i.qty, glitter: false,
        })),
      ]
      const res = await fetch(`${apiBase}/api/shop/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items, total_cents: Math.round(grandTotal * 100) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error ?? 'Checkout failed')
      }
      const data = await res.json() as { url: string }
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message ?? 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#111111', border: '1px solid rgba(212,175,55,0.2)', maxHeight: '92vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" style={{ color: '#D4AF37' }} />
            <span className="text-base font-bold">Your Order ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {guardItems.map((item, i) => {
            const slabLabel = SLAB_TYPES.find(s => s.id === item.slabType)?.label ?? item.slabType
            const isDark = parseInt(item.hex.slice(1, 3), 16) < 128
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="shrink-0 rounded-lg relative overflow-hidden" style={{ width: 32, height: 32, background: item.hex, border: '1.5px solid rgba(255,255,255,0.15)' }}>
                  {item.glitter && <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }} /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.color}{item.glitter ? ' ✦' : ''}</p>
                  <p className="text-xs text-cv-muted">{slabLabel} Slab Guard · ×{item.qty}</p>
                </div>
                <p className="text-sm font-bold shrink-0" style={{ color: '#D4AF37' }}>${calcTotal(item.qty).toFixed(2)}</p>
              </div>
            )
          })}
          {productItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)', border: '1.5px solid rgba(212,175,55,0.2)' }}>
                <Package className="h-4 w-4" style={{ color: '#D4AF37' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.productName}</p>
                <p className="text-xs text-cv-muted">{item.variantLabel} · ×{item.qty}</p>
              </div>
              <p className="text-sm font-bold shrink-0" style={{ color: '#D4AF37' }}>${(item.price * item.qty).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {guardQty > 0 && (
            <div className="flex justify-between text-xs text-cv-muted">
              <span>{guardQty} slab guard{guardQty !== 1 ? 's' : ''} · ${calcEach(guardQty).toFixed(2)} each</span>
              <span>${guardTotal.toFixed(2)}</span>
            </div>
          )}
          {productTotal > 0 && (
            <div className="flex justify-between text-xs text-cv-muted">
              <span>Accessories</span>
              <span>${productTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-black" style={{ color: '#D4AF37' }}>${grandTotal.toFixed(2)}</span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-base font-bold text-black transition flex items-center justify-center gap-2"
            style={{ background: loading ? 'rgba(212,175,55,0.5)' : 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
          >
            {loading ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Redirecting to Stripe…</>
            ) : (
              <><Lock className="h-4 w-4" />Secure Pre-Order — ${grandTotal.toFixed(2)}</>
            )}
          </button>
          <p className="text-[10px] text-center text-cv-muted">Pre-order secured via Stripe · Ships in 2–4 weeks after launch · Full refund if unfulfilled.</p>
        </div>
      </div>
    </div>
  )
}

// ── Generic product card ──────────────────────────────────────────────────────
function ProductCard({ product, onAddToCart }: { product: CatalogProduct; onAddToCart: (item: Extract<CartItem, { kind: 'product' }>) => void }) {
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [added, setAdded] = useState(false)

  function handleAdd() {
    const v = product.variants[selectedVariant]
    onAddToCart({ kind: 'product', productId: product.id, productName: product.name, variantLabel: v.label, price: v.price, qty: 1 })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const v = product.variants[selectedVariant]

  return (
    <div
      className="flex flex-col rounded-[var(--radius-md)] overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Card header */}
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold leading-snug">{product.name}</h3>
          {product.badge && (
            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' }}>
              {product.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-cv-muted leading-relaxed mb-3">{product.description}</p>

        {/* Variant selector */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {product.variants.map((variant, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedVariant(idx)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition relative"
              style={selectedVariant === idx
                ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {variant.label}
              {variant.note && (
                <span className="ml-1 text-[8px] font-bold" style={{ color: '#4ECBA0' }}>{variant.note}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between gap-3">
        <span className="text-lg font-black" style={{ color: '#D4AF37' }}>${v.price.toFixed(2)}</span>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-black transition"
          style={{ background: added ? '#4ECBA0' : 'linear-gradient(90deg, #D4AF37, #B8960C)', minWidth: 90 }}
        >
          {added ? <><CheckCircle className="h-3.5 w-3.5" /> Reserved!</> : <><Lock className="h-3.5 w-3.5" /> Pre-Order</>}
        </button>
      </div>
    </div>
  )
}

// ── Main ShopPage ─────────────────────────────────────────────────────────────
export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutStatus = searchParams.get('checkout')
  const countdown = useCountdown(LAUNCH_DATE)
  const demandCount = useDemandCounter(247)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifySubmitted, setNotifySubmitted] = useState(false)
  const [activeCategory, setActiveCategory] = useState('slab-guards')
  const [selectedSlabType, setSelectedSlabType] = useState('psa')
  const [colorCategory, setColorCategory] = useState('All')
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [addedFlash, setAddedFlash] = useState<string | null>(null)
  const categoryNavRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (checkoutStatus) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 6000)
      return () => clearTimeout(t)
    }
  }, [checkoutStatus, setSearchParams])

  // Scroll active category pill into view
  useEffect(() => {
    const el = categoryNavRef.current?.querySelector(`[data-cat="${activeCategory}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  const totalCartQty = cart.reduce((s, i) => s + i.qty, 0)

  const filteredColors = colorCategory === 'All' ? SLAB_COLORS : SLAB_COLORS.filter(c => c.category === colorCategory)

  function toggleColor(name: string) {
    setSelectedColors(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function addGuardsToCart() {
    if (selectedColors.length === 0) return
    setCart(prev => {
      const updated = [...prev]
      for (const name of selectedColors) {
        const colorDef = SLAB_COLORS.find(c => c.name === name)!
        const existing = updated.findIndex(i => i.kind === 'guard' && (i as any).color === name && (i as any).slabType === selectedSlabType)
        if (existing >= 0) {
          updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 }
        } else {
          updated.push({ kind: 'guard', color: name, hex: colorDef.hex, slabType: selectedSlabType, qty: 1, glitter: !!(colorDef as any).glitter })
        }
      }
      return updated
    })
    setAddedFlash(`${selectedColors.length} color${selectedColors.length > 1 ? 's' : ''} added`)
    setTimeout(() => setAddedFlash(null), 2500)
    setSelectedColors([])
  }

  function addProductToCart(item: Extract<CartItem, { kind: 'product' }>) {
    setCart(prev => {
      const existing = prev.findIndex(i => i.kind === 'product' && (i as any).productId === item.productId && (i as any).variantLabel === item.variantLabel)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 }
        return updated
      }
      return [...prev, item]
    })
  }

  function updateCartQty(idx: number, delta: number) {
    setCart(prev => {
      const updated = [...prev]
      const newQty = updated[idx].qty + delta
      if (newQty <= 0) updated.splice(idx, 1)
      else updated[idx] = { ...updated[idx], qty: newQty }
      return updated
    })
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const selectedSlabDef = SLAB_TYPES.find(s => s.id === selectedSlabType)!
  const currentProducts = PRODUCT_CATALOG[activeCategory] ?? []

  return (
    <div className="space-y-6 page-enter pb-8">

      {/* ── Checkout banners ── */}
      {checkoutStatus === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)]" style={{ background: 'rgba(78,203,160,0.12)', border: '1px solid rgba(78,203,160,0.3)' }}>
          <CheckCircle className="h-5 w-5 shrink-0" style={{ color: '#4ECBA0' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#4ECBA0' }}>Pre-order confirmed!</p>
            <p className="text-xs text-cv-muted mt-0.5">You're locked in. A confirmation email is on its way. Your order ships in 2–4 weeks after launch — we'll notify you the moment it's on its way.</p>
          </div>
        </div>
      )}
      {checkoutStatus === 'canceled' && (
        <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)]" style={{ background: 'rgba(240,96,96,0.08)', border: '1px solid rgba(240,96,96,0.25)' }}>
          <XCircle className="h-5 w-5 shrink-0" style={{ color: '#F06060' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#F06060' }}>Checkout canceled</p>
            <p className="text-xs text-cv-muted mt-0.5">No charge was made. Your cart is still saved — pick up where you left off.</p>
          </div>
        </div>
      )}

      {/* ── PRE-ORDER HYPE HERO ── */}
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] p-6 text-center" style={{ background: 'linear-gradient(135deg, #0A0A0C 0%, #1A1408 50%, #0A0A0C 100%)', border: '1px solid rgba(212,175,55,0.25)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.10) 0%, transparent 65%)' }} />
        <div className="relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full" style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.35)' }}>
            <Sparkles className="h-3 w-3" style={{ color: '#D4AF37' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#D4AF37' }}>Pre-Order Now Open</span>
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ lineHeight: 1.15 }}>Silicone Slab Guards<br /><span style={{ color: '#D4AF37' }}>Are Coming.</span></h1>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>61 colors · 5 grader sizes · Premium silicone protection.<br />Be the first to secure yours before the first batch sells out.</p>
          {/* Countdown */}
          <div className="flex justify-center gap-3 mb-5">
            {[{ val: countdown.days, label: 'Days' }, { val: countdown.hours, label: 'Hrs' }, { val: countdown.minutes, label: 'Min' }, { val: countdown.seconds, label: 'Sec' }].map(({ val, label }) => (
              <div key={label} className="text-center" style={{ minWidth: 52 }}>
                <div className="rounded-xl py-2 px-1 text-2xl font-black" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.22)', color: '#D4AF37', fontVariantNumeric: 'tabular-nums' }}>{String(val).padStart(2, '0')}</div>
                <p className="mt-1 text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
              </div>
            ))}
          </div>
          {/* Demand counter */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(240,96,96,0.10)', border: '1px solid rgba(240,96,96,0.2)' }}>
              <div className="h-2 w-2 rounded-full" style={{ background: '#F06060', animation: 'pulse 1.5s infinite' }} />
              <span className="text-xs font-bold" style={{ color: '#F06060' }}>{demandCount} collectors</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>have pre-ordered</span>
            </div>
          </div>
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[{ icon: Shield, text: 'Premium Silicone' }, { icon: Sparkles, text: '61 Colors + Glitter' }, { icon: Zap, text: 'Ships in 2–4 Weeks' }, { icon: Lock, text: 'Secure Checkout' }].map(({ icon: Icon, text }) => (
              <div key={text} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── NOTIFY ME ── */}
      <div className="rounded-[var(--radius-md)] p-4" style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-4 w-4" style={{ color: '#D4AF37' }} />
          <p className="text-sm font-bold">Get notified at launch</p>
        </div>
        {notifySubmitted ? (
          <div className="flex items-center gap-2" style={{ color: '#4ECBA0' }}>
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">You're on the list! We'll email you when we launch.</span>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); setNotifySubmitted(true) }} className="flex gap-2">
            <input type="email" placeholder="your@email.com" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} required
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            />
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold text-black" style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}>Notify Me</button>
          </form>
        )}
      </div>

      {/* ── Social proof strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ icon: Users, val: `${demandCount}+`, label: 'Pre-orders' }, { icon: Clock, val: '2–4 wks', label: 'Est. ship time' }, { icon: Shield, val: '100%', label: 'Refund guarantee' }, { icon: Star, val: '61', label: 'Colors available' }].map(({ icon: Icon, val, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-[var(--radius-md)] text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Icon className="h-4 w-4 mb-0.5" style={{ color: '#D4AF37' }} />
            <p className="text-base font-black" style={{ color: 'white' }}>{val}</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Shop header ── */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] p-6"
        style={{ background: 'linear-gradient(135deg, #0A0A0C 0%, #1A1408 50%, #0A0A0C 100%)', border: '1px solid rgba(212,175,55,0.25)' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 50%, rgba(212,175,55,0.07) 0%, transparent 70%)' }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4" style={{ color: '#D4AF37' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D4AF37' }}>Card Safe HQ Store</span>
            </div>
            <h1 className="text-2xl font-black mb-1">Collector Accessories</h1>
            <p className="text-cv-muted text-sm">Premium protection for every card, slab, and sealed product in your collection.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="shrink-0 relative flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-black"
            style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)', minWidth: 110 }}
          >
            <ShoppingCart className="h-4 w-4" />
            Cart
            {totalCartQty > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-black" style={{ background: '#fff' }}>
                {totalCartQty}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Category nav ── */}
      <div
        ref={categoryNavRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {SHOP_CATEGORIES.map(cat => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              data-cat={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition"
              style={isActive
                ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* ── Category description ── */}
      <div className="flex items-center gap-2">
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: '#D4AF37' }} />
        <p className="text-sm text-cv-muted">{SHOP_CATEGORIES.find(c => c.id === activeCategory)?.description}</p>
      </div>

      {/* ── Slab Guards section ── */}
      {activeCategory === 'slab-guards' && (
        <div className="space-y-6">
          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-black text-black" style={{ background: '#D4AF37' }}>1</span>
              <h2 className="text-lg font-bold">Choose Your Slab Type</h2>
            </div>
            <p className="text-xs text-cv-muted mb-4 ml-8">Different grading companies use slightly different slab dimensions. Select yours for the perfect fit.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {SLAB_TYPES.map(slab => {
                const isActive = selectedSlabType === slab.id
                return (
                  <button
                    key={slab.id}
                    type="button"
                    onClick={() => setSelectedSlabType(slab.id)}
                    className="relative flex flex-col items-start gap-1.5 p-4 rounded-[var(--radius-md)] text-left transition-all"
                    style={isActive
                      ? { background: 'rgba(212,175,55,0.08)', border: `2px solid ${slab.color}`, boxShadow: `0 0 12px ${slab.color}30` }
                      : { background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    {slab.popular && (
                      <span className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37' }}>POPULAR</span>
                    )}
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${slab.color}22` }}>
                      <Shield className="h-4 w-4" style={{ color: slab.color }} />
                    </div>
                    <p className="text-sm font-bold">{slab.label}</p>
                    <p className="text-[10px] text-cv-muted leading-snug">{slab.dims}</p>
                    {isActive && <p className="text-[10px] leading-snug mt-0.5" style={{ color: slab.color }}>{slab.desc}</p>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-black text-black" style={{ background: '#D4AF37' }}>2</span>
              <h2 className="text-lg font-bold">Choose Your Colors</h2>
            </div>
            <p className="text-xs text-cv-muted mb-4 ml-8">
              {selectedColors.length === 0
                ? 'Tap any color to select it. Mix & match freely.'
                : `${selectedColors.length} color${selectedColors.length !== 1 ? 's' : ''} selected for ${selectedSlabDef.label} slab`}
            </p>
            <div className="flex gap-2 flex-wrap mb-4">
              {COLOR_CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => setColorCategory(cat)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1"
                  style={colorCategory === cat
                    ? { background: 'var(--primary)', color: '#0A0A0C' }
                    : { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {cat === 'Glitter' && <Sparkles className="h-3 w-3" />}{cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
              {filteredColors.map(color => {
                const isSelected = selectedColors.includes(color.name)
                const isDark = parseInt(color.hex.slice(1, 3), 16) < 128
                const isGlitter = !!(color as any).glitter
                return (
                  <button key={color.name} type="button" onClick={() => toggleColor(color.name)} title={color.name + (isGlitter ? ' (Glitter)' : '')}
                    className="group relative flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-full rounded-[var(--radius-sm)] transition-all relative overflow-hidden"
                      style={{
                        aspectRatio: '1', background: color.hex,
                        border: isSelected ? '2.5px solid #D4AF37' : '1.5px solid rgba(255,255,255,0.12)',
                        boxShadow: isSelected ? '0 0 10px rgba(212,175,55,0.5)' : '0 1px 4px rgba(0,0,0,0.3)',
                        transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                      }}
                    >
                      {isGlitter && (
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 4px)', mixBlendMode: 'overlay' }} />
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-3 w-3 rounded-full flex items-center justify-center" style={{ background: '#D4AF37' }}>
                            <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" /></svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[8px] text-cv-muted text-center leading-tight line-clamp-2 w-full">{color.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 3 — Add to cart bar */}
          {selectedColors.length > 0 && (
            <div
              className="sticky bottom-20 sm:bottom-4 z-20 p-4 rounded-2xl flex items-center justify-between gap-4"
              style={{ background: '#111111', border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {selectedColors.slice(0, 5).map(name => {
                  const c = SLAB_COLORS.find(x => x.name === name)!
                  return <div key={name} className="h-6 w-6 rounded-full border-2 border-white/20" style={{ background: c.hex }} title={name} />
                })}
                {selectedColors.length > 5 && <span className="text-xs text-cv-muted">+{selectedColors.length - 5} more</span>}
                <span className="text-xs text-cv-muted ml-1">
                  {selectedColors.length} color{selectedColors.length > 1 ? 's' : ''} · {selectedSlabDef.label} · ${calcTotal(selectedColors.length).toFixed(2)}
                </span>
              </div>
              <button type="button" onClick={addGuardsToCart}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-black"
                style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
              >
                <Lock className="h-4 w-4" /> Pre-Order
              </button>
            </div>
          )}

          {/* Cart review */}
          {cart.filter(i => i.kind === 'guard').length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3">Your Slab Guards</h3>
              <div className="space-y-2">
                {cart.map((item, idx) => {
                  if (item.kind !== 'guard') return null
                  const slabLabel = SLAB_TYPES.find(s => s.id === item.slabType)?.label ?? item.slabType
                  const isDark = parseInt(item.hex.slice(1, 3), 16) < 128
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="shrink-0 rounded-lg relative overflow-hidden" style={{ width: 36, height: 36, background: item.hex, border: '1.5px solid rgba(255,255,255,0.15)' }}>
                        {item.glitter && <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="h-4 w-4" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }} /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{item.color}{item.glitter ? ' ✦' : ''}</p>
                        <p className="text-xs text-cv-muted">{slabLabel} Slab Guard</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => updateCartQty(idx, -1)} className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}><Minus className="h-3 w-3" /></button>
                        <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                        <button type="button" onClick={() => updateCartQty(idx, 1)} className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}><Plus className="h-3 w-3" /></button>
                      </div>
                      <p className="text-sm font-bold w-14 text-right" style={{ color: '#D4AF37' }}>${calcTotal(item.qty).toFixed(2)}</p>
                      <button type="button" onClick={() => removeFromCart(idx)} className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(240,96,96,0.1)' }}><Trash2 className="h-3 w-3 text-red-400" /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pricing tiers */}
          <div>
            <h3 className="text-base font-bold mb-3">Bundle Pricing</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PRICE_TIERS.map((tier, i) => (
                <div key={i} className="relative p-3 rounded-[var(--radius-md)] text-center" style={{ background: tier.best ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)', border: tier.best ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.07)' }}>
                  {tier.best && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-black px-2 py-0.5 rounded-full text-black" style={{ background: '#D4AF37' }}>BEST VALUE</span>}
                  <p className="text-xs text-cv-muted mb-1">{tier.label}</p>
                  <p className="text-base font-black" style={{ color: tier.best ? '#D4AF37' : 'var(--text)' }}>${tier.each.toFixed(2)}<span className="text-xs font-normal text-cv-muted">/ea</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── All other product categories ── */}
      {activeCategory !== 'slab-guards' && currentProducts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentProducts.map(product => (
            <ProductCard key={product.id} product={product} onAddToCart={addProductToCart} />
          ))}
        </div>
      )}

      {/* ── Cart review for non-guard items ── */}
      {activeCategory !== 'slab-guards' && cart.filter(i => i.kind === 'product').length > 0 && (
        <div>
          <h3 className="text-base font-bold mb-3">Your Cart</h3>
          <div className="space-y-2">
            {cart.map((item, idx) => {
              if (item.kind !== 'product') return null
              return (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                    <Package className="h-4 w-4" style={{ color: '#D4AF37' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.productName}</p>
                    <p className="text-xs text-cv-muted">{item.variantLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateCartQty(idx, -1)} className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}><Minus className="h-3 w-3" /></button>
                    <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                    <button type="button" onClick={() => updateCartQty(idx, 1)} className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}><Plus className="h-3 w-3" /></button>
                  </div>
                  <p className="text-sm font-bold w-14 text-right" style={{ color: '#D4AF37' }}>${(item.price * item.qty).toFixed(2)}</p>
                  <button type="button" onClick={() => removeFromCart(idx)} className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(240,96,96,0.1)' }}><Trash2 className="h-3 w-3 text-red-400" /></button>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="mt-4 w-full py-3 rounded-2xl text-sm font-bold text-black flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
          >
            <ShoppingCart className="h-4 w-4" />
            Checkout (${cart.filter(i => i.kind === 'product').reduce((s, i) => s + (i as any).price * i.qty, 0).toFixed(2)})
          </button>
        </div>
      )}

      {/* ── Added flash ── */}
      {addedFlash && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full text-sm font-bold text-black" style={{ background: '#D4AF37', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}>
          ✓ {addedFlash}
        </div>
      )}

      {/* ── Checkout modal ── */}
      {showCart && cart.length > 0 && (
        <CheckoutModal cart={cart} onClose={() => setShowCart(false)} />
      )}
    </div>
  )
}
