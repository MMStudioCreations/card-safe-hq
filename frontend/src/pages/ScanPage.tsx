import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import CardCrop from '../components/CardCrop'

type State = 'idle' | 'processing' | 'done' | 'error'

interface ScanResultItem {
  id: number
  card_name?: string
  set_name?: string
  estimated_grade?: string
  estimated_value_cents?: number
  sheet_url?: string
  bbox?: { x: number; y: number; width: number; height: number }
}

const STATUS_MESSAGES = [
  'Uploading scan...',
  'Detecting cards with AI...',
  'Identifying each card...',
  'Estimating grades...',
  'Fetching market prices...',
  'Saving to your collection...',
]

export default function ScanPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [result, setResult] = useState<{ cards_detected: number; collection_items: ScanResultItem[] } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (state !== 'processing') return
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [state])

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
    setResult(null)
    setErrorMessage(null)

    try {
      const data = await api.scanSheet(selectedFile)
      await queryClient.invalidateQueries({ queryKey: ['collection'] })
      setResult({ cards_detected: data.cards_detected, collection_items: data.collection_items })
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
    setResult(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Scan Binder Page</h2>
        <p className="mt-1 text-sm text-cv-muted">
          Upload a scanned 9-pocket binder page to automatically identify and grade each card.
        </p>
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
                  <p className="font-semibold">Upload your 9-pocket binder page scan</p>
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
            <p className="font-semibold">{STATUS_MESSAGES[statusIndex]}</p>
            <p className="mt-1 text-xs text-cv-muted">This may take up to 30 seconds</p>
          </div>
        </div>
      )}

      {state === 'done' && result && (
        <div className="space-y-6">
          <div className="glass rounded-[var(--radius-lg)] p-5 text-center">
            <p className="text-2xl font-bold text-[var(--primary)]">{result.cards_detected}</p>
            <p className="mt-1 text-sm text-cv-muted">
              {result.cards_detected === 1 ? 'card' : 'cards'} detected and added to your collection
            </p>
          </div>

          {result.collection_items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {result.collection_items.map((item: ScanResultItem) => (
                <div key={item.id} className="glass rounded-[var(--radius-lg)] overflow-hidden">
                  {item.sheet_url && item.bbox ? (
                    <CardCrop
                      sheetUrl={`${import.meta.env.VITE_API_URL}/api/images/${encodeURIComponent(item.sheet_url)}`}
                      bbox={item.bbox}
                      className="w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-cv-surface text-cv-muted text-sm">
                      No image
                    </div>
                  )}
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
              ))}
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
