import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Upload } from 'lucide-react'
import UploadDropzone from '../components/UploadDropzone'
import { api } from '../lib/api'

type Stage = 'idle' | 'creating' | 'uploading' | 'analyzing' | 'comps' | 'error'

export default function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')

  const label = useMemo(() => {
    if (stage === 'creating') return 'Creating collection entry...'
    if (stage === 'uploading') return 'Uploading image...'
    if (stage === 'analyzing') return 'Analyzing with AI...'
    if (stage === 'comps') return 'Fetching market data...'
    return ''
  }, [stage])

  async function startUpload() {
    if (!file) return
    setError('')
    try {
      setStage('creating')
      const created = await api.createCollectionItem({ quantity: 1 })
      setStage('uploading')
      await api.uploadDirect(created.id, side, file)
      setStage('analyzing')
      await api.identifyCard(created.id)
      setStage('comps')
      if (created.card_id) await api.refreshComps(created.card_id)
      navigate(`/review?id=${created.id}&added=1`)
    } catch (err) {
      setStage('error')
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
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

      <section className="glass p-5">
        <h2 className="mb-2 text-xl font-bold">Upload card</h2>
        <p className="mb-4 text-sm text-cv-muted">
          Step 1: Select image then continue to AI analysis.{' '}
          <Link to="/review" className="text-[var(--primary)] underline-offset-2 hover:underline">
            View review queue
          </Link>
        </p>
        <UploadDropzone
          loading={stage !== 'idle' && stage !== 'error'}
          onFile={(selectedFile, selectedSide) => {
            setFile(selectedFile)
            setSide(selectedSide)
          }}
        />
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" disabled={!file || stage === 'creating' || stage === 'uploading' || stage === 'analyzing' || stage === 'comps'} onClick={startUpload} type="button">
            Next
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
