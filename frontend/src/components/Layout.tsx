import { useState, useRef, useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import { Camera, FolderKanban, Images, Layers, LogOut, Bell, ArrowLeftRight } from 'lucide-react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, useCollection } from '../lib/hooks'
import type { Notification } from '../lib/api'

type Props = { children: ReactNode }

const links = [
  { to: '/', label: 'Collection', icon: FolderKanban },
  { to: '/scan', label: 'Scan', icon: Camera },
  { to: '/upload', label: 'Upload', icon: Images },
  { to: '/deck', label: 'Deck Builder', icon: Layers },
  { to: '/trades', label: 'Trades', icon: ArrowLeftRight },
]

export default function Layout({ children }: Props) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: collection = [] } = useCollection(true)

  const [notifOpen, setNotifOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // Poll notifications every 60 seconds
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.listNotifications(),
    refetchInterval: 60_000,
  })
  const notifications: Notification[] = (notifData as any)?.notifications ?? []
  const unreadCount: number = (notifData as any)?.unread_count ?? 0

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOneRead = useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleLogout() {
    await api.logout()
    await queryClient.invalidateQueries()
    navigate('/login')
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-[980px] px-4 pb-24 pt-6 sm:px-6">
      <header className="glass sticky top-3 z-20 mb-6 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--primary),var(--secondary))]" />
            <div>
              <h1 className="text-lg font-bold">Card Safe HQ</h1>
              <p className="text-xs text-cv-muted">The command center for card collectors</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative rounded-full px-3 py-2 text-sm ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
                }
              >
                {link.label}
                {link.to === '/' && collection.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--primary)]/20 px-1.5 py-0.5 text-xs text-[var(--primary)]">
                    {collection.length}
                  </span>
                )}
              </NavLink>
            ))}

            {/* Notification bell */}
            <div ref={bellRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o)
                  if (!notifOpen && unreadCount > 0) markAllRead.mutate()
                }}
                className="relative btn-ghost p-2"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-[var(--radius-lg)] border border-cv-border bg-cv-bg shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-cv-border px-4 py-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    {notifications.some((n) => n.read === 0) && (
                      <button
                        type="button"
                        onClick={() => markAllRead.mutate()}
                        className="text-xs text-[var(--primary)] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-cv-muted">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-cv-border px-4 py-3 last:border-0 ${n.read === 0 ? 'bg-cv-surface' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{n.title}</p>
                              {n.body && <p className="text-xs text-cv-muted mt-0.5 truncate">{n.body}</p>}
                              <p className="text-xs text-cv-muted mt-0.5">
                                {new Date(n.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {n.trade_id && (
                                <Link
                                  to={`/trades/${n.trade_id}`}
                                  onClick={() => setNotifOpen(false)}
                                  className="text-xs text-[var(--primary)] hover:underline"
                                >
                                  View
                                </Link>
                              )}
                              {n.read === 0 && (
                                <button
                                  type="button"
                                  onClick={() => markOneRead.mutate(n.id)}
                                  className="h-2 w-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary)]/60"
                                  title="Mark as read"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="rounded-full bg-cv-surface px-3 py-2 text-xs text-cv-muted">
              {user?.username || user?.email}
            </span>
            <button className="btn-ghost" onClick={handleLogout} type="button">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Mobile nav — 5 items now */}
      <nav className="glass fixed inset-x-3 bottom-3 z-30 mx-auto grid max-w-[980px] grid-cols-5 gap-1 p-2 sm:hidden">
        {links.map((link) => {
          const Icon = link.icon
          const isTrades = link.to === '/trades'
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center rounded-[var(--radius-md)] px-1 py-2 text-xs ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
              }
            >
              <div className="relative">
                <Icon className="mb-1 h-4 w-4" />
                {isTrades && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary)] text-[8px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {link.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
