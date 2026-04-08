import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Package, Upload } from 'lucide-react'
import UploadDropzone from '../components/UploadDropzone'
import { api } from '../lib/api'

type Stage = 'idle' | 'creating' | 'uploading' | 'analyzing' | 'comps' | 'error'

const SEALED_TYPES = new Set([
  'booster_pack', 'booster_box', 'etb', 'tin', 'bundle', 'promo_pack', 'other_sealed',
])

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

export default function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')
  const [productType, setProductType] = useState<string>('single_card')
  const [productName, setProductName] = useState<string>('')

  const isSealed = SEALED_TYPES.has(productType)
  const isLoading = stage === 'creating' || stage === 'uploading' || stage === 'analyzing' || stage === 'comps'

  const label = useMemo(() => {
    if (stage === 'creating') return 'Creating collection entry...'
    if (stage === 'uploading') return 'Uploading image...'
    if (stage === 'analyzing') return isSealed ? 'Fetching sealed product pricing...' : 'Analyzing with AI...'
    if (stage === 'comps') return 'Fetching market data...'
    return ''
  }, [stage, isSealed])

  async function startUpload() {
    if (!file) return
    setError('')
    try {
      setStage('creating')
      const created = await api.createCollectionItem({
        quantity: 1,
        product_type: productType as any,
        product_name: isSealed ? (productName.trim() || undefined) : undefined,
      })
      setStage('uploading')
      await api.uploadDirect(created.id, side, file)
      setStage('analyzing')
      // identifyCard handles sealed fast-path on the backend (skips AI, uses eBay comps)
      await api.identifyCard(created.id)
      if (!isSealed) {
        setStage('comps')
        if (created.card_id) await api.refreshComps(created.card_id)
      }
      navigate(`/review?id=${created.id}&added=1`)
    } catch (err) {
      setStage('error')
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode cards — only show scan option for single cards */}
      {!isSealed && (
        <div className="glass mb-6 rounded-[var(--radius-lg)] p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--primary)]/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Camera className="h-5 w-5 text-[var(--primary)]" />
                <span className="font-semibold">AI Scan</span>
                <span className="rounded-full bg-[var(--primary)]/20 px-2 py-0.5 text-xs text-[var(--primary)]">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-cv-muted">
                Upload a 9-pocket binder page. AI identifies all 9 cards automatically,
                grades them, and adds them to your collection instantly.
              </p>
              <Link to="/scan" className="btn-primary mt-3 block text-center text-xs">
                Go to Scan →
              </Link>
            </div>
            <div className="rounded-[var(--radius-md)] border border-cv-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Upload className="h-5 w-5 text-cv-muted" />
                <span className="font-semibold">Manual Upload</span>
              </div>
              <p className="text-xs text-cv-muted">
                Upload a single card photo and enter all details manually.
                Use this for cards you want full control over.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sealed product banner */}
      {isSealed && (
        <div className="glass rounded-[var(--radius-lg)] p-4 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">Sealed Product Mode</p>
              <p className="text-xs text-cv-muted mt-0.5">
                AI card identification is skipped for sealed products. Upload a photo of the
                product and enter its name — we'll fetch eBay sold prices automatically for valuation.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="glass p-5">
        <h2 className="mb-2 text-xl font-bold">
          {isSealed ? `Add Sealed Product` : 'Upload card'}
        </h2>
        <p className="mb-4 text-sm text-cv-muted">
          {isSealed
            ? 'Upload a photo of the sealed product, then enter its name below.'
            : 'Step 1: Select image then continue to AI analysis. '}
          {!isSealed && (
            <Link to="/review" className="text-[var(--primary)] underline-offset-2 hover:underline">
              View review queue
            </Link>
          )}
        </p>

        {/* Product type selector — shown first */}
        <div className="mb-4 flex flex-col gap-2">
          <label className="text-sm font-medium">Product Type</label>
          <select
            className="input"
            value={productType}
            onChange={(e) => { setProductType(e.target.value); setProductName('') }}
          >
            {Object.entries(PRODUCT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {isSealed && (
            <input
              className="input"
              placeholder={`Product name (e.g. Scarlet & Violet ${PRODUCT_TYPE_LABELS[productType]})`}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          )}
        </div>

        <UploadDropzone
          loading={isLoading}
          onFile={(selectedFile, selectedSide) => {
            setFile(selectedFile)
            setSide(selectedSide)
          }}
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-primary"
            disabled={!file || isLoading}
            onClick={startUpload}
            type="button"
          >
            {isSealed ? 'Add to Collection' : 'Next'}
          </button>
          {label && <span className="text-sm text-cv-muted">{label}</span>}
        </div>
        {error && (
          <div className="mt-3 rounded-[var(--radius-md)] border border-cv-danger/50 bg-cv-danger/10 p-3 text-sm text-cv-danger">
            {error}
          </div>
        )}
      </section>
    </div>
  )
}
