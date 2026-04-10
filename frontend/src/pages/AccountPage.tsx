import { useAuth } from '../lib/hooks'

export default function AccountPage() {
  const { data: user } = useAuth()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-cv-muted">Profile and membership overview.</p>
      </div>

      <section className="glass p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-cv-muted">Email</span>
          <span className="text-sm">{user?.email ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-cv-muted">Username</span>
          <span className="text-sm">{user?.username ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-cv-muted">Member Since</span>
          <span className="text-sm">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
        </div>
      </section>
    </div>
  )
}
