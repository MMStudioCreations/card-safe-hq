import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CardTile from '../components/CardTile'
import { useCollection } from '../lib/hooks'

const sortOptions = [
  { value: 'value-desc', label: 'Value: High → Low' },
  { value: 'value-asc', label: 'Value: Low → High' },
  { value: 'year-desc', label: 'Year: Newest First' },
  { value: 'year-asc', label: 'Year: Oldest First' },
  { value: 'name-asc', label: 'Name: A → Z' },
  { value: 'name-desc', label: 'Name: Z → A' },
  { value: 'added-desc', label: 'Recently Added' },
  { value: 'grade-desc', label: 'Grade: High → Low' },
] as const

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  single_card: 'Single Card',
  booster_pack: 'Booster Pack',
  booster_box: 'Booster Box',
  etb: 'Elite Trainer Box',
  tin: 'Tin',
  bundle: 'Bundle',
  promo_pack: 'Promo Pack',
  other_sealed: 'Other Sealed',
}

export default function DashboardPage() {
  const { data = [], isLoading } = useCollection(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState('value-desc')

  // Derive unique categories from collection
  const categories = useMemo(() => {
    const values = new Set<string>()
    data.forEach((item) => {
      const cat = item.card?.sport || item.card?.game || item.sport || item.game || 'Other'
      values.add(cat)
    })
    return ['All', ...Array.from(values).sort()]
  }, [data])

  const totals = useMemo(() => {
    const totalValue = data.reduce((s, i) => s + ((i as any).latest_sold_price_cents ?? i.estimated_value_cents ?? 0), 0)
    const avgValue = data.length > 0 ? totalValue / data.length : 0
    const mostValuable = data.reduce<{ name: string; value: number } | null>((best, i) => {
      const v = (i as any).latest_sold_price_cents ?? i.estimated_value_cents ?? 0
      const n = i.player_name || i.card_name || i.card?.player_name || i.card?.card_name || 'Unknown'
      if (!best || v > best.value) return { name: n, value: v }
      return best
    }, null)
    const gradedCount = data.filter(i => i.estimated_grade && i.estimated_grade !== '').length
    return { count: data.length, totalValue, avgValue, mostValuable, gradedCount }
  }, [data])

  const filtered = useMemo(() => {
    return [...data]
      .filter((item) => {
        if (categoryFilter === 'All') return true
        const cat = item.card?.sport || item.card?.game || item.sport || item.game || 'Other'
        return cat === categoryFilter
      })
      .filter((item) => {
        if (typeFilter === 'all') return true
        const t = (item as any).product_type ?? 'single_card'
        return t === typeFilter
      })
      .filter((item) => {
        if (!search.trim()) return true
        const target = [
          item.player_name, item.card_name,
          item.card?.player_name, item.card?.card_name,
          item.set_name, item.card?.set_name,
          String(item.year ?? item.card?.year ?? ''),
        ].filter(Boolean).join(' ').toLowerCase()
        return target.includes(search.toLowerCase())
      })
      .sort((a, b) => {
        const aVal = (a as any).latest_sold_price_cents ?? a.estimated_value_cents ?? 0
        const bVal = (b as any).latest_sold_price_cents ?? b.estimated_value_cents ?? 0
        const aName = (a.player_name || a.card_name || a.card?.player_name || a.card?.card_name || '').toLowerCase()
        const bName = (b.player_name || b.card_name || b.card?.player_name || b.card?.card_name || '').toLowerCase()
        const aYear = a.card?.year || a.year || 0
        const bYear = b.card?.year || b.year || 0
        const aGrade = parseFloat(a.estimated_grade?.split('-')[0] ?? '0')
        const bGrade = parseFloat(b.estimated_grade?.split('-')[0] ?? '0')
        switch (sort) {
          case 'value-desc': return bVal - aVal
          case 'value-asc': return aVal - bVal
          case 'year-desc': return bYear - aYear
          case 'year-asc': return aYear - bYear
          case 'name-asc': return aName.localeCompare(bName)
          case 'name-desc': return bName.localeCompare(aName)
          case 'added-desc': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          case 'grade-desc': return bGrade - aGrade
          default: return 0
        }
      })
  }, [data, search, categoryFilter, typeFilter, sort])

  if (isLoading) return <div className="glass p-6">Loading vault...</div>

  return (
    <div className="space-y-4 page-enter">
      {/* Stats bar */}
      <section className="glass p-4">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
          <div>
            <p className="text-xs text-cv-muted">Total Cards</p>
            <p className="text-2xl font-bold">{totals.count}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Portfolio Value</p>
            <p className="gradient-text text-2xl font-bold">${(totals.totalValue / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Avg Card Value</p>
            <p className="text-2xl font-bold">${(totals.avgValue / 100).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Graded Cards</p>
            <p className="text-2xl font-bold">{totals.gradedCount}</p>
          </div>
          <div>
            <p className="text-xs text-cv-muted">Most Valuable</p>
            {totals.mostValuable ? (
              <>
                <p className="truncate text-sm font-bold">{totals.mostValuable.name}</p>
                <p className="text-xs text-cv-muted">${(totals.mostValuable.value / 100).toFixed(2)}</p>
              </>
            ) : <p className="text-sm text-cv-muted">—</p>}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="glass p-4">
        <div className="flex flex-col gap-3">
          {/* Search */}
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, set, year..."
          />
          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  categoryFilter === cat
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-cv-surface text-cv-muted hover:text-cv-text'
                }`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Sort + Type row */}
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Active filter count */}
        {filtered.length !== data.length && (
          <p className="mt-2 text-xs text-cv-muted">
            Showing {filtered.length} of {data.length} items
            <button className="ml-2 text-[var(--primary)] hover:underline" type="button"
              onClick={() => { setSearch(''); setCategoryFilter('All'); setTypeFilter('all'); setSort('value-desc') }}>
              Clear filters
            </button>
          </p>
        )}
      </section>

      {filtered.length === 0 ? (
        <section className="glass p-8 text-center">
          {data.length === 0 ? (
            <>
              <p className="mb-2 text-lg font-semibold">No cards in your vault yet</p>
              <p className="mb-4 text-sm text-cv-muted">Upload your first card to get started.</p>
              <Link className="btn-primary" to="/upload">Upload card</Link>
            </>
          ) : (
            <>
              <p className="mb-2 text-lg font-semibold">No cards match your filters</p>
              <button className="btn-secondary" type="button"
                onClick={() => { setSearch(''); setCategoryFilter('All'); setTypeFilter('all') }}>
                Clear filters
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => <CardTile key={item.id} collectionItem={item} />)}
        </section>
      )}
    </div>
  )
}
