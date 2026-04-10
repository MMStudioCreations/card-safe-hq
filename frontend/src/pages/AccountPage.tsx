import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { User, Lock, CreditCard, Shield, Save, Eye, EyeOff, Crown, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth, useBillingStatus } from '../lib/hooks'
import { api } from '../lib/api'

type Section = 'profile' | 'password' | 'billing'

export default function AccountPage() {
  const { data: user } = useAuth()
  const { data: billing } = useBillingStatus()
  const queryClient = useQueryClient()

  const [activeSection, setActiveSection] = useState<Section>('profile')

  // Profile form
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Billing portal
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalMsg, setPortalMsg] = useState('')

  const isPro = billing?.tier === 'pro'
  const plan = billing?.plan ?? 'free'
  const isOwner = (billing as any)?.is_owner === true

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      await api.updateProfile({ username: username.trim(), email: email.trim() })
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: (err as Error).message })
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setPasswordSaving(true)
    setPasswordMsg(null)
    try {
      await api.changePassword({ currentPassword, newPassword })
      setPasswordMsg({ type: 'success', text: 'Password changed. You may need to log in again on other devices.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: (err as Error).message })
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleBillingPortal() {
    setPortalLoading(true)
    setPortalMsg('')
    try {
      const result = await api.createPortalSession()
      window.location.href = (result as any).url
    } catch (err) {
      setPortalMsg((err as Error).message)
      setPortalLoading(false)
    }
  }

  const sidebarItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'password', label: 'Password', icon: <Lock className="h-4 w-4" /> },
    { id: 'billing', label: 'Billing & Plan', icon: <CreditCard className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-cv-muted text-sm mt-1">Manage your profile, security, and subscription.</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Sidebar */}
        <aside className="sm:w-48 shrink-0">
          <nav className="glass rounded-[var(--radius-lg)] p-2 space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-left transition-colors ${
                  activeSection === item.id
                    ? 'bg-cv-surfaceStrong text-cv-text'
                    : 'text-cv-muted hover:text-cv-text hover:bg-cv-surface'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div className="glass rounded-[var(--radius-lg)] p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(201,168,76,0.2))', border: '1px solid rgba(0,229,255,0.3)' }}>
                  {(user?.username || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{user?.username || 'No username set'}</p>
                  <p className="text-sm text-cv-muted">{user?.email}</p>
                  <p className="text-xs text-cv-muted mt-0.5">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    maxLength={50}
                    className="input w-full"
                  />
                  <p className="text-xs text-cv-muted mt-1">This is how other collectors will see you in trades.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input w-full"
                  />
                  <p className="text-xs text-cv-muted mt-1">Changing your email will require re-verification.</p>
                </div>

                {profileMsg && (
                  <div className={`flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm ${
                    profileMsg.type === 'success'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {profileMsg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {profileMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* Password Section */}
          {activeSection === 'password' && (
            <div className="glass rounded-[var(--radius-lg)] p-6 space-y-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#f97316]" />
                <h2 className="text-lg font-semibold">Change Password</h2>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="input w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cv-muted hover:text-cv-text"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      className="input w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cv-muted hover:text-cv-text"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Password strength indicator */}
                  {newPassword.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4].map((level) => {
                        const strength = Math.min(4, Math.floor(newPassword.length / 3))
                        return (
                          <div
                            key={level}
                            className="h-1 flex-1 rounded-full transition-colors"
                            style={{
                              background: level <= strength
                                ? strength <= 1 ? '#ef4444' : strength <= 2 ? '#f59e0b' : strength <= 3 ? '#22c55e' : '#f97316'
                                : 'rgba(255,255,255,0.1)'
                            }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="input w-full"
                    required
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                {passwordMsg && (
                  <div className={`flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm ${
                    passwordMsg.type === 'success'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {passwordMsg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {passwordMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passwordSaving || newPassword !== confirmPassword}
                  className="btn-primary flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  {passwordSaving ? 'Changing...' : 'Change Password'}
                </button>
              </form>

              <div className="border-t border-cv-border pt-4">
                <p className="text-xs text-cv-muted">
                  Changing your password will sign you out of all other devices for security. Your current session will remain active.
                </p>
              </div>
            </div>
          )}

          {/* Billing Section */}
          {activeSection === 'billing' && (
            <div className="glass rounded-[var(--radius-lg)] p-6 space-y-6">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#f59e0b]" />
                <h2 className="text-lg font-semibold">Billing & Plan</h2>
              </div>

              {/* Current plan display */}
              <div className="rounded-[var(--radius-md)] p-4 space-y-3"
                style={{
                  background: isOwner
                    ? 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(245,158,11,0.06))'
                    : isPro
                    ? plan === 'yearly'
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))'
                      : 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(249,115,22,0.06))'
                    : 'rgba(255,255,255,0.04)',
                  border: isOwner
                    ? '1px solid rgba(249,115,22,0.45)'
                    : isPro
                    ? plan === 'yearly'
                      ? '1px solid rgba(245,158,11,0.35)'
                      : '1px solid rgba(249,115,22,0.30)'
                    : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <Crown className="h-5 w-5 text-[#f59e0b]" />
                    ) : isPro ? (
                      <Crown className="h-5 w-5" style={{ color: plan === 'yearly' ? '#f59e0b' : '#f97316' }} />
                    ) : (
                      <Shield className="h-5 w-5 text-cv-muted" />
                    )}
                    <span className="font-semibold">
                      {isOwner ? 'Owner — Full Access' : isPro ? (plan === 'yearly' ? 'Pro Yearly' : 'Pro Monthly') : 'Free Plan'}
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: isOwner ? '#f59e0b' : isPro ? (plan === 'yearly' ? '#f59e0b' : '#f97316') : 'var(--cv-muted)' }}>
                    {isOwner ? 'Complimentary' : isPro ? (plan === 'yearly' ? '$100/yr' : '$10/mo') : '$0'}
                  </span>
                </div>

                {billing?.current_period_end && !isOwner && (
                  <p className="text-xs text-cv-muted">
                    {billing.cancel_at_period_end ? 'Cancels' : 'Renews'} on{' '}
                    {new Date(billing.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}

                {isOwner && (
                  <p className="text-xs text-cv-muted">You have full access to all features as the account owner.</p>
                )}
              </div>

              {/* Actions */}
              {!isOwner && (
                <div className="space-y-3">
                  {isPro ? (
                    <button
                      onClick={handleBillingPortal}
                      disabled={portalLoading}
                      className="btn-secondary flex items-center gap-2 w-full justify-center"
                    >
                      <CreditCard className="h-4 w-4" />
                      {portalLoading ? 'Opening...' : 'Manage Payment Method & Subscription'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-cv-muted">Upgrade to unlock AI scanning, unlimited collection, trades, and more.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Link
                          to="/membership"
                          className="btn-secondary text-center text-sm"
                        >
                          View Plans
                        </Link>
                        <Link
                          to="/billing"
                          className="btn-primary text-center text-sm"
                        >
                          Upgrade Now
                        </Link>
                      </div>
                    </div>
                  )}

                  {portalMsg && (
                    <p className="text-sm text-red-400">{portalMsg}</p>
                  )}
                </div>
              )}

              {/* Plan features summary */}
              <div className="border-t border-cv-border pt-4">
                <p className="text-xs font-medium text-cv-muted uppercase tracking-wider mb-3">Your Plan Includes</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {[
                    { label: 'Search all TCG products', included: true },
                    { label: 'Basic deck builder', included: true },
                    { label: 'Manual card upload', included: true },
                    { label: 'AI binder sheet scan', included: isPro },
                    { label: 'Full deck builder (60 cards)', included: isPro },
                    { label: 'Trades marketplace', included: isPro },
                    { label: 'Monthly giveaway entry', included: isPro },
                    { label: 'Early access features', included: plan === 'yearly' || isOwner },
                  ].map((f) => (
                    <div key={f.label} className={`flex items-center gap-2 text-xs ${f.included ? 'text-cv-text' : 'text-cv-muted'}`}>
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${f.included ? 'bg-[#f97316]' : 'bg-white/20'}`} />
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
