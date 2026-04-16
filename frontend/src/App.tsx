import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SemiProtectedRoute from './components/SemiProtectedRoute'
import AdminPage from './pages/AdminPage'
import CardDetailPage from './pages/CardDetailPage'
import CollectionPage from './pages/CollectionPage'
import PortfolioPage from './pages/PortfolioPage'
import DeckBuilderPage from './pages/DeckBuilderPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import ScanPage from './pages/ScanPage'
import UploadPage from './pages/UploadPage'
import TradesPage from './pages/TradesPage'
import TradeDetailPage from './pages/TradeDetailPage'
import NewTradePage from './pages/NewTradePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import SearchPage from './pages/SearchPage'
import AccountPage from './pages/AccountPage'
import ShopPage from './pages/ShopPage'

// Requires login
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

// Works for both guests and logged-in users (no redirect to login)
function Public({ children }: { children: React.ReactNode }) {
  return (
    <SemiProtectedRoute>
      <Layout>{children}</Layout>
    </SemiProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Auth pages — no layout */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/register"        element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />
      <Route path="/verify-email"    element={<VerifyEmailPage />} />

      {/* Public pages — accessible without login */}
      <Route path="/search"      element={<Public><SearchPage /></Public>} />
      <Route path="/sealed"      element={<Public><SearchPage /></Public>} />
      <Route path="/shop"        element={<Public><ShopPage /></Public>} />
      <Route path="/deck"        element={<Public><DeckBuilderPage /></Public>} />
      <Route path="/deck-builder" element={<Public><DeckBuilderPage /></Public>} />
      <Route path="/membership"  element={<Navigate to="/shop" replace />} />

      {/* Protected pages — require login */}
      {/* Root → Search (public, no login wall) */}
      <Route path="/"          element={<Navigate to="/search" replace />} />
      {/* Portfolio — public route, shows sign-in prompt for guests inside the page */}
      <Route path="/portfolio" element={<Public><PortfolioPage /></Public>} />
      {/* Legacy collection route preserved */}
      <Route path="/collection" element={<Protected><CollectionPage /></Protected>} />
      <Route path="/scan"      element={<Protected><ScanPage /></Protected>} />
      <Route path="/upload"    element={<Protected><UploadPage /></Protected>} />
      <Route path="/review"    element={<Protected><ReviewQueuePage /></Protected>} />
      <Route path="/card/:id"  element={<Protected><CardDetailPage /></Protected>} />
      <Route path="/admin"     element={<Protected><AdminPage /></Protected>} />
      <Route path="/account"   element={<Protected><AccountPage /></Protected>} />

      {/* Trades */}
      <Route path="/trades"     element={<Public><TradesPage /></Public>} />
      <Route path="/trades/new" element={<Protected><NewTradePage /></Protected>} />
      <Route path="/trades/:id" element={<Protected><TradeDetailPage /></Protected>} />

      {/* Billing redirect → shop */}
      <Route path="/billing" element={<Navigate to="/shop" replace />} />

      <Route path="*" element={<Navigate to="/search" replace />} />
      {/* /home alias */}
      <Route path="/home" element={<Navigate to="/search" replace />} />
    </Routes>
  )
}
