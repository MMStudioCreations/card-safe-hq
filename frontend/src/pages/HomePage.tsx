import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import GlowLine from '../components/GlowLine'
import { useScrollReveal } from '../hooks/useScrollReveal'

// ─── HeroSection ─────────────────────────────────────────────────────────────
function HeroSection() {
  const visualRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!visualRef.current) return
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      visualRef.current.style.transform = `translate(${x * 20}px, ${y * 12}px)`
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [])

  const CARDS = [
    { name: 'Charizard ex', stat: '330 HP', type: 'FIRE', emoji: '🔥', grad: 'linear-gradient(160deg, #1a0800 0%, #3d1400 100%)', rot: -3, anim: 'floatA', delay: '0s' },
    { name: 'Black Lotus', stat: 'Legendary', type: 'MAGIC', emoji: '🌸', grad: 'linear-gradient(160deg, #080818 0%, #161640 100%)', rot: -1.5, anim: 'floatB', delay: '0.3s' },
    { name: 'Blue-Eyes Dragon', stat: '3000 ATK', type: 'YU-GI-OH', emoji: '⚡', grad: 'linear-gradient(160deg, #001420 0%, #002a50 100%)', rot: 0, anim: 'floatC', delay: '0.6s' },
  ]

  const GAMES = [
    { name: 'Pokémon TCG', dot: '#FFD700', glow: 'rgba(255,215,0,0.4)' },
    { name: 'Magic: The Gathering', dot: '#C62828', glow: 'rgba(198,40,40,0.4)' },
    { name: 'Yu-Gi-Oh!', dot: '#F59E0B', glow: 'rgba(245,158,11,0.4)' },
  ]

  return (
    <section
      style={{
        minHeight: '100vh', background: 'var(--black)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', paddingTop: 72,
      }}
    >
      {/* Radial gradient overlays */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 55% at 75% 25%, rgba(155,89,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 45% 45% at 85% 65%, rgba(0,200,255,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 35% 35% at 90% 10%, rgba(200,169,81,0.05) 0%, transparent 55%)', pointerEvents: 'none' }} />

      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '8%', right: '4%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(155,89,255,0.12)', filter: 'blur(60px)', animation: 'glowPulse 8s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '12%', right: '8%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,200,255,0.10)', filter: 'blur(60px)', animation: 'glowPulse 8s ease-in-out infinite 4s', pointerEvents: 'none' }} />

      <div className="relative mx-auto w-full px-6 md:px-12 py-24" style={{ maxWidth: 1280, zIndex: 1 }}>
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left content */}
          <div>
            <div className="flex items-center gap-3 mb-8" style={{ animation: 'fadeUp 0.6s ease 0.2s both' }}>
              <div style={{ width: 24, height: 1, background: 'var(--gold)' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                PREMIUM TCG PLATFORM
              </span>
              <div style={{ width: 24, height: 1, background: 'var(--gold)' }} />
            </div>

            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(52px, 7vw, 88px)',
                fontWeight: 600, lineHeight: 1.0,
                margin: '0 0 28px', color: 'var(--text)',
                animation: 'fadeUp 0.6s ease 0.35s both',
              }}
            >
              Build.<br />
              Protect.<br />
              <em style={{ WebkitTextStroke: '1.5px var(--gold)', WebkitTextFillColor: 'transparent', color: 'transparent', fontStyle: 'italic' }}>
                Dominate.
              </em>
            </h1>

            <p
              style={{
                fontSize: 17, fontWeight: 300, color: 'var(--text-mid)',
                maxWidth: 420, lineHeight: 1.75, margin: '0 0 40px',
                fontFamily: "'DM Sans', sans-serif",
                animation: 'fadeUp 0.6s ease 0.5s both',
              }}
            >
              The premium platform for serious collectors. Build championship decks, protect your rares, and dominate every format.
            </p>

            <div className="flex flex-wrap gap-3 mb-10" style={{ animation: 'fadeUp 0.6s ease 0.65s both' }}>
              <Link
                to="/builder"
                className="hoverable"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '14px 28px', borderRadius: 'var(--radius)',
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%)',
                  backgroundSize: '200% 100%',
                  color: '#06060A', fontWeight: 600, fontSize: 15,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'background-position 0.4s ease, transform 0.2s ease',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundPosition = '100% 0'; el.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundPosition = '0 0'; el.style.transform = 'translateY(0)' }}
              >
                Open Deck Builder →
              </Link>
              <Link
                to="/protection"
                className="hoverable"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '14px 28px', borderRadius: 'var(--radius)',
                  border: '1px solid rgba(200,169,81,0.35)',
                  color: 'var(--text)', fontSize: 15,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'border-color 0.2s, background 0.2s, transform 0.2s',
                  background: 'transparent',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--gold)'; el.style.background = 'rgba(200,169,81,0.06)'; el.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(200,169,81,0.35)'; el.style.background = 'transparent'; el.style.transform = 'translateY(0)' }}
              >
                Shop Protection
              </Link>
            </div>

            <div className="flex flex-wrap gap-2" style={{ animation: 'fadeUp 0.6s ease 0.8s both' }}>
              {GAMES.map(g => (
                <div key={g.name} className="flex items-center gap-2" style={{ padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.dot, boxShadow: `0 0 8px ${g.glow}`, flexShrink: 0, display: 'block' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-mid)', fontFamily: "'DM Sans', sans-serif" }}>{g.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right card stack */}
          <div className="hidden md:flex justify-center items-center" style={{ height: 500 }}>
            <div ref={visualRef} style={{ position: 'relative', width: 240, height: 330, transition: 'transform 0.1s ease-out' }}>
              {CARDS.map((card, i) => (
                <div
                  key={card.name}
                  style={{
                    position: 'absolute',
                    width: 210, height: 300,
                    top: i * 10, left: i * 8,
                    borderRadius: 16,
                    background: card.grad,
                    border: '1px solid rgba(200,169,81,0.2)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(200,169,81,0.07)',
                    animation: `${card.anim} 6s ease-in-out infinite ${card.delay}`,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 0%, rgba(200,169,81,0.04) 25%, rgba(155,89,255,0.07) 50%, rgba(0,200,255,0.05) 75%, transparent 100%)', backgroundSize: '200% 200%', animation: 'holoShift 4s linear infinite', borderRadius: 16 }} />
                  <div style={{ position: 'absolute', top: 12, left: 12, padding: '2px 8px', borderRadius: 99, background: 'rgba(200,169,81,0.12)', border: '1px solid rgba(200,169,81,0.25)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--gold)', fontFamily: "'DM Mono', monospace" }}>
                    {card.type}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '58%', fontSize: 52, paddingTop: 28 }}>{card.emoji}</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>{card.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{card.stat}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── StatsBar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const ref = useScrollReveal()
  const STATS = [
    { num: '20K+', label: 'Cards in Database' },
    { num: '3',    label: 'Supported Games' },
    { num: 'AI',   label: 'Powered Scanner' },
    { num: '100%', label: 'Offline Ready' },
  ]
  return (
    <section ref={ref} style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="mx-auto px-6" style={{ maxWidth: 1280 }}>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center py-8"
              style={{
                borderRight: i < STATS.length - 1 ? '1px solid var(--border)' : 'none',
                animation: `fadeUp 0.5s ease ${0.1 * i}s both`,
              }}
            >
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{s.num}</span>
              <span style={{ fontSize: 12, letterSpacing: '0.06em', color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", marginTop: 8, textTransform: 'uppercase' as const }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── DeckBuilderSection ──────────────────────────────────────────────────────
function DeckBuilderSection() {
  const ref = useScrollReveal()
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const [hoveredMini, setHoveredMini] = useState<number | null>(null)

  const FEATURES = [
    { icon: '⚡', title: 'Real-Time Synergy Engine', desc: 'Find the perfect card combos automatically' },
    { icon: '🔄', title: 'Rotation & Format Legality', desc: 'Always know if your deck is tournament-legal' },
    { icon: '📊', title: 'Statistical Draw Probability', desc: 'See the math behind your win conditions' },
    { icon: '☁️', title: 'Instant Export & Share', desc: 'Share your deck with a single click' },
  ]

  const MINI_GRADS = [
    'linear-gradient(160deg, #1a0800, #3d1400)',
    'linear-gradient(160deg, #001420, #002a50)',
    'linear-gradient(160deg, #0a0018, #1a0040)',
    'linear-gradient(160deg, #001800, #002800)',
    'linear-gradient(160deg, #1a0014, #3d0030)',
  ]

  return (
    <section ref={ref} style={{ background: 'var(--deep)', padding: '96px 0' }}>
      <div className="mx-auto px-6 md:px-12" style={{ maxWidth: 1280 }}>
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div style={{ width: 24, height: 2, background: 'var(--gold)' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>ADVANCED BUILDER</span>
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 600, lineHeight: 1.1, color: 'var(--text)', margin: '0 0 20px' }}>
              Your deck, engineered to win.
            </h2>
            <p style={{ fontSize: 16, fontWeight: 300, color: 'var(--text-mid)', lineHeight: 1.75, margin: '0 0 40px', fontFamily: "'DM Sans', sans-serif" }}>
              Powered by AI and real tournament data, the builder gives you every edge — from synergy analysis to format legality checks.
            </p>

            <div className="flex flex-col gap-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="hoverable"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '16px 18px', borderRadius: 'var(--radius)',
                    background: 'rgba(255,255,255,0.02)',
                    border: hoveredFeature === i ? '1px solid var(--border-glow)' : '1px solid var(--border)',
                    transition: 'transform 0.25s ease, border-color 0.25s ease',
                    transform: hoveredFeature === i ? 'translateX(6px)' : 'translateX(0)',
                    cursor: 'default',
                  }}
                  onMouseEnter={() => setHoveredFeature(i)}
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>{f.title}</div>
                    <div style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: UI mockup */}
          <div className="hidden md:block">
            <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
              <div style={{ height: 2, background: 'linear-gradient(90deg, var(--gold), var(--holo-purple), var(--holo-blue))' }} />
              <div style={{ background: '#0d0d16', padding: '14px 16px 20px' }}>
                {/* Traffic lights + URL */}
                <div className="flex items-center gap-2 mb-4">
                  {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.75 }} />
                  ))}
                  <div style={{ flex: 1, marginLeft: 8, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontSize: 10, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>
                    cardsafehq.com/builder
                  </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  {['Pokémon', 'MTG', 'Yu-Gi-Oh!'].map((tab, i) => (
                    <div key={tab} style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontFamily: "'DM Sans', sans-serif", background: i === 0 ? 'var(--gold-dim)' : 'rgba(255,255,255,0.04)', color: i === 0 ? 'var(--gold)' : 'var(--text-dim)', border: i === 0 ? '1px solid rgba(200,169,81,0.3)' : '1px solid transparent' }}>
                      {tab}
                    </div>
                  ))}
                </div>
                {/* Search bar */}
                <div className="flex items-center gap-2 mb-4" style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>Search for cards...</span>
                  <span style={{ fontSize: 12, color: 'var(--gold)', animation: 'blink 1s step-start infinite' }}>|</span>
                </div>
                {/* Mini card grid */}
                <div className="flex gap-2 mb-4">
                  {MINI_GRADS.map((grad, i) => (
                    <div
                      key={i}
                      className="hoverable"
                      style={{
                        flex: 1, aspectRatio: '2/3',
                        borderRadius: 6,
                        background: grad,
                        border: '1px solid rgba(255,255,255,0.07)',
                        overflow: 'hidden', position: 'relative',
                        transition: 'transform 0.2s ease',
                        transform: hoveredMini === i ? 'scale(1.08) translateY(-4px)' : 'scale(1)',
                        cursor: 'default',
                      }}
                      onMouseEnter={() => setHoveredMini(i)}
                      onMouseLeave={() => setHoveredMini(null)}
                    >
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 30%, rgba(200,169,81,0.05) 50%, transparent 70%)', backgroundSize: '200% 200%', animation: hoveredMini === i ? 'holoShift 1.5s linear infinite' : 'none', opacity: hoveredMini === i ? 1 : 0, transition: 'opacity 0.2s ease' }} />
                    </div>
                  ))}
                </div>
                {/* Info rows */}
                {[['Deck Size', '60'], ['Format', 'Standard'], ['Consistency Score', 'A+']].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2" style={{ borderTop: '1px solid var(--border)', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                    <span style={{ color: 'var(--text-dim)' }}>{k}</span>
                    <span style={{ color: 'var(--gold)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── MarqueeBanner ───────────────────────────────────────────────────────────
function MarqueeBanner() {
  const BRANDS = ['Dragon Shield', 'Ultra Pro', 'KMC Hyper Matte', 'Arcane Tinmen', 'BCW', 'Vault X', 'PSA', 'Pro-Mold']
  const items = [...BRANDS, ...BRANDS]

  return (
    <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '18px 0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', animation: 'marquee 25s linear infinite', width: 'max-content' }}>
        {items.map((brand, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12, letterSpacing: '0.10em', color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif" }}>
              {brand}
            </span>
            <span style={{ margin: '0 24px', width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)', opacity: 0.5, display: 'inline-block', verticalAlign: 'middle' }} />
          </span>
        ))}
      </div>
    </section>
  )
}

// ─── ProtectionGearSection ───────────────────────────────────────────────────
function ProtectionGearSection() {
  const ref = useScrollReveal()
  const [hoveredCat, setHoveredCat] = useState<number | null>(null)
  const [hoveredProd, setHoveredProd] = useState<number | null>(null)

  const CATEGORIES = [
    { icon: '🛡️', name: 'Sleeves', count: 8 },
    { icon: '📚', name: 'Binders & Albums', count: 6 },
    { icon: '🔒', name: 'Top Loaders', count: 4 },
    { icon: '⭐', name: 'Grading Supplies', count: 12 },
  ]

  const PRODUCTS = [
    { emoji: '🛡️', name: 'Silicone Slab Guard', type: 'PSA / BGS / CGC', price: 5.00, badge: 'HOT' },
    { emoji: '🔒', name: 'Top Loader — 35pt', type: 'Rigid Protection', price: 4.99, badge: null },
    { emoji: '📚', name: 'Premium 9-Pocket Binder', type: '360-Card Capacity', price: 24.99, badge: 'NEW' },
    { emoji: '🧤', name: 'Penny Sleeves (100pk)', type: 'Standard Size', price: 2.99, badge: null },
    { emoji: '🏆', name: 'Grading Submission Kit', type: 'PSA / CGC Ready', price: 14.99, badge: 'NEW' },
    { emoji: '📦', name: 'Enclosed Slab Case', type: 'Magnetic Closure', price: 12.99, badge: null },
  ]

  return (
    <section ref={ref} style={{ background: 'var(--black)', padding: '96px 0' }}>
      <div className="mx-auto px-6 md:px-12" style={{ maxWidth: 1280 }}>
        {/* Header */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: 24, height: 2, background: 'var(--gold)' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>GEAR UP</span>
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>
              Guard every rare you own.
            </h2>
          </div>
          <Link
            to="/protection"
            className="hidden md:flex items-center hoverable"
            style={{ color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, gap: 6, transition: 'gap 0.2s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.gap = '12px')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.gap = '6px')}
          >
            View All Products →
          </Link>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {CATEGORIES.map((cat, i) => (
            <div
              key={cat.name}
              className="hoverable"
              style={{
                padding: '20px', borderRadius: 'var(--radius)',
                background: hoveredCat === i ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
                border: hoveredCat === i ? '1px solid var(--gold)' : '1px solid var(--border)',
                transition: 'transform 0.25s ease, border-color 0.25s ease, background 0.25s ease',
                transform: hoveredCat === i ? 'translateY(-6px)' : 'translateY(0)',
                cursor: 'default', position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={() => setHoveredCat(i)}
              onMouseLeave={() => setHoveredCat(null)}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--gold), var(--gold-light))', opacity: hoveredCat === i ? 1 : 0, transition: 'opacity 0.25s ease' }} />
              <div style={{ fontSize: 28, marginBottom: 10 }}>{cat.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{cat.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>{cat.count} products</div>
              <span style={{ position: 'absolute', right: 16, bottom: 20, opacity: hoveredCat === i ? 1 : 0, transition: 'opacity 0.2s ease', color: 'var(--gold)', fontSize: 14 }}>→</span>
            </div>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {PRODUCTS.map((prod, i) => (
            <div
              key={prod.name}
              className="hoverable"
              style={{
                borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)', overflow: 'hidden',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                transform: hoveredProd === i ? 'translateY(-8px)' : 'translateY(0)',
                boxShadow: hoveredProd === i
                  ? '0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,169,81,0.2), 0 0 20px rgba(200,169,81,0.08)'
                  : '0 4px 16px rgba(0,0,0,0.3)',
                cursor: 'default',
              }}
              onMouseEnter={() => setHoveredProd(i)}
              onMouseLeave={() => setHoveredProd(null)}
            >
              {/* Image area */}
              <div style={{ height: 120, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, position: 'relative', overflow: 'hidden' }}>
                {prod.emoji}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 30%, rgba(200,169,81,0.06) 50%, transparent 70%)', backgroundSize: '200% 200%', animation: hoveredProd === i ? 'holoShift 2s linear infinite' : 'none', opacity: hoveredProd === i ? 1 : 0, transition: 'opacity 0.25s ease' }} />
                {prod.badge && (
                  <div style={{ position: 'absolute', top: 10, left: 10, padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', background: prod.badge === 'HOT' ? 'rgba(255,61,180,0.2)' : 'rgba(200,169,81,0.2)', color: prod.badge === 'HOT' ? 'var(--holo-pink)' : 'var(--gold)' }}>
                    {prod.badge}
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", marginBottom: 3 }}>{prod.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>{prod.type}</div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>${prod.price.toFixed(2)}</span>
                  <Link
                    to="/protection"
                    className="hoverable flex items-center justify-center"
                    style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 18, transition: 'background 0.2s, color 0.2s, border-color 0.2s' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--gold)'; el.style.color = '#06060A'; el.style.borderColor = 'var(--gold)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--text-dim)'; el.style.borderColor = 'var(--border)' }}
                  >
                    +
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── WhySection ──────────────────────────────────────────────────────────────
function WhySection() {
  const ref = useScrollReveal()
  const WHY = [
    { num: '01', title: 'Native-Speed Search', desc: 'Instant lookup across 20,000+ cards with real-time market pricing from eBay and PriceCharting.' },
    { num: '02', title: 'AI Card Scanning', desc: 'Claude Vision identifies every card in your binder in seconds — no manual entry required.' },
    { num: '03', title: 'Live Price Intelligence', desc: 'Market comps updated daily. Know exactly what your collection is worth at any moment.' },
  ]

  return (
    <section ref={ref} id="about" style={{ background: 'var(--deep)' }}>
      <div className="mx-auto" style={{ maxWidth: 1280 }}>
        <div className="grid md:grid-cols-3" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          {WHY.map((item, i) => (
            <div
              key={item.num}
              style={{
                padding: '48px 40px',
                borderRight: i < WHY.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.25s ease',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 64, fontWeight: 300, WebkitTextStroke: '1px rgba(200,169,81,0.3)', WebkitTextFillColor: 'transparent', color: 'transparent', lineHeight: 1, marginBottom: 20 }}>
                {item.num}
              </div>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>{item.title}</div>
              <div style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTASection ──────────────────────────────────────────────────────────────
function CTASection() {
  const ref = useScrollReveal()
  return (
    <section ref={ref} style={{ background: 'var(--black)', padding: '112px 0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(200,169,81,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div className="mx-auto px-6 text-center" style={{ maxWidth: 720, position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(40px, 6vw, 80px)', fontWeight: 600, lineHeight: 1.1, color: 'var(--text)', margin: '0 0 20px' }}>
          The collector's edge{' '}
          <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>starts here.</em>
        </h2>
        <p style={{ fontSize: 17, fontWeight: 300, color: 'var(--text-mid)', lineHeight: 1.75, margin: '0 0 44px', fontFamily: "'DM Sans', sans-serif" }}>
          Everything you need to build, protect, and grow your collection — in one platform.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/builder"
            className="hoverable"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%)',
              backgroundSize: '200% 100%',
              color: '#06060A', fontWeight: 600, fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'background-position 0.4s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundPosition = '100% 0'; el.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundPosition = '0 0'; el.style.transform = 'translateY(0)' }}
          >
            Build Your First Deck →
          </Link>
          <Link
            to="/protection"
            className="hoverable"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 'var(--radius)',
              border: '1px solid rgba(200,169,81,0.35)',
              color: 'var(--text)', fontSize: 15,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'border-color 0.2s, background 0.2s',
              background: 'transparent',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--gold)'; el.style.background = 'rgba(200,169,81,0.06)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(200,169,81,0.35)'; el.style.background = 'transparent' }}
          >
            Shop Gear
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── HomeFooter ──────────────────────────────────────────────────────────────
function HomeFooter() {
  const COLS = [
    {
      head: 'Platform',
      links: [{ to: '/builder', label: 'Deck Builder' }, { to: '/protection', label: 'Card Protection' }, { to: '/membership', label: 'Pricing' }],
    },
    {
      head: 'Protection',
      links: [{ to: '/protection', label: 'Slab Guards' }, { to: '/protection', label: 'Sleeves' }, { to: '/protection', label: 'Binders' }, { to: '/protection', label: 'Top Loaders' }],
    },
    {
      head: 'Games',
      links: [{ to: '/builder', label: 'Pokémon TCG' }, { to: '/builder', label: 'Magic: The Gathering' }, { to: '/builder', label: 'Yu-Gi-Oh!' }],
    },
  ]

  return (
    <footer style={{ background: 'var(--deep)', borderTop: '1px solid var(--border)', padding: '64px 0 32px' }}>
      <div className="mx-auto px-6 md:px-12" style={{ maxWidth: 1280 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-5 hoverable">
              <div className="flex items-center justify-center rounded font-bold" style={{ width: 32, height: 32, background: 'var(--gold)', color: '#06060A', fontSize: 12, fontFamily: "'Cormorant Garamond', serif", fontWeight: 700 }}>CS</div>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>CardSafe HQ</span>
            </Link>
            <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-dim)', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", maxWidth: 220 }}>
              The premium platform for serious TCG collectors.
            </p>
          </div>
          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.head}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", marginBottom: 16, textTransform: 'uppercase' as const }}>
                {col.head}
              </div>
              <div className="flex flex-col gap-3">
                {col.links.map(link => (
                  <Link
                    key={link.label + link.to}
                    to={link.to}
                    className="hoverable"
                    style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", transition: 'color 0.2s' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>
            © {new Date().getFullYear()} CardSafe HQ. All rights reserved.
          </p>
          <div className="flex items-center gap-6 mt-4 sm:mt-0">
            {['Privacy', 'Terms', 'Contact'].map(item => (
              <Link
                key={item}
                to="/"
                className="hoverable"
                style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'DM Sans', sans-serif", transition: 'color 0.2s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-dim)')}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Default Export ──────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div style={{ background: 'var(--black)', color: 'var(--text)', overflowX: 'hidden' }}>
      <Navbar />
      <HeroSection />
      <GlowLine />
      <StatsBar />
      <GlowLine />
      <DeckBuilderSection />
      <GlowLine />
      <MarqueeBanner />
      <GlowLine />
      <ProtectionGearSection />
      <GlowLine />
      <WhySection />
      <GlowLine />
      <CTASection />
      <HomeFooter />
    </div>
  )
}
