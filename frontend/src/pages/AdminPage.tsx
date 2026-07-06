import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { Loader2, Users, BarChart2, Database, RefreshCw, Shield, Package, X } from 'lucide-react'
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
  free_users: number
  monthly_subscribers: number
  yearly_subscribers: number
  mrr_cents: number
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

type Tab = 'overview' | 'users' | 'crm' | 'cards' | 'activity' | 'sql' | 'catalog' | 'sealed' | 'scans'

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
  if (error || !stats) return <p className="text-red-400 mt-4">Failed to load stats. Check that your session is active.</p>

  const mrrDisplay = stats.mrr_cents ? `$${(stats.mrr_cents / 100).toFixed(0)}/mo` : '$0/mo'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Total Cards" value={stats.total_cards.toLocaleString()} />
        <StatCard label="Collection Items" value={stats.total_collection_items.toLocaleString()} />
        <StatCard label="Total Scans" value={stats.total_scans} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-[var(--radius-md)] bg-cv-surface p-5 flex flex-col gap-1">
          <span className="text-xs text-cv-muted uppercase tracking-wider">Free Users</span>
          <span className="text-2xl font-bold text-cv-text">{stats.free_users}</span>
        </div>
        <div className="rounded-[var(--radius-md)] p-5 flex flex-col gap-1" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.20)' }}>
          <span className="text-xs uppercase tracking-wider" style={{ color: '#D4AF37' }}>Monthly Pro</span>
          <span className="text-2xl font-bold" style={{ color: '#D4AF37' }}>{stats.monthly_subscribers}</span>
        </div>
        <div className="rounded-[var(--radius-md)] p-5 flex flex-col gap-1" style={{ background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.25)' }}>
          <span className="text-xs uppercase tracking-wider" style={{ color: '#D4AF37' }}>Yearly Pro</span>
          <span className="text-2xl font-bold" style={{ color: '#D4AF37' }}>{stats.yearly_subscribers}</span>
        </div>
        <div className="rounded-[var(--radius-md)] p-5 flex flex-col gap-1" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <span className="text-xs uppercase tracking-wider" style={{ color: '#34D399' }}>Est. MRR</span>
          <span className="text-2xl font-bold" style={{ color: '#34D399' }}>{mrrDisplay}</span>
        </div>
      </div>
    </div>
  )
}

type PagedAdminUsers = {
  data: AdminUser[]
  total_count: number
  page: number
  limit: number
}

function UsersTab() {
  const [page, setPage] = useState(1)
  const LIMIT = 100
  const { data: resp, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => adminFetch<PagedAdminUsers>(`/api/admin/users?page=${page}&limit=${LIMIT}`),
  })

  const users = resp?.data ?? []
  const totalCount = resp?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / LIMIT)

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error || !resp) return <p className="text-red-400 mt-4">Failed to load users.</p>

  return (
    <div className="space-y-3">
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
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
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
  plan: string | null
  status: string | null
  current_period_end: string | null
}

type PagedUsers = {
  data: CRMUser[]
  total_count: number
  page: number
  limit: number
}

function Pagination({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3 border-t border-cv-border">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded text-sm text-cv-text bg-cv-surface border border-cv-border hover:bg-cv-hover disabled:opacity-40 disabled:cursor-not-allowed"
        type="button"
      >
        ← Previous
      </button>
      <span className="text-sm text-cv-muted">Page {page} of {totalPages}</span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded text-sm text-cv-text bg-cv-surface border border-cv-border hover:bg-cv-hover disabled:opacity-40 disabled:cursor-not-allowed"
        type="button"
      >
        Next →
      </button>
    </div>
  )
}

// ── Collection drill-down panel ─────────────────────────────────────────────
type CollectionItemRow = {
  id: number
  card_id: number | null
  card_name: string | null
  set_name: string | null
  condition_note: string | null
  estimated_grade: string | null
  estimated_value_cents: number | null
  front_image_url: string | null
  back_image_url: string | null
  created_at: string
}

type PagedCollection = {
  data: CollectionItemRow[]
  total_count: number
  page: number
  limit: number
}

function AdminThumbnail({ imageKey }: { imageKey: string | null }) {
  if (!imageKey) {
    return (
      <div className="h-12 w-12 shrink-0 rounded bg-cv-bg border border-cv-border flex items-center justify-center text-[10px] text-cv-muted">
        —
      </div>
    )
  }
  return (
    <img
      src={`${API_BASE}/api/admin/image?key=${encodeURIComponent(imageKey)}`}
      alt=""
      className="h-12 w-12 shrink-0 rounded object-cover border border-cv-border"
    />
  )
}

function CollectionPanel({
  userId, userEmail, onClose,
}: { userId: number; userEmail: string; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const LIMIT = 50
  const { data: resp, isLoading, error } = useQuery({
    queryKey: ['admin', 'user-collection', userId, page],
    queryFn: () => adminFetch<PagedCollection>(`/api/admin/users/${userId}/collection?page=${page}`),
  })

  const items = resp?.data ?? []
  const totalCount = resp?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / LIMIT)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-cv-bg border-l border-cv-border overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-cv-text">Collection</h2>
            <p className="text-xs text-cv-muted">{userEmail} · {totalCount} item{totalCount === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} type="button" className="p-1.5 rounded hover:bg-cv-hover text-cv-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
        ) : error ? (
          <p className="text-red-400 text-sm">Failed to load collection.</p>
        ) : items.length === 0 ? (
          <p className="text-cv-muted text-sm">No items in this collection.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setEditingItemId(item.id)}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-cv-surface p-3 cursor-pointer hover:bg-cv-hover"
              >
                <AdminThumbnail imageKey={item.front_image_url} />
                <div className="flex-1 min-w-0">
                  {item.card_id ? (
                    <p className="text-sm text-cv-text font-medium truncate">{item.card_name}</p>
                  ) : (
                    <p className="text-sm font-medium truncate" style={{ color: '#f59e0b' }}>Unidentified</p>
                  )}
                  <p className="text-xs text-cv-muted truncate">{item.set_name ?? '—'}</p>
                </div>
                <div className="text-right text-xs text-cv-muted shrink-0">
                  <p>{item.estimated_grade ?? '—'}</p>
                  <p>{item.estimated_value_cents != null ? `$${(item.estimated_value_cents / 100).toFixed(2)}` : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage(p => p - 1)}
          onNext={() => setPage(p => p + 1)}
        />
      </div>
      {editingItemId != null && (
        <ItemEditSheet itemId={editingItemId} onClose={() => setEditingItemId(null)} />
      )}
    </div>
  )
}

// ── Item edit sheet (Capability 4 — ID override) ────────────────────────────
type AdminItemDetail = {
  id: number
  user_id: number
  card_id: number | null
  condition_note: string | null
  estimated_grade: string | null
  estimated_value_cents: number | null
  front_image_url: string | null
  back_image_url: string | null
  created_at: string
  user_email: string
  card_name: string | null
  set_name: string | null
  game: string | null
  card_number: string | null
  rarity: string | null
  image_url: string | null
  external_ref: string | null
  card_collection_count: number
}

function CardEditSection({
  cardId, initialName, initialSet, initialCollectionCount,
}: { cardId: number; initialName: string | null; initialSet: string | null; initialCollectionCount: number }) {
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null)
  const [formError, setFormError] = useState('')
  const [affected, setAffected] = useState<number | null>(null)

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      adminFetch<{ updated: boolean; affected_collections: number }>(`/api/admin/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      setFormError('')
      setPendingBody(null)
      setAffected(res.affected_collections)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const cardName = String(form.get('card_name') ?? '').trim()
    const setName = String(form.get('set_name') ?? '').trim()
    if (!cardName) {
      setFormError('Card name is required')
      return
    }
    setFormError('')
    setPendingBody({ card_name: cardName, set_name: setName || null })
  }

  return (
    <div className="rounded-[var(--radius-sm)] bg-cv-surface p-4 space-y-3 border border-cv-border">
      <h3 className="text-xs font-semibold text-cv-text uppercase tracking-wider">Edit Shared Card</h3>
      <p className="text-xs text-cv-muted">
        This card is in {initialCollectionCount} collection{initialCollectionCount === 1 ? '' : 's'}. Changes affect all owners.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="card_name" defaultValue={initialName ?? ''} className="input w-full" placeholder="Card name" />
        <input name="set_name" defaultValue={initialSet ?? ''} className="input w-full" placeholder="Set name" />
        <button
          type="submit"
          className="px-3 py-1.5 rounded text-xs font-medium text-cv-text bg-cv-bg border border-cv-border hover:bg-cv-hover"
        >
          Update Card
        </button>
      </form>
      {formError && <p className="text-xs text-red-400">{formError}</p>}
      {affected != null && (
        <p className="text-xs text-green-400">Updated — affected {affected} collection{affected === 1 ? '' : 's'}.</p>
      )}

      {pendingBody && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-cv-bg border border-cv-border rounded-[var(--radius-md)] p-5 max-w-sm space-y-3">
            <p className="text-sm text-cv-text">
              This card is in {initialCollectionCount} collection{initialCollectionCount === 1 ? '' : 's'}.
              Changes affect all owners. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingBody(null)} type="button" className="px-3 py-1.5 rounded text-xs text-cv-muted hover:text-cv-text">
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate(pendingBody)}
                disabled={mutation.isPending}
                type="button"
                className="px-3 py-1.5 rounded text-xs font-medium bg-[var(--primary)] text-white disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemEditSheet({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: item, isLoading, error } = useQuery({
    queryKey: ['admin', 'item', itemId],
    queryFn: () => adminFetch<AdminItemDetail>(`/api/admin/collection/${itemId}`),
  })
  const [saveError, setSaveError] = useState('')

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminFetch(`/api/admin/collection/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      setSaveError('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'item', itemId] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-collection'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'scans'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const conditionNote = String(form.get('condition_note') ?? '').trim()
    const estimatedGrade = String(form.get('estimated_grade') ?? '').trim()
    const estimatedValueRaw = String(form.get('estimated_value') ?? '').trim()
    const cardIdRaw = String(form.get('card_id') ?? '').trim()

    const body: Record<string, unknown> = {
      condition_note: conditionNote || null,
      estimated_grade: estimatedGrade || null,
      estimated_value_cents: estimatedValueRaw ? Math.round(parseFloat(estimatedValueRaw) * 100) : null,
    }
    if (cardIdRaw) {
      const cardId = parseInt(cardIdRaw, 10)
      if (Number.isInteger(cardId) && cardId > 0) body.card_id = cardId
    }
    saveMutation.mutate(body)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-cv-bg border-l border-cv-border overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cv-text">Edit Item #{itemId}</h2>
          <button onClick={onClose} type="button" className="p-1.5 rounded hover:bg-cv-hover text-cv-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
        ) : error || !item ? (
          <p className="text-red-400 text-sm">Failed to load item.</p>
        ) : (
          <div className="space-y-4">
            <form key={item.id} onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3 items-center">
                <AdminThumbnail imageKey={item.front_image_url} />
                <div className="text-xs text-cv-muted">
                  <p>{item.user_email}</p>
                  <p>Added {new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-cv-muted uppercase tracking-wider mb-1">Card</label>
                <p className="text-sm text-cv-text">
                  {item.card_id ? `${item.card_name} — ${item.set_name ?? '—'}` : (
                    <span style={{ color: '#f59e0b' }}>Unidentified</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs text-cv-muted uppercase tracking-wider mb-1">Reassign to card ID</label>
                <input name="card_id" type="number" min={1} placeholder={item.card_id ? String(item.card_id) : 'e.g. 42'} className="input w-full" />
                <p className="text-xs text-cv-muted mt-1">Leave blank to keep the current card.</p>
              </div>

              <div>
                <label className="block text-xs text-cv-muted uppercase tracking-wider mb-1">Condition Note</label>
                <input name="condition_note" defaultValue={item.condition_note ?? ''} className="input w-full" />
              </div>

              <div>
                <label className="block text-xs text-cv-muted uppercase tracking-wider mb-1">Estimated Grade</label>
                <input name="estimated_grade" defaultValue={item.estimated_grade ?? ''} className="input w-full" />
              </div>

              <div>
                <label className="block text-xs text-cv-muted uppercase tracking-wider mb-1">Estimated Value (USD)</label>
                <input
                  name="estimated_value"
                  type="number"
                  step="0.01"
                  defaultValue={item.estimated_value_cents != null ? (item.estimated_value_cents / 100).toFixed(2) : ''}
                  className="input w-full"
                />
              </div>

              {saveError && (
                <div className="rounded-[var(--radius-sm)] bg-red-900/30 border border-red-700 text-red-300 text-sm p-3">{saveError}</div>
              )}
              {saveMutation.isSuccess && !saveError && (
                <div className="rounded-[var(--radius-sm)] bg-green-900/20 border border-green-700 text-green-300 text-sm p-3">Saved.</div>
              )}

              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </form>

            {item.card_id && (
              <CardEditSection
                cardId={item.card_id}
                initialName={item.card_name}
                initialSet={item.set_name}
                initialCollectionCount={item.card_collection_count}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CRMTab() {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: number; email: string } | null>(null)
  const [page, setPage] = useState(1)
  const LIMIT = 100
  const { data: resp, isLoading, error } = useQuery({
    queryKey: ['admin', 'crm-users', page],
    queryFn: () => adminFetch<PagedUsers>(`/api/admin/users?page=${page}&limit=${LIMIT}`),
  })

  const pageUsers = resp?.data ?? []
  const totalCount = resp?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / LIMIT)

  const filtered = pageUsers.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const monthlyUsers = pageUsers.filter(u => u.plan === 'monthly' && u.status === 'active')
  const yearlyUsers = pageUsers.filter(u => u.plan === 'yearly' && u.status === 'active')
  const freeUsers = pageUsers.filter(u => !u.plan || u.plan === 'free')
  const mrr = monthlyUsers.length * 10 + yearlyUsers.length * (100 / 12)

  function getPlanLabel(u: CRMUser) {
    if (!u.plan || u.plan === 'free') return 'Free'
    const planName = u.plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly'
    return u.status === 'cancelled' ? `${planName} — Cancelled` : planName
  }

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
  if (error) return <p className="text-red-400 mt-4">Failed to load CRM data.</p>

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-[var(--radius-md)] bg-cv-surface p-4">
          <p className="text-xs text-cv-muted uppercase tracking-wider">Total Users</p>
          <p className="text-2xl font-bold mt-1">{totalCount}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-cv-surface p-4">
          <p className="text-xs text-cv-muted uppercase tracking-wider">Free</p>
          <p className="text-2xl font-bold mt-1">{freeUsers.length}</p>
        </div>
        <div className="rounded-[var(--radius-md)] p-4" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.20)' }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: '#D4AF37' }}>Monthly</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#D4AF37' }}>{monthlyUsers.length}</p>
        </div>
        <div className="rounded-[var(--radius-md)] p-4" style={{ background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.25)' }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: '#D4AF37' }}>Yearly</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#D4AF37' }}>{yearlyUsers.length}</p>
        </div>
        <div className="rounded-[var(--radius-md)] p-4" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: '#34D399' }}>Est. MRR</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#34D399' }}>${mrr.toFixed(0)}</p>
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
              const isPro = u.status === 'active' && u.plan && u.plan !== 'free'
              const isCancelled = u.status === 'cancelled'
              const badgeBg = isPro
                ? u.plan === 'yearly' ? 'rgba(201,168,76,0.15)' : 'rgba(212,175,55,0.10)'
                : isCancelled ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.06)'
              const badgeColor = isPro
                ? '#D4AF37'
                : isCancelled ? '#f87171' : 'var(--cv-muted)'
              return (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUser({ id: u.id, email: u.email })}
                  className="border-b border-cv-border last:border-0 hover:bg-cv-hover cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="text-cv-text font-medium">{u.email}</p>
                    <p className="text-xs text-cv-muted">{u.username ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: badgeBg, color: badgeColor }}
                    >
                      {plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.status === 'active' ? 'text-green-400' : 'text-cv-muted'}`}>
                      {u.status ?? 'none'}
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
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => { setSearch(''); setPage(p => p - 1) }}
        onNext={() => { setSearch(''); setPage(p => p + 1) }}
      />
      {selectedUser && (
        <CollectionPanel
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}

// ── Scans Tab ────────────────────────────────────────────────────────────────
type ScanStatus = 'pending' | 'confirmed' | 'all'

type ScanRow = {
  id: number
  collection_item_id: number
  confirmed: number
  created_at: string
  confidence_score: number | null
  suggested_card_name: string | null
  suggested_set_name: string | null
  user_email: string
  card_id: number | null
  confirmed_card_name: string | null
}

type PagedScans = {
  data: ScanRow[]
  total_count: number
  page: number
  limit: number
}

function ScansTab() {
  const [status, setStatus] = useState<ScanStatus>('pending')
  const [page, setPage] = useState(1)
  const [discardError, setDiscardError] = useState('')
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const LIMIT = 50

  const { data: resp, isLoading, error } = useQuery({
    queryKey: ['admin', 'scans', status, page],
    queryFn: () => adminFetch<PagedScans>(`/api/admin/scans?status=${status}&page=${page}`),
  })

  const discardMutation = useMutation({
    mutationFn: (pendingId: number) => adminFetch(`/api/admin/scans/${pendingId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDiscardError('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'scans'] })
    },
    onError: (e: Error) => setDiscardError(e.message),
  })

  const rows = resp?.data ?? []
  const totalCount = resp?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / LIMIT)

  function confidenceColor(score: number | null) {
    if (score == null) return 'var(--cv-muted)'
    if (score < 20) return '#f87171'
    if (score < 50) return '#f59e0b'
    return '#34D399'
  }

  function handleDiscard(row: ScanRow) {
    const alreadyLinked = row.card_id != null
    const message = alreadyLinked
      ? 'This item already has a confirmed card. Discarding only removes this log entry — continue?'
      : 'Discard this pending identification?'
    if (!window.confirm(message)) return
    discardMutation.mutate(row.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-cv-surface p-1 w-fit">
        {(['pending', 'confirmed', 'all'] as ScanStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium capitalize transition ${
              status === s ? 'bg-[var(--primary)] text-white' : 'text-cv-muted hover:text-cv-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {discardError && (
        <div className="rounded-[var(--radius-sm)] bg-red-900/30 border border-red-700 text-red-300 text-sm p-3">{discardError}</div>
      )}

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-cv-secondary mx-auto mt-8" />
      ) : error ? (
        <p className="text-red-400 mt-4">Failed to load scans.</p>
      ) : rows.length === 0 ? (
        <p className="text-cv-muted text-sm">No pending identifications.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] bg-cv-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cv-border text-cv-muted">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Suggested Card</th>
                <th className="text-right px-4 py-3 font-medium">Confidence</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-cv-border last:border-0 hover:bg-cv-hover">
                  <td className="px-4 py-3 text-cv-muted">#{row.collection_item_id}</td>
                  <td className="px-4 py-3 text-cv-text">{row.user_email}</td>
                  <td className="px-4 py-3 text-cv-text">
                    {row.confirmed ? (row.confirmed_card_name ?? '—') : (row.suggested_card_name ?? '—')}
                    <p className="text-xs text-cv-muted">{row.suggested_set_name ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: confidenceColor(row.confidence_score) }}>
                    {row.confidence_score ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${row.confirmed ? 'text-green-400' : 'text-cv-muted'}`}>
                      {row.confirmed ? 'Confirmed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cv-muted text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => setViewingItemId(row.collection_item_id)}
                      type="button"
                      className="px-2 py-1 rounded text-xs font-medium text-cv-text border border-cv-border hover:bg-cv-hover"
                    >
                      View Item
                    </button>
                    <button
                      onClick={() => handleDiscard(row)}
                      disabled={discardMutation.isPending}
                      type="button"
                      className="px-2 py-1 rounded text-xs font-medium text-red-300 border border-red-700/50 hover:bg-red-900/30 disabled:opacity-40"
                    >
                      Discard
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage(p => p - 1)}
        onNext={() => setPage(p => p + 1)}
      />
      {viewingItemId != null && (
        <ItemEditSheet itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}
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
        style={{ background: 'linear-gradient(90deg, #D4AF37, #B8960C)' }}
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
  { id: 'scans', label: 'Scans' },
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

  if (!user || user.is_admin !== 1) {
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
      {tab === 'scans' && <ScansTab />}
      {tab === 'sealed' && <SealedSyncTab />}
      {tab === 'sql' && <SqlTab />}
      {tab === 'catalog' && <CatalogTab />}
    </div>
  )
}
