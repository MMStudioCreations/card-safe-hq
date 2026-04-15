// ── SkeletonLoader ─────────────────────────────────────────────────────────────
// Collectr-style dark grey rounded placeholder skeletons for instant-feel loading

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
        borderRadius: 8,
        ...style,
      }}
    />
  )
}

/** 2-column card grid skeleton — matches the search/portfolio grid */
export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Image placeholder */}
          <Bone style={{ width: '100%', paddingBottom: '140%', borderRadius: 0 }} />
          {/* Text rows */}
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Bone style={{ height: 11, width: '80%' }} />
            <Bone style={{ height: 9, width: '55%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <Bone style={{ height: 9, width: '35%' }} />
              <Bone style={{ height: 9, width: '28%' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Horizontal list row skeleton — for portfolio list view */
export function ListRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Bone style={{ width: 40, height: 56, borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Bone style={{ height: 11, width: '60%' }} />
            <Bone style={{ height: 9, width: '40%' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <Bone style={{ height: 13, width: 56 }} />
            <Bone style={{ height: 9, width: 40 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Quick-filter pill row skeleton */
export function QuickFilterSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {[80, 64, 90, 72, 68, 76, 60, 84].map((w, i) => (
        <Bone key={i} style={{ height: 36, width: w, borderRadius: 20, flexShrink: 0 }} />
      ))}
    </div>
  )
}

/** Portfolio overview stat cards skeleton */
export function PortfolioStatsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ borderRadius: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Bone style={{ height: 9, width: '50%', marginBottom: 8 }} />
          <Bone style={{ height: 22, width: '70%' }} />
        </div>
      ))}
    </div>
  )
}
