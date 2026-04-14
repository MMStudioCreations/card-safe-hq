import { useState } from 'react'
import { ShoppingBag, Shield, Package, Star, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

// ── 61 silicone slab guard colors ─────────────────────────────────────────────
const SLAB_COLORS = [
  // Classics
  { name: 'Obsidian Black', hex: '#111111', category: 'Classic' },
  { name: 'Pristine White', hex: '#F5F5F5', category: 'Classic' },
  { name: 'Vault Grey', hex: '#5A5A5A', category: 'Classic' },
  { name: 'Smoke', hex: '#9E9E9E', category: 'Classic' },
  { name: 'Charcoal', hex: '#3C3C3C', category: 'Classic' },
  // Golds & Metallics
  { name: 'Gem Mint Gold', hex: '#D4AF37', category: 'Metallic' },
  { name: 'Champagne', hex: '#F7E7CE', category: 'Metallic' },
  { name: 'Rose Gold', hex: '#B76E79', category: 'Metallic' },
  { name: 'Silver Chrome', hex: '#C0C0C0', category: 'Metallic' },
  { name: 'Bronze', hex: '#CD7F32', category: 'Metallic' },
  // Blues
  { name: 'Collector Blue', hex: '#0047AB', category: 'Blue' },
  { name: 'Ocean', hex: '#006994', category: 'Blue' },
  { name: 'Sky', hex: '#87CEEB', category: 'Blue' },
  { name: 'Navy', hex: '#001F5B', category: 'Blue' },
  { name: 'Teal', hex: '#008080', category: 'Blue' },
  { name: 'Aqua', hex: '#00FFFF', category: 'Blue' },
  { name: 'Slate Blue', hex: '#6A5ACD', category: 'Blue' },
  // Reds & Pinks
  { name: 'Crimson', hex: '#DC143C', category: 'Red' },
  { name: 'Scarlet', hex: '#FF2400', category: 'Red' },
  { name: 'Coral', hex: '#FF6B6B', category: 'Red' },
  { name: 'Hot Pink', hex: '#FF69B4', category: 'Red' },
  { name: 'Bubblegum', hex: '#FFC1CC', category: 'Red' },
  { name: 'Magenta', hex: '#FF00FF', category: 'Red' },
  // Greens
  { name: 'Emerald', hex: '#50C878', category: 'Green' },
  { name: 'Forest', hex: '#228B22', category: 'Green' },
  { name: 'Mint', hex: '#98FF98', category: 'Green' },
  { name: 'Lime', hex: '#32CD32', category: 'Green' },
  { name: 'Olive', hex: '#808000', category: 'Green' },
  { name: 'Sage', hex: '#BCB88A', category: 'Green' },
  { name: 'Hunter Green', hex: '#355E3B', category: 'Green' },
  // Purples
  { name: 'Royal Purple', hex: '#7851A9', category: 'Purple' },
  { name: 'Lavender', hex: '#E6E6FA', category: 'Purple' },
  { name: 'Violet', hex: '#8B00FF', category: 'Purple' },
  { name: 'Plum', hex: '#DDA0DD', category: 'Purple' },
  { name: 'Grape', hex: '#6F2DA8', category: 'Purple' },
  { name: 'Lilac', hex: '#C8A2C8', category: 'Purple' },
  // Oranges & Yellows
  { name: 'Sunset Orange', hex: '#FF4500', category: 'Orange' },
  { name: 'Tangerine', hex: '#F28500', category: 'Orange' },
  { name: 'Amber', hex: '#FFBF00', category: 'Orange' },
  { name: 'Canary Yellow', hex: '#FFFF00', category: 'Orange' },
  { name: 'Lemon', hex: '#FFF44F', category: 'Orange' },
  { name: 'Peach', hex: '#FFCBA4', category: 'Orange' },
  // Browns & Earth
  { name: 'Chocolate', hex: '#7B3F00', category: 'Earth' },
  { name: 'Caramel', hex: '#C68642', category: 'Earth' },
  { name: 'Tan', hex: '#D2B48C', category: 'Earth' },
  { name: 'Sand', hex: '#F4A460', category: 'Earth' },
  { name: 'Mocha', hex: '#6F4E37', category: 'Earth' },
  // Neons & Special
  { name: 'Neon Green', hex: '#39FF14', category: 'Special' },
  { name: 'Neon Pink', hex: '#FF6EC7', category: 'Special' },
  { name: 'Neon Blue', hex: '#1F51FF', category: 'Special' },
  { name: 'Neon Orange', hex: '#FF6700', category: 'Special' },
  { name: 'Electric Yellow', hex: '#FFFF33', category: 'Special' },
  { name: 'Glow White', hex: '#FAFAFA', category: 'Special' },
  // Translucent / Clear
  { name: 'Crystal Clear', hex: '#E8F4F8', category: 'Clear' },
  { name: 'Smoke Clear', hex: '#B0C4DE', category: 'Clear' },
  { name: 'Tinted Blue', hex: '#ADD8E6', category: 'Clear' },
  { name: 'Tinted Red', hex: '#FFB6C1', category: 'Clear' },
  { name: 'Tinted Green', hex: '#90EE90', category: 'Clear' },
  // PSA / Grading Inspired
  { name: 'PSA Red', hex: '#C8102E', category: 'Grading' },
  { name: 'BGS Blue', hex: '#003087', category: 'Grading' },
  { name: 'CGC Purple', hex: '#5B2D8E', category: 'Grading' },
]

const CATEGORIES = ['All', ...Array.from(new Set(SLAB_COLORS.map(c => c.category)))]

const PRICING = [
  { label: '1 Guard', price: '$5.00', highlight: false, desc: 'Single slab guard, any color' },
  { label: '2 Guards', price: '$9.00', highlight: false, desc: 'Mix & match any 2 colors' },
  { label: '3 Guards', price: '$12.00', highlight: true, desc: 'Best value — mix any 3 colors' },
  { label: '5 Guards', price: '$19.00', highlight: false, desc: 'Build a color-matched set' },
  { label: '10 Guards', price: '$35.00', highlight: false, desc: 'Full collector bundle' },
]

const FAQS = [
  {
    q: 'What slabs do these fit?',
    a: 'Our silicone guards are designed to fit PSA, BGS/Beckett, CGC, and SGC standard graded card slabs. They provide a snug, protective fit without stretching or distorting the slab.',
  },
  {
    q: 'Will the guard scratch my slab?',
    a: 'No. The silicone material is soft, flexible, and non-abrasive. It actually protects the slab from scratches, dings, and surface scuffs during transport and storage.',
  },
  {
    q: 'Can I mix colors in a bundle?',
    a: 'Absolutely — all bundle pricing allows you to mix and match any colors from our full 61-color lineup.',
  },
  {
    q: 'How do I order?',
    a: 'Currently available in-person at card shows and via direct message on our social channels. Online ordering is coming soon.',
  },
  {
    q: 'Do you offer wholesale or bulk pricing?',
    a: 'Yes. For dealers, LGS owners, or bulk orders of 50+ units, contact us directly for wholesale pricing.',
  },
]

export default function ShopPage() {
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const filteredColors = categoryFilter === 'All'
    ? SLAB_COLORS
    : SLAB_COLORS.filter(c => c.category === categoryFilter)

  function toggleColor(name: string) {
    setSelectedColors(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function getBundlePrice(): string {
    const n = selectedColors.length
    if (n === 0) return ''
    if (n === 1) return '$5.00'
    if (n === 2) return '$9.00'
    if (n === 3) return '$12.00'
    if (n <= 5) return `$${(n * 3.80).toFixed(2)}`
    return `$${(n * 3.50).toFixed(2)}`
  }

  return (
    <div className="space-y-8 page-enter pb-8">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] p-8"
        style={{
          background: 'linear-gradient(135deg, #0A0A0C 0%, #1A1408 50%, #0A0A0C 100%)',
          border: '1px solid rgba(212,175,55,0.25)',
        }}
      >
        {/* Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 60% 50%, rgba(212,175,55,0.08) 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5" style={{ color: '#D4AF37' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D4AF37' }}>
                Card Safe HQ Originals
              </span>
            </div>
            <h1 className="text-3xl font-black mb-2">Silicone Slab Guards</h1>
            <p className="text-cv-muted text-sm max-w-md">
              Premium silicone protection for your graded slabs. Available in <strong className="text-white">61 colors</strong> — mix, match, and protect your most valuable cards in style.
            </p>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span
                className="px-3 py-1.5 rounded-full text-sm font-bold"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                From $5 each
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(78,203,160,0.12)', color: '#4ECBA0' }}>
                Fits PSA · BGS · CGC · SGC
              </span>
              <span className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                61 Colors Available
              </span>
            </div>
          </div>
          <div
            className="shrink-0 flex items-center justify-center rounded-[var(--radius-lg)]"
            style={{ width: 120, height: 120, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <Shield className="h-14 w-14" style={{ color: '#D4AF37', opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* ── Pricing tiers ── */}
      <div>
        <h2 className="text-lg font-bold mb-4">Bundle Pricing</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PRICING.map(tier => (
            <div
              key={tier.label}
              className="glass rounded-[var(--radius-md)] p-4 flex flex-col gap-1.5"
              style={tier.highlight ? {
                border: '1.5px solid rgba(212,175,55,0.5)',
                background: 'rgba(212,175,55,0.06)',
              } : {}}
            >
              {tier.highlight && (
                <div className="flex items-center gap-1 mb-0.5">
                  <Star className="h-3 w-3" style={{ color: '#D4AF37' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#D4AF37' }}>Best Value</span>
                </div>
              )}
              <p className="text-sm font-bold">{tier.label}</p>
              <p className="text-2xl font-black" style={{ color: tier.highlight ? '#D4AF37' : 'var(--text-primary)' }}>
                {tier.price}
              </p>
              <p className="text-[11px] text-cv-muted leading-snug">{tier.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Color picker ── */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold">Choose Your Colors</h2>
            <p className="text-xs text-cv-muted mt-0.5">
              {selectedColors.length === 0
                ? 'Tap any color to select it'
                : `${selectedColors.length} selected${getBundlePrice() ? ` · ${getBundlePrice()}` : ''}`}
            </p>
          </div>
          {selectedColors.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedColors([])}
              className="text-xs text-cv-muted hover:text-white transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 flex-wrap mb-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1 rounded-full text-xs font-medium transition"
              style={categoryFilter === cat
                ? { background: 'var(--primary)', color: '#0A0A0C' }
                : { background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Color grid */}
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {filteredColors.map(color => {
            const isSelected = selectedColors.includes(color.name)
            const isDark = parseInt(color.hex.slice(1, 3), 16) < 128
            return (
              <button
                key={color.name}
                type="button"
                onClick={() => toggleColor(color.name)}
                title={color.name}
                className="group relative flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-full rounded-[var(--radius-sm)] transition-all"
                  style={{
                    aspectRatio: '1',
                    background: color.hex,
                    border: isSelected
                      ? '2.5px solid #D4AF37'
                      : '1.5px solid rgba(255,255,255,0.12)',
                    boxShadow: isSelected
                      ? '0 0 10px rgba(212,175,55,0.5)'
                      : '0 1px 4px rgba(0,0,0,0.3)',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="text-xs font-black"
                        style={{ color: isDark ? '#fff' : '#000', textShadow: '0 0 4px rgba(0,0,0,0.5)' }}
                      >
                        ✓
                      </span>
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

        {/* Selected summary */}
        {selectedColors.length > 0 && (
          <div
            className="mt-5 rounded-[var(--radius-md)] p-4 flex flex-wrap items-center justify-between gap-3"
            style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            <div>
              <p className="text-sm font-bold">Your Selection</p>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {selectedColors.map(name => {
                  const color = SLAB_COLORS.find(c => c.name === name)
                  return (
                    <div
                      key={name}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: color?.hex ?? '#888', border: '1px solid rgba(255,255,255,0.2)' }}
                      />
                      {name}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-cv-muted">Bundle Price</p>
              <p className="text-2xl font-black" style={{ color: '#D4AF37' }}>{getBundlePrice()}</p>
              <p className="text-xs text-cv-muted mt-0.5">Available at shows · DM to order</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Features ── */}
      <div>
        <h2 className="text-lg font-bold mb-4">Why Collectors Choose Our Guards</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              icon: Shield,
              title: 'Scratch & Ding Protection',
              desc: 'Soft silicone absorbs impact and prevents surface scratches on your graded slabs during storage and transport.',
            },
            {
              icon: Package,
              title: 'Universal Slab Fit',
              desc: 'Precision-fit for PSA, BGS, CGC, and SGC standard graded card slabs. Snug without stretching.',
            },
            {
              icon: Star,
              title: '61 Colors to Collect',
              desc: 'Color-code by game, grade, or player. Mix and match to build a display that reflects your collection.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass rounded-[var(--radius-md)] p-5 space-y-2">
              <div
                className="h-9 w-9 rounded-[var(--radius-sm)] flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.12)' }}
              >
                <Icon className="h-5 w-5" style={{ color: '#D4AF37' }} />
              </div>
              <p className="font-bold text-sm">{title}</p>
              <p className="text-xs text-cv-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div>
        <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="glass rounded-[var(--radius-md)] overflow-hidden"
              style={{ border: openFaq === i ? '1px solid rgba(212,175,55,0.25)' : '' }}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-semibold">{faq.q}</span>
                {openFaq === i
                  ? <ChevronUp className="h-4 w-4 text-cv-muted shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-cv-muted shrink-0" />
                }
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-cv-muted leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div
        className="rounded-[var(--radius-lg)] p-6 text-center space-y-3"
        style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0.04) 100%)', border: '1px solid rgba(212,175,55,0.2)' }}
      >
        <ShoppingBag className="h-8 w-8 mx-auto" style={{ color: '#D4AF37' }} />
        <h3 className="text-lg font-bold">Find Us at Card Shows</h3>
        <p className="text-sm text-cv-muted max-w-md mx-auto">
          Card Safe HQ attends local and regional card shows. Come see all 61 colors in person, try them on your slabs, and take home your favorites.
        </p>
        <div className="flex gap-3 justify-center flex-wrap pt-1">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
          >
            Follow for Show Dates
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="mailto:hello@cardsafehq.com"
            className="btn-ghost flex items-center gap-2 text-sm px-5 py-2.5"
          >
            Contact for Bulk Orders
          </a>
        </div>
      </div>
    </div>
  )
}
