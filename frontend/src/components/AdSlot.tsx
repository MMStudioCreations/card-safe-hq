/**
 * AdSlot — Revenue-ready ad placement component
 *
 * HOW TO ACTIVATE ADS:
 * 1. Set VITE_ADS_ENABLED=true in your .env (or Cloudflare Pages env vars)
 * 2. Set VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX with your AdSense publisher ID
 * 3. Add the AdSense script tag to index.html (see comment below)
 * 4. Deploy — ads will begin rendering immediately
 *
 * SUPPORTED NETWORKS:
 * - Google AdSense (default, via data-ad-client / data-ad-slot)
 * - Custom direct-sold banners (set adNetwork="custom" and pass imageUrl + linkUrl)
 * - House ads / self-promotion (set adNetwork="house")
 *
 * PLACEMENT SIZES:
 * - "banner"      → 728×90  (leaderboard, desktop top/bottom)
 * - "rectangle"   → 300×250 (medium rectangle, sidebar / in-feed)
 * - "mobile"      → 320×50  (mobile banner)
 * - "large"       → 970×250 (billboard, homepage hero)
 *
 * INDEX.HTML SNIPPET (add inside <head> when activating):
 * <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
 */

import { useEffect, useRef } from 'react'

// ── Feature flag ──────────────────────────────────────────────────────────────
// Ads are completely hidden until VITE_ADS_ENABLED is set to "true"
const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === 'true'
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT ?? ''

// ── Size map ──────────────────────────────────────────────────────────────────
const SIZE_MAP: Record<string, { width: number; height: number; adFormat?: string }> = {
  banner:    { width: 728, height: 90 },
  rectangle: { width: 300, height: 250 },
  mobile:    { width: 320, height: 50 },
  large:     { width: 970, height: 250 },
  responsive: { width: 0, height: 0, adFormat: 'auto' },
}

// ── Types ─────────────────────────────────────────────────────────────────────
type AdSize = keyof typeof SIZE_MAP

type AdNetwork = 'adsense' | 'custom' | 'house'

interface AdSlotProps {
  /** Placement size preset */
  size?: AdSize
  /** AdSense data-ad-slot ID (e.g. "1234567890") */
  adSlotId?: string
  /** Ad network to use */
  adNetwork?: AdNetwork
  /** For custom/house ads: image URL */
  imageUrl?: string
  /** For custom/house ads: click-through URL */
  linkUrl?: string
  /** For custom/house ads: alt text */
  altText?: string
  /** Optional label shown above the ad */
  label?: string
  /** Additional CSS class names */
  className?: string
}

// ── AdSense unit ──────────────────────────────────────────────────────────────
function AdSenseUnit({ size, adSlotId }: { size: AdSize; adSlotId: string }) {
  const ref = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!pushed.current && ref.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
        pushed.current = true
      } catch {
        // AdSense not loaded yet — will retry on next render
      }
    }
  }, [])

  const { width, height, adFormat } = SIZE_MAP[size] ?? SIZE_MAP.rectangle

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', width: width || '100%', height: height || 'auto' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={adSlotId}
      data-ad-format={adFormat ?? undefined}
      data-full-width-responsive={adFormat === 'auto' ? 'true' : undefined}
    />
  )
}

// ── Custom / House ad unit ────────────────────────────────────────────────────
function CustomAdUnit({
  size, imageUrl, linkUrl, altText,
}: {
  size: AdSize; imageUrl: string; linkUrl: string; altText?: string
}) {
  const { width, height } = SIZE_MAP[size] ?? SIZE_MAP.rectangle
  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      style={{ display: 'block', width, height, overflow: 'hidden', borderRadius: 8 }}
    >
      <img
        src={imageUrl}
        alt={altText ?? 'Advertisement'}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        loading="lazy"
      />
    </a>
  )
}

// ── Main AdSlot component ─────────────────────────────────────────────────────
export default function AdSlot({
  size = 'rectangle',
  adSlotId = '',
  adNetwork = 'adsense',
  imageUrl,
  linkUrl,
  altText,
  label = 'Advertisement',
  className = '',
}: AdSlotProps) {
  // ── FEATURE FLAG: render nothing when ads are disabled ──
  if (!ADS_ENABLED) return null

  const { width, height } = SIZE_MAP[size] ?? SIZE_MAP.rectangle

  return (
    <div
      className={`ad-slot ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        margin: '8px 0',
      }}
      aria-label="Advertisement"
    >
      {label && (
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          {label}
        </p>
      )}

      <div
        style={{
          width: width || '100%',
          minHeight: height || 50,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {adNetwork === 'adsense' && adSlotId && ADSENSE_CLIENT && (
          <AdSenseUnit size={size} adSlotId={adSlotId} />
        )}
        {(adNetwork === 'custom' || adNetwork === 'house') && imageUrl && linkUrl && (
          <CustomAdUnit size={size} imageUrl={imageUrl} linkUrl={linkUrl} altText={altText} />
        )}
        {/* Fallback: empty placeholder (should never be visible in production) */}
        {adNetwork === 'adsense' && (!adSlotId || !ADSENSE_CLIENT) && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>Ad</span>
        )}
      </div>
    </div>
  )
}

/**
 * USAGE EXAMPLES:
 *
 * // AdSense rectangle (in-feed between portfolio cards)
 * <AdSlot size="rectangle" adSlotId="1234567890" />
 *
 * // AdSense responsive banner (top of search page)
 * <AdSlot size="responsive" adSlotId="0987654321" />
 *
 * // Custom direct-sold banner (card show sponsor)
 * <AdSlot
 *   adNetwork="custom"
 *   size="banner"
 *   imageUrl="https://cdn.example.com/sponsor-banner.jpg"
 *   linkUrl="https://sponsor.example.com"
 *   altText="Sponsored by CardShop Pro"
 * />
 *
 * // House ad (promote your own slab guards)
 * <AdSlot
 *   adNetwork="house"
 *   size="rectangle"
 *   imageUrl="/assets/slab-guard-promo.jpg"
 *   linkUrl="/shop"
 *   altText="Card Safe HQ Slab Guards — 61 Colors"
 *   label="From Card Safe HQ"
 * />
 */
