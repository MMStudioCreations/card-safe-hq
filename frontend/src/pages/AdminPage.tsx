import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { Loader2, Users, BarChart2, Database, RefreshCw, Shield, Package } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getStoredToken } from '../lib/api'

const ADMIN_EMAIL = 'michaelamarino16@gmail.com'
const API_BASE = import.meta.env.VITE_API_URL ?? 'https://cardsafehq-api.michaelamarino16.workers.dev'

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { ...headers, ...(options?.headers ?? {}) },
    ...options,
  })
  const json = await res.json() as { ok: boolean; data?: T; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

type Stats = {
  total_users: number
  total_cards: number
  total_collection_items: number
  total_scans: number
  avg_confidence_score: number | null
}

type AdminUser = {
  id: number
  email: string
  username: string | null
  created_at: string
  collection_count: number
}

type AdminCard = {
  id: number
  card_name: string
  set_name: string | null
  game: string | null
  collection_count: number
  avg_estimated_value_cents: number | null
  ptcg_confirmed_count: number
  ptcg_confirmed_rate: number | null
}

type ActivityRow = {
  date: string
  scan_count: number
}

type Tab = 'overview' | 'users' | 'crm' | 'cards' | 'activity' | 'sql' | 'catalog' | 'sealed'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-cv-surface p-5 flex flex-col gap-1">
      <span className="text-xs text-cv-muted uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-cv-text">{value}</span>
    </div>
  )
}

function OverviewTab() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminFetch<Stats>('/api/admin/stats'),
  })

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error || !stats) return <p className="text-red-400 mt-4">Failed to load stats.</p>

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard label="Total Users" value={stats.total_users} />
      <StatCard label="Total Cards" value={stats.total_cards} />
      <StatCard label="Collection Items" value={stats.total_collection_items} />
      <StatCard label="Total Scans" value={stats.total_scans} />
      <StatCard
        label="Avg Confidence"
        value={stats.avg_confidence_score != null ? stats.avg_confidence_score.toFixed(2) : '—'}
      />
    </div>
  )
}

function UsersTab() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminFetch<AdminUser[]>('/api/admin/users'),
  })

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error || !users) return <p className="text-red-400 mt-4">Failed to load users.</p>

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] bg-cv-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cv-border text-cv-muted">
            <th className="text-left px-4 py-3 font-medium">ID</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Username</th>
            <th className="text-left px-4 py-3 font-medium">Created</th>
            <th className="text-right px-4 py-3 font-medium">Items</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-cv-border last:border-0 hover:bg-cv-hover">
              <td className="px-4 py-3 text-cv-muted">{u.id}</td>
              <td className="px-4 py-3 text-cv-text">{u.email}</td>
              <td className="px-4 py-3 text-cv-muted">{u.username ?? '—'}</td>
              <td className="px-4 py-3 text-cv-muted">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right text-cv-text font-medium">{u.collection_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardsTab() {
  const { data: cards, isLoading, error } = useQuery({
    queryKey: ['admin', 'cards'],
    queryFn: () => adminFetch<AdminCard[]>('/api/admin/cards'),
  })

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error || !cards) return <p className="text-red-400 mt-4">Failed to load cards.</p>

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] bg-cv-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cv-border text-cv-muted">
            <th className="text-left px-4 py-3 font-medium">#</th>
            <th className="text-left px-4 py-3 font-medium">Card</th>
            <th className="text-left px-4 py-3 font-medium">Set</th>
            <th className="text-left px-4 py-3 font-medium">Game</th>
            <th className="text-right px-4 py-3 font-medium">In Collections</th>
            <th className="text-right px-4 py-3 font-medium">Avg Value</th>
            <th className="text-right px-4 py-3 font-medium">PTCG Rate</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c, i) => (
            <tr key={c.id} className="border-b border-cv-border last:border-0 hover:bg-cv-hover">
              <td className="px-4 py-3 text-cv-muted">{i + 1}</td>
              <td className="px-4 py-3 text-cv-text font-medium">{c.card_name}</td>
              <td className="px-4 py-3 text-cv-muted">{c.set_name ?? '—'}</td>
              <td className="px-4 py-3 text-cv-muted">{c.game ?? '—'}</td>
              <td className="px-4 py-3 text-right text-cv-text">{c.collection_count}</td>
              <td className="px-4 py-3 text-right text-cv-muted">
                {c.avg_estimated_value_cents != null
                  ? `$${(c.avg_estimated_value_cents / 100).toFixed(2)}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-cv-muted">
                {c.ptcg_confirmed_rate != null ? `${c.ptcg_confirmed_rate}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActivityTab() {
  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: () => adminFetch<ActivityRow[]>('/api/admin/activity'),
  })

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error || !activity) return <p className="text-red-400 mt-4">Failed to load activity.</p>

  const chartData = activity.map((r) => ({
    date: r.date.slice(5), // "MM-DD"
    scans: r.scan_count,
  }))

  return (
    <div className="rounded-[var(--radius-md)] bg-cv-surface p-5">
      <h3 className="text-sm font-medium text-cv-muted mb-4">Daily Scan Activity — Last 30 Days</h3>
      {chartData.length === 0 ? (
        <p className="text-cv-muted text-sm">No activity in the last 30 days.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--cv-muted, #9ca3af)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--cv-muted, #9ca3af)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--cv-surface, #1f2937)',
                border: '1px solid var(--cv-border, #374151)',
                borderRadius: '6px',
                color: 'var(--cv-text, #f9fafb)',
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="scans" fill="var(--primary, #6366f1)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

type QueryResult = { rows: Record<string, unknown>[]; meta: Record<string, unknown> }

function SqlTab() {
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function runQuery() {
    if (!sql.trim()) return
    setRunning(true)
    setResult(null)
    setErrMsg(null)
    try {
      const data = await adminFetch<QueryResult>('/api/admin/query', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      })
      setResult(data)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setRunning(false)
    }
  }

  const columns = result && result.rows.length > 0 ? Object.keys(result.rows[0]) : []

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] bg-cv-surface p-4 space-y-3">
        <label className="block text-xs text-cv-muted uppercase tracking-wider">SQL Query (SELECT only)</label>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={6}
          className="w-full rounded-[var(--radius-sm)] bg-cv-bg border border-cv-border text-cv-text text-sm font-mono p-3 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
          placeholder="SELECT * FROM users LIMIT 10"
          spellCheck={false}
        />
        <button
          onClick={runQuery}
          disabled={running || !sql.trim()}
          className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
          type="button"
        >
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          Run Query
        </button>
      </div>

      {errMsg && (
        <div className="rounded-[var(--radius-sm)] bg-red-900/30 border border-red-700 text-red-300 text-sm p-3">
          {errMsg}
        </div>
      )}

      {result && (
        <div className="rounded-[var(--radius-md)] bg-cv-surface overflow-x-auto">
          <div className="px-4 py-2 border-b border-cv-border text-xs text-cv-muted">
            {result.rows.length} row{result.rows.length !== 1 ? 's' : ''}
          </div>
          {result.rows.length === 0 ? (
            <p className="px-4 py-3 text-cv-muted text-sm">No results.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cv-border">
                  {columns.map((col) => (
                    <th key={col} className="text-left px-4 py-2 text-cv-muted font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-cv-border last:border-0 hover:bg-cv-hover">
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2 text-cv-text whitespace-nowrap font-mono text-xs">
                        {row[col] == null ? <span className="text-cv-muted">NULL</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

type SeedStatus = {
  total_catalog_cards: number
  seeded_sets: number
  sets: Array<{ set_id: string; set_name: string; total_cards: number; seeded_at: string }>
}

type SeedResult = {
  message: string
  total_sets: number
  already_seeded: number
  seeded_now: number
  total_cards: number
  results: Array<{ set_id: string; set_name: string; cards: number }>
}

function CatalogTab() {
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null)
  const [seedError, setSeedError] = useState<string | null>(null)
  const [force, setForce] = useState(false)
  const [allSets, setAllSets] = useState(false)
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'catalog', 'status'],
    queryFn: () => adminFetch<SeedStatus>('/api/admin/seed/pokemon/status'),
  })

  async function runSeed() {
    setSeeding(true)
    setSeedResult(null)
    setSeedError(null)
    try {
      const params = new URLSearchParams()
      if (force) params.set('force', '1')
      if (allSets) params.set('all', '1')
      const result = await adminFetch<SeedResult>(`/api/admin/seed/pokemon?${params.toString()}`, { method: 'POST' })
      setSeedResult(result)
      void refetch()
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] bg-cv-surface p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-cv-text">Pokémon Card Catalog</h3>
          <p className="text-xs text-cv-muted mt-1">
            Seeds the <code>pokemon_catalog</code> table with every card from every Pokémon TCG set.
            Used by the vision pipeline for accurate card identification.
          </p>
        </div>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-cv-secondary" />
        ) : status ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Catalog Cards" value={status.total_catalog_cards.toLocaleString()} />
            <StatCard label="Seeded Sets" value={status.seeded_sets} />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 text-sm text-cv-muted cursor-pointer">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-[var(--primary)]" />
            Force re-seed (overwrite existing)
          </label>
          <label className="flex items-center gap-2 text-sm text-cv-muted cursor-pointer">
            <input type="checkbox" checked={allSets} onChange={(e) => setAllSets(e.target.checked)} className="accent-[var(--primary)]" />
            Include vintage sets (pre-2020)
          </label>
        </div>
        <button
          onClick={runSeed}
          disabled={seeding}
          className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
          type="button"
        >
          {seeding && <Loader2 className="h-4 w-4 animate-spin" />}
          {seeding ? 'Seeding...' : 'Run Seed'}
        </button>
      </div>

      {seedError && (
        <div className="rounded-[var(--radius-sm)] bg-red-900/30 border border-red-700 text-red-300 text-sm p-3">
          {seedError}
        </div>
      )}

      {seedResult && (
        <div className="rounded-[var(--radius-md)] bg-cv-surface p-4 space-y-3">
          <p className="text-sm font-medium text-cv-text">{seedResult.message}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Sets" value={seedResult.total_sets} />
            <StatCard label="Already Seeded" value={seedResult.already_seeded} />
            <StatCard label="Seeded Now" value={seedResult.seeded_now} />
            <StatCard label="Cards Added" value={seedResult.total_cards.toLocaleString()} />
          </div>
          {seedResult.results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-cv-border text-cv-muted">
                    <th className="text-left px-3 py-2">Set ID</th>
                    <th className="text-left px-3 py-2">Set Name</th>
                    <th className="text-right px-3 py-2">Cards</th>
                  </tr>
                </thead>
                <tbody>
                  {seedResult.results.map((r) => (
                    <tr key={r.set_id} className="border-b border-cv-border last:border-0">
                      <td className="px-3 py-1.5 text-cv-muted font-mono">{r.set_id}</td>
                      <td className="px-3 py-1.5 text-cv-text">{r.set_name}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${r.cards < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {r.cards < 0 ? 'Error' : r.cards}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {status && status.sets.length > 0 && (
        <div className="rounded-[var(--radius-md)] bg-cv-surface overflow-x-auto">
          <div className="px-4 py-2 border-b border-cv-border text-xs text-cv-muted">Previously seeded sets</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-cv-border text-cv-muted">
                <th className="text-left px-4 py-2">Set</th>
                <th className="text-right px-4 py-2">Cards</th>
                <th className="text-right px-4 py-2">Seeded</th>
              </tr>
            </thead>
            <tbody>
              {status.sets.map((s) => (
                <tr key={s.set_id} className="border-b border-cv-border last:border-0 hover:bg-cv-hover">
                  <td className="px-4 py-2 text-cv-text">{s.set_name} <span className="text-cv-muted">({s.set_id})</span></td>
                  <td className="px-4 py-2 text-right text-cv-muted">{s.total_cards}</td>
                  <td className="px-4 py-2 text-right text-cv-muted">{new Date(s.seeded_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    {/* ── Re-crop Collection ── */}
    <RecropSection />
    </div>
  )
}

function RecropSection() {
  const [recropping, setRecropping] = useState(false)
  const [recropResult, setRecropResult] = useState<{ total: number; processed: number; failed: number; message: string } | null>(null)
  const [recropError, setRecropError] = useState<string | null>(null)

  async function runRecrop() {
    setRecropping(true)
    setRecropResult(null)
    setRecropError(null)
    try {
      const result = await adminFetch<{ total: number; processed: number; failed: number; message: string }>(
        '/api/admin/recrop',
        { method: 'POST' },
      )
      setRecropResult(result)
    } catch (e) {
      setRecropError(e instanceof Error ? e.message : 'Re-crop failed')
    } finally {
      setRecropping(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-cv-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-cv-text">Re-crop Collection Images</h3>
        <p className="text-xs text-cv-muted mt-1">
          Finds all collection items whose image still points to the full binder sheet and crops each card individually.
          Run this once to fix cards scanned before the crop pipeline was deployed.
        </p>
      </div>
      <button
        onClick={runRecrop}
        disabled={recropping}
        className="px-4 py-2 rounded-[var(--radius-sm)] bg-amber-600 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
        type="button"
      >
        {recropping && <Loader2 className="h-4 w-4 animate-spin" />}
        {recropping ? 'Re-cropping...' : 'Re-crop All Sheet Images'}
      </button>
      {recropError && (
        <div className="rounded-[var(--radius-sm)] bg-red-900/30 border border-red-700 text-red-300 text-sm p-3">{recropError}</div>
      )}
      {recropResult && (
        <div className="rounded-[var(--radius-sm)] bg-green-900/20 border border-green-700 text-green-300 text-sm p-3 space-y-1">
          <p className="font-medium">{recropResult.message}</p>
          <p>Total found: {recropResult.total} · Processed: {recropResult.processed} · Failed: {recropResult.failed}</p>
        </div>
      )}
    </div>
  )
}

// ── CRM Tab ──────────────────────────────────────────────────────────────────
type CRMUser = {
  id: number
  email: string
  username: string | null
  created_at: string
  collection_count: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  subscription_status: string | null
  current_period_end: string | null
}

function CRMTab() {
  const [search, setSearch] = useState('')
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'crm-users'],
    queryFn: () => adminFetch<CRMUser[]>('/api/admin/users'),
  })

  const filtered = (users ?? []).filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const proUsers = (users ?? []).filter(u => u.subscription_status === 'active')
  const freeUsers = (users ?? []).filter(u => u.subscription_status !== 'active')

  function getPlanLabel(u: CRMUser) {
    if (!u.stripe_subscription_id || u.subscription_status !== 'active') return 'Free'
    if (u.stripe_price_id?.includes('yearly') || u.stripe_price_id?.includes('annual') || u.stripe_price_id?.includes('year')) return 'Pro Yearly'
    return 'Pro Monthly'
  }

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error) return <p className="text-red-400 mt-4">Failed to load CRM data.</p>

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-[var(--radius-md)] bg-cv-surface p-4">
          <p className="text-xs text-cv-muted uppercase tracking-wider">Total Users</p>
          <p className="text-2xl font-bold mt-1">{users?.length ?? 0}</p>
        </div>
        <div className="rounded-[var(--radius-md)] p-4" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: '#00E5FF' }}>Pro Subscribers</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#00E5FF' }}>{proUsers.length}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-cv-surface p-4">
          <p className="text-xs text-cv-muted uppercase tracking-wider">Free Users</p>
          <p className="text-2xl font-bold mt-1">{freeUsers.length}</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email or username..."
        className="input w-full"
      />

      {/* User table */}
      <div className="overflow-x-auto rounded-[var(--radius-md)] bg-cv-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cv-border text-cv-muted">
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Renews</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const plan = getPlanLabel(u)
              const isActive = u.subscription_status === 'active'
              return (
                <tr key={u.id} className="border-b border-cv-border last:border-0 hover:bg-cv-hover">
                  <td className="px-4 py-3">
                    <p className="text-cv-text font-medium">{u.email}</p>
                    <p className="text-xs text-cv-muted">{u.username ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: plan === 'Pro Yearly' ? 'rgba(201,168,76,0.15)' : plan === 'Pro Monthly' ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.06)',
                        color: plan === 'Pro Yearly' ? '#C9A84C' : plan === 'Pro Monthly' ? '#00E5FF' : 'var(--cv-muted)',
                      }}
                    >
                      {plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${isActive ? 'text-green-400' : 'text-cv-muted'}`}>
                      {u.subscription_status ?? 'none'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cv-muted text-xs">
                    {u.current_period_end ? new Date(u.current_period_end).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-cv-text">{u.collection_count}</td>
                  <td className="px-4 py-3 text-cv-muted text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sealed Sync Tab ────────────────────────────────────────────────────────────
type SyncResult = {
  inserted: number
  skipped: number
  groups_processed: number
  total_groups: number
  errors: string[]
}

function SealedSyncTab() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState('')

  async function runSync() {
    setSyncing(true)
    setResult(null)
    setError('')
    try {
      const data = await adminFetch<SyncResult>('/api/admin/sync-sealed', { method: 'POST' })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-cv-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-cv-text">Sync Sealed Products Catalog</h3>
        <p className="text-xs text-cv-muted mt-1">
          Fetches all sealed Pokémon TCG products from TCGCSV (Elite Trainer Boxes, Tins, Booster Bundles, Promo Packs, etc.)
          and populates the local sealed_products table. Run this to enable sealed product search.
          Processes up to 100 set groups per run.
        </p>
      </div>
      <button
        onClick={runSync}
        disabled={syncing}
        className="px-4 py-2 rounded-[var(--radius-sm)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
        style={{ background: 'linear-gradient(90deg, #00E5FF, #0099aa)' }}
        type="button"
      >
        {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
        {syncing ? 'Syncing...' : 'Sync Sealed Products'}
      </button>
      {error && (
        <div className="rounded-[var(--radius-sm)] bg-red-900/30 border border-red-700 text-red-300 text-sm p-3">{error}</div>
      )}
      {result && (
        <div className="rounded-[var(--radius-sm)] bg-green-900/20 border border-green-700 text-green-300 text-sm p-3 space-y-1">
          <p className="font-medium">Sync complete!</p>
          <p>Inserted: {result.inserted} · Skipped: {result.skipped}</p>
          <p>Groups processed: {result.groups_processed} / {result.total_groups}</p>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-yellow-400">Errors ({result.errors.length})</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-yellow-300">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'crm', label: 'CRM' },
  { id: 'users', label: 'Users' },
  { id: 'cards', label: 'Cards' },
  { id: 'activity', label: 'Activity' },
  { id: 'sealed', label: 'Sealed Sync' },
  { id: 'sql', label: 'SQL Runner' },
  { id: 'catalog', label: 'Pokémon Catalog' },
]

export default function AdminPage() {
  const { data: user, isLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cv-secondary" />
      </div>
    )
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-xl font-bold text-cv-text">Admin Dashboard</h1>
        <p className="text-sm text-cv-muted mt-0.5">Internal tools — restricted access</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition ${
              tab === t.id ? 'bg-[var(--primary)] text-white' : 'text-cv-muted hover:text-cv-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'crm' && <CRMTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'cards' && <CardsTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'sealed' && <SealedSyncTab />}
      {tab === 'sql' && <SqlTab />}
      {tab === 'catalog' && <CatalogTab />}
    </div>
  )
}
