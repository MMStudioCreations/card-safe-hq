import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shield, Star, ShoppingCart, X, Plus, Minus, Trash2, Sparkles, CheckCircle, XCircle } from 'lucide-react'

// ── Slab types with sizing info ───────────────────────────────────────────────
const SLAB_TYPES = [
  {
    id: 'psa',
    label: 'PSA',
    fullName: 'PSA Standard',
    dims: '3.75" × 2.75" × 0.35"',
    desc: 'Fits all standard PSA graded card slabs',
    color: '#C8102E',
    popular: true,
  },
  {
    id: 'bgs',
    label: 'BGS / Beckett',
    fullName: 'BGS / Beckett',
    dims: '3.75" × 2.75" × 0.40"',
    desc: 'Fits BGS and Beckett graded slabs (slightly thicker)',
    color: '#003087',
    popular: false,
  },
  {
    id: 'cgc',
    label: 'CGC',
    fullName: 'CGC / CSG',
    dims: '3.75" × 2.75" × 0.38"',
    desc: 'Fits CGC and CSG graded card slabs',
    color: '#5B2D8E',
    popular: false,
  },
  {
    id: 'tag',
    label: 'TAG',
    fullName: 'TAG / HGA',
    dims: '3.75" × 2.75" × 0.38"',
    desc: 'Fits TAG and HGA graded card slabs',
    color: '#1A7A4A',
    popular: false,
  },
  {
    id: 'sgc',
    label: 'SGC',
    fullName: 'SGC Standard',
    dims: '3.75" × 2.75" × 0.36"',
    desc: 'Fits SGC graded card slabs',
    color: '#B8860B',
    popular: false,
  },
]

// ── 61 silicone slab guard colors (including glitter) ─────────────────────────
const SLAB_COLORS = [
  // Classics (5)
  { name: 'Obsidian Black', hex: '#111111', category: 'Classic' },
  { name: 'Pristine White', hex: '#F5F5F5', category: 'Classic' },
  { name: 'Vault Grey', hex: '#5A5A5A', category: 'Classic' },
  { name: 'Smoke', hex: '#9E9E9E', category: 'Classic' },
  { name: 'Charcoal', hex: '#3C3C3C', category: 'Classic' },
  // Metallics (5)
  { name: 'Gem Mint Gold', hex: '#D4AF37', category: 'Metallic' },
  { name: 'Champagne', hex: '#F7E7CE', category: 'Metallic' },
  { name: 'Rose Gold', hex: '#B76E79', category: 'Metallic' },
  { name: 'Silver Chrome', hex: '#C0C0C0', category: 'Metallic' },
  { name: 'Bronze', hex: '#CD7F32', category: 'Metallic' },
  // Blues (7)
  { name: 'Collector Blue', hex: '#0047AB', category: 'Blue' },
  { name: 'Ocean', hex: '#006994', category: 'Blue' },
  { name: 'Sky', hex: '#87CEEB', category: 'Blue' },
  { name: 'Navy', hex: '#001F5B', category: 'Blue' },
  { name: 'Teal', hex: '#008080', category: 'Blue' },
  { name: 'Aqua', hex: '#00FFFF', category: 'Blue' },
  { name: 'Slate Blue', hex: '#6A5ACD', category: 'Blue' },
  // Reds & Pinks (6)
  { name: 'Crimson', hex: '#DC143C', category: 'Red' },
  { name: 'Scarlet', hex: '#FF2400', category: 'Red' },
  { name: 'Coral', hex: '#FF6B6B', category: 'Red' },
  { name: 'Hot Pink', hex: '#FF69B4', category: 'Red' },
  { name: 'Bubblegum', hex: '#FFC1CC', category: 'Red' },
  { name: 'Magenta', hex: '#FF00FF', category: 'Red' },
  // Greens (7)
  { name: 'Emerald', hex: '#50C878', category: 'Green' },
  { name: 'Forest', hex: '#228B22', category: 'Green' },
  { name: 'Mint', hex: '#98FF98', category: 'Green' },
  { name: 'Lime', hex: '#32CD32', category: 'Green' },
  { name: 'Olive', hex: '#808000', category: 'Green' },
  { name: 'Sage', hex: '#BCB88A', category: 'Green' },
  { name: 'Hunter Green', hex: '#355E3B', category: 'Green' },
  // Purples (6)
  { name: 'Royal Purple', hex: '#7851A9', category: 'Purple' },
  { name: 'Lavender', hex: '#E6E6FA', category: 'Purple' },
  { name: 'Violet', hex: '#8B00FF', category: 'Purple' },
  { name: 'Plum', hex: '#DDA0DD', category: 'Purple' },
  { name: 'Grape', hex: '#6F2DA8', category: 'Purple' },
  { name: 'Lilac', hex: '#C8A2C8', category: 'Purple' },
  // Oranges & Yellows (6)
  { name: 'Sunset Orange', hex: '#FF4500', category: 'Orange' },
  { name: 'Tangerine', hex: '#F28500', category: 'Orange' },
  { name: 'Amber', hex: '#FFBF00', category: 'Orange' },
  { name: 'Canary Yellow', hex: '#FFFF00', category: 'Orange' },
  { name: 'Lemon', hex: '#FFF44F', category: 'Orange' },
  { name: 'Peach', hex: '#FFCBA4', category: 'Orange' },
  // Earth (5)
  { name: 'Chocolate', hex: '#7B3F00', category: 'Earth' },
  { name: 'Caramel', hex: '#C68642', category: 'Earth' },
  { name: 'Tan', hex: '#D2B48C', category: 'Earth' },
  { name: 'Sand', hex: '#F4A460', category: 'Earth' },
  { name: 'Mocha', hex: '#6F4E37', category: 'Earth' },
  // Glitter (6) — NEW
  { name: 'Gold Glitter', hex: '#D4AF37', category: 'Glitter', glitter: true },
  { name: 'Silver Glitter', hex: '#C0C0C0', category: 'Glitter', glitter: true },
  { name: 'Pink Glitter', hex: '#FF69B4', category: 'Glitter', glitter: true },
  { name: 'Blue Glitter', hex: '#1F51FF', category: 'Glitter', glitter: true },
  { name: 'Purple Glitter', hex: '#7851A9', category: 'Glitter', glitter: true },
  { name: 'Red Glitter', hex: '#DC143C', category: 'Glitter', glitter: true },
  // Neons & Special (6)
  { name: 'Neon Green', hex: '#39FF14', category: 'Special' },
  { name: 'Neon Pink', hex: '#FF6EC7', category: 'Special' },
  { name: 'Neon Blue', hex: '#1F51FF', category: 'Special' },
  { name: 'Neon Orange', hex: '#FF6700', category: 'Special' },
  { name: 'Electric Yellow', hex: '#FFFF33', category: 'Special' },
  { name: 'Glow White', hex: '#FAFAFA', category: 'Special' },
  // Grading-inspired (3)
  { name: 'PSA Red', hex: '#C8102E', category: 'Grading' },
  { name: 'BGS Blue', hex: '#003087', category: 'Grading' },
  { name: 'CGC Purple', hex: '#5B2D8E', category: 'Grading' },
]

const CATEGORIES = ['All', 'Classic', 'Metallic', 'Glitter', 'Blue', 'Red', 'Green', 'Purple', 'Orange', 'Earth', 'Special', 'Grading']

// ── Pricing logic ─────────────────────────────────────────────────────────────
const PRICE_TIERS = [
  { min: 1, max: 1, each: 5.00, label: '1 Guard', total: (n: number) => n * 5.00 },
  { min: 2, max: 2, each: 4.50, label: '2 Guards', total: () => 9.00 },
  { min: 3, max: 3, each: 4.00, label: '3 Guards', total: () => 12.00, best: true },
  { min: 4, max: 5, each: 3.80, label: '4–5 Guards', total: (n: number) => n * 3.80 },
  { min: 6, max: 10, each: 3.50, label: '6–10 Guards', total: (n: number) => n * 3.50 },
  { min: 11, max: Infinity, each: 3.00, label: '11+ Guards', total: (n: number) => n * 3.00 },
]

function calcTotal(qty: number): number {
  const tier = PRICE_TIERS.find(t => qty >= t.min && qty <= t.max) ?? PRICE_TIERS[PRICE_TIERS.length - 1]
  return tier.total(qty)
}

function calcEach(qty: number): number {
  const tier = PRICE_TIERS.find(t => qty >= t.min && qty <= t.max) ?? PRICE_TIERS[PRICE_TIERS.length - 1]
  return tier.each
}

// ── Cart item type ────────────────────────────────────────────────────────────
type CartItem = {
  color: string
  hex: string
  slabType: string
  qty: number
  glitter: boolean
}

// ── Checkout modal ────────────────────────────────────────────────────────────
function CheckoutModal({
  cart,
  onClose,
  onSuccess,
}: {
  cart: CartItem[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalQty = cart.reduce((s, i) => s + i.qty, 0)
  const totalPrice = calcTotal(totalQty)

  async function handleCheckout() {
    setLoading(true)
    setError('')
    try {
      const apiBase = (import.meta as any).env?.VITE_API_URL ?? ''
      const res = await fetch(`${apiBase}/api/shop/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map(i => ({
            color: i.color,
            slab_type: i.slabType,
            quantity: i.qty,
            glitter: i.glitter,
          })),
          total_cents: Math.round(totalPrice * 100),
        }),
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
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#111111', border: '1px solid rgba(212,175,55,0.2)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" style={{ color: '#D4AF37' }} />
            <span className="text-base font-bold">Your Order</span>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cart.map((item, i) => {
            const slabLabel = SLAB_TYPES.find(s => s.id === item.slabType)?.label ?? item.slabType
            const isDark = parseInt(item.hex.slice(1, 3), 16) < 128
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="shrink-0 rounded-lg relative overflow-hidden"
                  style={{ width: 36, height: 36, background: item.hex, border: '1.5px solid rgba(255,255,255,0.15)' }}
                >
                  {item.glitter && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="h-4 w-4" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.color}{item.glitter ? ' ✦' : ''}</p>
                  <p className="text-xs text-cv-muted">{slabLabel} slab · ×{item.qty}</p>
                </div>
                <p className="text-sm font-bold shrink-0" style={{ color: '#D4AF37' }}>
                  ${calcTotal(item.qty).toFixed(2)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="px-5 py-4 space-y-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-cv-muted">{totalQty} guard{totalQty !== 1 ? 's' : ''} · ${calcEach(totalQty).toFixed(2)} each</span>
            <span className="text-xl font-black" style={{ color: '#D4AF37' }}>${totalPrice.toFixed(2)}</span>
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
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Redirecting to Stripe…
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Pay ${totalPrice.toFixed(2)} with Stripe
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-cv-muted">Secure checkout powered by Stripe. You'll be redirected to complete payment.</p>
        </div>
      </div>
    </div>
  )
}

// ── Main ShopPage ─────────────────────────────────────────────────────────────
export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutStatus = searchParams.get('checkout') // 'success' | 'canceled'

  useEffect(() => {
    if (checkoutStatus) {
      // Clear the query param after 6 seconds
      const t = setTimeout(() => {
        setSearchParams({}, { replace: true })
      }, 6000)
      return () => clearTimeout(t)
    }
  }, [checkoutStatus, setSearchParams])

  const [selectedSlabType, setSelectedSlabType] = useState('psa')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [addedFlash, setAddedFlash] = useState<string | null>(null)

  const filteredColors = categoryFilter === 'All'
    ? SLAB_COLORS
    : SLAB_COLORS.filter(c => c.category === categoryFilter)

  const totalCartQty = cart.reduce((s, i) => s + i.qty, 0)
  const totalCartPrice = cart.reduce((s, i) => s + calcTotal(i.qty), 0)

  function toggleColor(name: string) {
    setSelectedColors(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function addToCart() {
    if (selectedColors.length === 0) return
    const slabType = selectedSlabType
    const newItems: CartItem[] = selectedColors.map(name => {
      const colorDef = SLAB_COLORS.find(c => c.name === name)!
      return {
        color: name,
        hex: colorDef.hex,
        slabType,
        qty: 1,
        glitter: !!(colorDef as any).glitter,
      }
    })
    setCart(prev => {
      const updated = [...prev]
      for (const newItem of newItems) {
        const existing = updated.findIndex(i => i.color === newItem.color && i.slabType === newItem.slabType)
        if (existing >= 0) {
          updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 }
        } else {
          updated.push(newItem)
        }
      }
      return updated
    })
    setAddedFlash(`${selectedColors.length} color${selectedColors.length > 1 ? 's' : ''} added to cart`)
    setTimeout(() => setAddedFlash(null), 2500)
    setSelectedColors([])
  }

  function updateCartQty(idx: number, delta: number) {
    setCart(prev => {
      const updated = [...prev]
      const newQty = updated[idx].qty + delta
      if (newQty <= 0) {
        updated.splice(idx, 1)
      } else {
        updated[idx] = { ...updated[idx], qty: newQty }
      }
      return updated
    })
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const selectedSlabDef = SLAB_TYPES.find(s => s.id === selectedSlabType)!

  return (
    <div className="space-y-8 page-enter pb-8">

      {/* ── Checkout status banner ── */}
      {checkoutStatus === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)]" style={{ background: 'rgba(78,203,160,0.12)', border: '1px solid rgba(78,203,160,0.3)' }}>
          <CheckCircle className="h-5 w-5 shrink-0" style={{ color: '#4ECBA0' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#4ECBA0' }}>Order placed successfully!</p>
            <p className="text-xs text-cv-muted mt-0.5">Thank you for your purchase. You'll receive a confirmation email from Stripe shortly. We'll ship your slab guards within 2–3 business days.</p>
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

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] p-8"
        style={{
          background: 'linear-gradient(135deg, #0A0A0C 0%, #1A1408 50%, #0A0A0C 100%)',
          border: '1px solid rgba(212,175,55,0.25)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 50%, rgba(212,175,55,0.08) 0%, transparent 70%)' }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5" style={{ color: '#D4AF37' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D4AF37' }}>Card Safe HQ Originals</span>
            </div>
            <h1 className="text-3xl font-black mb-2">Silicone Slab Guards</h1>
            <p className="text-cv-muted text-sm max-w-md">
              Premium silicone protection for your graded slabs. Available in <strong className="text-white">61 colors including glitter</strong> — mix, match, and protect your most valuable cards in style.
            </p>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span className="px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
                From $5 each
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(78,203,160,0.12)', color: '#4ECBA0' }}>
                PSA · BGS · CGC · TAG · SGC
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1" style={{ background: 'rgba(212,175,55,0.08)', color: '#D4AF37' }}>
                <Sparkles className="h-3 w-3" /> Glitter Available
              </span>
            </div>
          </div>
          {/* Cart button */}
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="shrink-0 relative flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-black transition"
            style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)', minWidth: 140 }}
          >
            <ShoppingCart className="h-5 w-5" />
            Cart
            {totalCartQty > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-black" style={{ background: '#fff' }}>
                {totalCartQty}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Step 1: Choose Slab Type ── */}
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
                {isActive && (
                  <p className="text-[10px] leading-snug mt-0.5" style={{ color: slab.color }}>{slab.desc}</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Step 2: Choose Colors ── */}
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

        {/* Category filter pills */}
        <div className="flex gap-2 flex-wrap mb-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1"
              style={categoryFilter === cat
                ? { background: 'var(--primary)', color: '#0A0A0C' }
                : { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {cat === 'Glitter' && <Sparkles className="h-3 w-3" />}
              {cat}
            </button>
          ))}
        </div>

        {/* Color grid */}
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {filteredColors.map(color => {
            const isSelected = selectedColors.includes(color.name)
            const isDark = parseInt(color.hex.slice(1, 3), 16) < 128
            const isGlitter = !!(color as any).glitter
            return (
              <button
                key={color.name}
                type="button"
                onClick={() => toggleColor(color.name)}
                title={color.name + (isGlitter ? ' (Glitter)' : '')}
                className="group relative flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-full rounded-[var(--radius-sm)] transition-all relative overflow-hidden"
                  style={{
                    aspectRatio: '1',
                    background: color.hex,
                    border: isSelected ? '2.5px solid #D4AF37' : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: isSelected ? '0 0 10px rgba(212,175,55,0.5)' : '0 1px 4px rgba(0,0,0,0.3)',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {/* Glitter shimmer overlay */}
                  {isGlitter && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 4px)',
                        mixBlendMode: 'overlay',
                      }}
                    />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-black" style={{ color: isDark ? '#fff' : '#000', textShadow: '0 0 4px rgba(0,0,0,0.5)' }}>✓</span>
                    </div>
                  )}
                  {isGlitter && !isSelected && (
                    <div className="absolute bottom-0.5 right-0.5">
                      <Sparkles className="h-2.5 w-2.5" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }} />
                    </div>
                  )}
                </div>
                <span className="text-[8px] text-cv-muted text-center leading-tight line-clamp-2 w-full">
                  {color.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Add to cart bar */}
        {selectedColors.length > 0 && (
          <div
            className="mt-5 flex items-center justify-between gap-4 p-4 rounded-[var(--radius-md)]"
            style={{ background: 'rgba(212,175,55,0.08)', border: '1.5px solid rgba(212,175,55,0.3)' }}
          >
            <div>
              <p className="text-sm font-bold">{selectedColors.length} color{selectedColors.length !== 1 ? 's' : ''} selected</p>
              <p className="text-xs text-cv-muted mt-0.5">
                {selectedSlabDef.label} slab · ${calcEach(selectedColors.length).toFixed(2)} each · <strong style={{ color: '#D4AF37' }}>${calcTotal(selectedColors.length).toFixed(2)} total</strong>
              </p>
              <div className="flex gap-1 flex-wrap mt-2">
                {selectedColors.map(name => {
                  const c = SLAB_COLORS.find(x => x.name === name)!
                  return (
                    <div key={name} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
                      {name}
                    </div>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={addToCart}
              className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-black transition"
              style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </button>
          </div>
        )}

        {/* Added flash */}
        {addedFlash && (
          <div className="mt-3 text-center text-sm font-semibold py-2 rounded-xl" style={{ background: 'rgba(78,203,160,0.12)', color: '#4ECBA0' }}>
            ✓ {addedFlash}
          </div>
        )}
      </div>

      {/* ── Step 3: Review Cart ── */}
      {cart.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-black text-black" style={{ background: '#D4AF37' }}>3</span>
            <h2 className="text-lg font-bold">Review Your Cart</h2>
          </div>
          <div className="glass rounded-[var(--radius-md)] overflow-hidden">
            {cart.map((item, idx) => {
              const slabLabel = SLAB_TYPES.find(s => s.id === item.slabType)?.label ?? item.slabType
              const isDark = parseInt(item.hex.slice(1, 3), 16) < 128
              return (
                <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="shrink-0 rounded-lg relative overflow-hidden" style={{ width: 40, height: 40, background: item.hex, border: '1.5px solid rgba(255,255,255,0.15)' }}>
                    {item.glitter && (
                      <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 4px)', mixBlendMode: 'overlay' }} />
                    )}
                    {item.glitter && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-4 w-4" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.color}{item.glitter ? ' ✦ Glitter' : ''}</p>
                    <p className="text-xs text-cv-muted">{slabLabel} slab</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => updateCartQty(idx, -1)} className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                    <button type="button" onClick={() => updateCartQty(idx, 1)} className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm font-bold shrink-0 w-14 text-right" style={{ color: '#D4AF37' }}>${calcTotal(item.qty).toFixed(2)}</p>
                  <button type="button" onClick={() => removeFromCart(idx)} className="shrink-0 ml-1" style={{ color: '#F06060' }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
            {/* Cart total + checkout */}
            <div className="px-4 py-4 flex items-center justify-between" style={{ background: 'rgba(212,175,55,0.05)', borderTop: '1px solid rgba(212,175,55,0.15)' }}>
              <div>
                <p className="text-sm text-cv-muted">{totalCartQty} guard{totalCartQty !== 1 ? 's' : ''} · ${calcEach(totalCartQty).toFixed(2)} each</p>
                <p className="text-xl font-black" style={{ color: '#D4AF37' }}>${totalCartPrice.toFixed(2)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCart(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-black transition"
                style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
              >
                <ShoppingCart className="h-4 w-4" />
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bundle pricing reference ── */}
      <div>
        <h2 className="text-lg font-bold mb-4">Bundle Pricing</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PRICE_TIERS.map(tier => (
            <div
              key={tier.label}
              className="glass rounded-[var(--radius-md)] p-4 flex flex-col gap-1.5"
              style={tier.best ? { border: '1.5px solid rgba(212,175,55,0.5)', background: 'rgba(212,175,55,0.06)' } : {}}
            >
              {tier.best && (
                <div className="flex items-center gap-1 mb-0.5">
                  <Star className="h-3 w-3" style={{ color: '#D4AF37' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#D4AF37' }}>Best Value</span>
                </div>
              )}
              <p className="text-sm font-bold">{tier.label}</p>
              <p className="text-xl font-black" style={{ color: tier.best ? '#D4AF37' : 'var(--text-primary)' }}>
                ${tier.each.toFixed(2)}<span className="text-xs font-medium text-cv-muted"> /ea</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Checkout modal ── */}
      {showCart && cart.length > 0 && (
        <CheckoutModal
          cart={cart}
          onClose={() => setShowCart(false)}
          onSuccess={() => { setCart([]); setShowCart(false) }}
        />
      )}
    </div>
  )
}
