import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const ADMIN_EMAIL = 'michaelamarino16@gmail.com'
const API_BASE = import.meta.env.VITE_API_URL ?? 'https://cardsafehq-api.michaelamarino16.workers.dev'

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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

type Tab = 'overview' | 'users' | 'cards' | 'activity' | 'sql'

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

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'cards', label: 'Cards' },
  { id: 'activity', label: 'Activity' },
  { id: 'sql', label: 'SQL Runner' },
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
      {tab === 'users' && <UsersTab />}
      {tab === 'cards' && <CardsTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'sql' && <SqlTab />}
    </div>
  )
}
