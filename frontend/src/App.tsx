import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SemiProtectedRoute from './components/SemiProtectedRoute'
import CustomCursor from './components/CustomCursor'
import ParticleCanvas from './components/ParticleCanvas'
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
import BillingPage from './pages/BillingPage'
import HomePage from './pages/HomePage'

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

function Public({ children }: { children: React.ReactNode }) {
  return (
    <SemiProtectedRoute>
      <Layout>{children}</Layout>
    </SemiProtectedRoute>
  )
}

export default function App() {
  return (
    <>
      <CustomCursor />
      <ParticleCanvas />

      <Routes>
        {/* Auth pages — no layout */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/verify-email"    element={<VerifyEmailPage />} />

        {/* Home — standalone landing page (own Navbar + footer) */}
        <Route path="/" element={<HomePage />} />

        {/* Primary public routes */}
        <Route path="/builder"     element={<Public><DeckBuilderPage /></Public>} />
        <Route path="/protection"  element={<Public><ShopPage /></Public>} />
        <Route path="/membership"  element={<Public><BillingPage /></Public>} />
        <Route path="/billing"     element={<Public><BillingPage /></Public>} />

        {/* Alias routes kept for backwards compatibility */}
        <Route path="/shop"         element={<Navigate to="/protection" replace />} />
        <Route path="/deck"         element={<Navigate to="/builder" replace />} />
        <Route path="/deck-builder" element={<Navigate to="/builder" replace />} />
        <Route path="/search"       element={<Public><SearchPage /></Public>} />
        <Route path="/sealed"       element={<Public><SearchPage /></Public>} />

        {/* Protected app routes */}
        <Route path="/portfolio"  element={<Public><PortfolioPage /></Public>} />
        <Route path="/collection" element={<Protected><CollectionPage /></Protected>} />
        <Route path="/scan"       element={<Protected><ScanPage /></Protected>} />
        <Route path="/upload"     element={<Protected><UploadPage /></Protected>} />
        <Route path="/review"     element={<Protected><ReviewQueuePage /></Protected>} />
        <Route path="/card/:id"   element={<Protected><CardDetailPage /></Protected>} />
        <Route path="/admin"      element={<Protected><AdminPage /></Protected>} />
        <Route path="/account"    element={<Protected><AccountPage /></Protected>} />

        {/* Trades */}
        <Route path="/trades"     element={<Public><TradesPage /></Public>} />
        <Route path="/trades/new" element={<Protected><NewTradePage /></Protected>} />
        <Route path="/trades/:id" element={<Protected><TradeDetailPage /></Protected>} />

        {/* Catch-all → home */}
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*"     element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
