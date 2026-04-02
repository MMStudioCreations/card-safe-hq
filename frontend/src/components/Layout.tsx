import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Camera, FolderKanban, Images, LogOut } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, useCollection } from '../lib/hooks'

type Props = { children: ReactNode }

const links = [
  { to: '/', label: 'Collection', icon: FolderKanban },
  { to: '/scan', label: 'Scan', icon: Camera },
  { to: '/upload', label: 'Upload', icon: Images },
]

export default function Layout({ children }: Props) {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: collection = [] } = useCollection(true)

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

      <nav className="glass fixed inset-x-3 bottom-3 z-30 mx-auto grid max-w-[980px] grid-cols-3 gap-2 p-2 sm:hidden">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center rounded-[var(--radius-md)] px-2 py-2 text-xs ${isActive ? 'bg-cv-surfaceStrong text-cv-text' : 'text-cv-muted'}`
              }
            >
              <Icon className="mb-1 h-4 w-4" />
              {link.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
