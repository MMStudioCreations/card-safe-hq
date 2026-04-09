import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import CardCrop from '../components/CardCrop'

type Mode = 'sheet' | 'single'
type State = 'idle' | 'processing' | 'done' | 'error'

interface ScanResultItem {
  id: number
  card_name?: string
  set_name?: string
  estimated_grade?: string
  estimated_value_cents?: number
  sheet_url?: string
  front_image_url?: string
  bbox?: { x: number; y: number; width: number; height: number }
  identification_confidence?: number
}

const STATUS_MESSAGES = [
  'Uploading scan...',
  'Detecting cards with AI...',
  'Identifying each card...',
  'Estimating grades...',
  'Fetching market prices...',
  'Saving to your collection...',
]

const SINGLE_STATUS_MESSAGES = [
  'Uploading image...',
  'Identifying card with AI...',
  'Fetching market prices...',
  'Saving to your collection...',
]

export default function ScanPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<Mode>('sheet')
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [sheetResult, setSheetResult] = useState<{ cards_detected: number; collection_items: ScanResultItem[] } | null>(null)
  const [singleResult, setSingleResult] = useState<ScanResultItem | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const statusMessages = mode === 'single' ? SINGLE_STATUS_MESSAGES : STATUS_MESSAGES

  useEffect(() => {
    if (state !== 'processing') return
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % statusMessages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [state, statusMessages.length])

  function handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Unsupported file type. Please use JPEG, PNG, or WebP.')
      setState('error')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('File is too large. Maximum size is 20MB.')
      setState('error')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    setSelectedFile(file)
    setState('idle')
    setErrorMessage(null)
  }

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  async function handleSubmit() {
    if (!selectedFile) return
    setState('processing')
    setStatusIndex(0)
    setSheetResult(null)
    setSingleResult(null)
    setErrorMessage(null)

    try {
      const data = await api.scanSheet(selectedFile, mode)
      await queryClient.invalidateQueries({ queryKey: ['collection'] })

      if (mode === 'single') {
        if (data.card) {
          setSingleResult(data.card as ScanResultItem)
        }
      } else {
        setSheetResult({
          cards_detected: data.cards_detected ?? 0,
          collection_items: (data.collection_items ?? []) as ScanResultItem[],
        })
      }
      setState('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Scan failed. Please try again.')
      setState('error')
    }
  }

  function handleReset() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSelectedFile(null)
    setState('idle')
    setSheetResult(null)
    setSingleResult(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleModeChange(newMode: Mode) {
    setMode(newMode)
    handleReset()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scan Card</h2>
        <p className="mt-1 text-sm text-cv-muted">
          Upload a card image to automatically identify and add it to your collection.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="glass flex rounded-[var(--radius-lg)] overflow-hidden">
        <button
          type="button"
          onClick={() => handleModeChange('sheet')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors
            ${mode === 'sheet'
              ? 'bg-[var(--primary)] text-white'
              : 'text-cv-muted hover:text-white'}`}
        >
          Binder Sheet (9-pocket)
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('single')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors
            ${mode === 'single'
              ? 'bg-[var(--primary)] text-white'
              : 'text-cv-muted hover:text-white'}`}
        >
          Single Card
        </button>
      </div>

      {(state === 'idle' || state === 'error') && (
        <div className="space-y-4">
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={`glass flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed p-8 text-center transition-colors
              ${dragOver ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-cv-surface hover:border-cv-muted'}
              ${selectedFile ? 'cursor-default' : ''}`}
          >
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="max-h-72 w-full rounded-[var(--radius-md)] object-contain"
              />
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cv-surface">
                  <svg className="h-8 w-8 text-cv-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">
                    {mode === 'sheet'
                      ? 'Upload your 9-pocket binder page scan'
                      : 'Upload a single card photo'}
                  </p>
                  <p className="mt-1 text-xs text-cv-muted">Supports JPEG, PNG, WebP up to 20MB</p>
                </div>
                <p className="text-xs text-cv-muted">Drag & drop or click to browse</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />

          {state === 'error' && errorMessage && (
            <div className="glass rounded-[var(--radius-md)] border border-red-500/30 p-4 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-3">
            {selectedFile && (
              <>
                <button className="btn-primary flex-1" onClick={handleSubmit} type="button">
                  Scan {selectedFile.name}
                </button>
                <button className="btn-ghost" onClick={handleReset} type="button">
                  Clear
                </button>
              </>
            )}
            {!selectedFile && state === 'error' && (
              <button className="btn-ghost w-full" onClick={handleReset} type="button">
                Try Again
              </button>
            )}
          </div>
        </div>
      )}

      {state === 'processing' && (
        <div className="glass flex min-h-64 flex-col items-center justify-center gap-6 rounded-[var(--radius-lg)] p-8 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cv-surface border-t-[var(--primary)]" />
          <div>
            <p className="font-semibold">{statusMessages[statusIndex]}</p>
            <p className="mt-1 text-xs text-cv-muted">This may take up to 30 seconds</p>
          </div>
        </div>
      )}

      {/* Single card result */}
      {state === 'done' && mode === 'single' && singleResult && (
        <div className="space-y-6">
          <div className="glass rounded-[var(--radius-lg)] p-5 text-center">
            <p className="text-2xl font-bold text-[var(--primary)]">Card identified</p>
            <p className="mt-1 text-sm text-cv-muted">Added to your collection</p>
          </div>

          <div className="glass rounded-[var(--radius-lg)] overflow-hidden">
            {preview && (
              <img
                src={preview}
                alt={singleResult.card_name ?? 'Scanned card'}
                className="w-full object-contain max-h-80"
              />
            )}
            <div className="p-4 space-y-1">
              <p className="font-semibold text-lg">{singleResult.card_name || 'Unknown Card'}</p>
              <p className="text-sm text-cv-muted">{singleResult.set_name || 'Unknown set'}</p>
              {singleResult.estimated_grade && (
                <p className="text-sm">Grade: {singleResult.estimated_grade}</p>
              )}
              {singleResult.estimated_value_cents != null && singleResult.estimated_value_cents > 0 && (
                <p className="text-sm">
                  Est. value: ${(singleResult.estimated_value_cents / 100).toFixed(2)}
                </p>
              )}
              {singleResult.identification_confidence != null && (
                <p className="text-xs text-cv-muted">
                  Confidence: {singleResult.identification_confidence}%
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Link to="/" className="btn-primary flex-1 text-center">
              View Full Collection
            </Link>
            <button className="btn-ghost" onClick={handleReset} type="button">
              Scan Another Card
            </button>
          </div>
        </div>
      )}

      {/* Sheet scan result */}
      {state === 'done' && mode === 'sheet' && sheetResult && (
        <div className="space-y-6">
          <div className="glass rounded-[var(--radius-lg)] p-5 text-center">
            <p className="text-2xl font-bold text-[var(--primary)]">{sheetResult.cards_detected}</p>
            <p className="mt-1 text-sm text-cv-muted">
              {sheetResult.cards_detected === 1 ? 'card' : 'cards'} detected and added to your collection
            </p>
          </div>

          {sheetResult.collection_items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sheetResult.collection_items.map((item: ScanResultItem) => {
                // New scans: front_image_url is a pre-cropped card JPEG (no bbox needed)
                // Legacy scans: sheet_url + bbox → canvas crop via CardCrop
                const apiBase = import.meta.env.VITE_API_URL
                const imageUrl = (item as any).front_image_url ?? item.sheet_url
                const needsCrop = item.sheet_url && item.bbox && item.sheet_url.includes('sheets/')
                return (
                  <div key={item.id} className="glass rounded-[var(--radius-lg)] overflow-hidden">
                    <div className="w-full bg-zinc-900" style={{ aspectRatio: '2.5/3.5' }}>
                      {needsCrop ? (
                        <CardCrop
                          sheetUrl={`${apiBase}/api/images/${encodeURIComponent(item.sheet_url!)}`}
                          bbox={item.bbox!}
                          className="w-full h-full"
                        />
                      ) : imageUrl ? (
                        <img
                          src={`${apiBase}/api/images/${encodeURIComponent(imageUrl)}`}
                          alt={item.card_name ?? 'Card'}
                          className="w-full h-full object-contain object-center"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-cv-muted text-sm">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm truncate">
                        {item.card_name || 'Unknown Card'}
                      </p>
                      <p className="text-xs text-cv-muted truncate">{item.set_name || 'Unknown set'}</p>
                      {item.estimated_grade && (
                        <p className="text-xs mt-1">Grade: {item.estimated_grade}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex gap-3">
            <Link to="/" className="btn-primary flex-1 text-center">
              View Full Collection
            </Link>
            <button className="btn-ghost" onClick={handleReset} type="button">
              Scan Another Page
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
