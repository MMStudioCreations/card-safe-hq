import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'

type Props = {
  onFile: (file: File, side: 'front' | 'back') => void
  loading: boolean
}

const allowed = ['image/jpeg', 'image/png', 'image/webp']

export default function UploadDropzone({ onFile, loading }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('front')
  const inputRef = useRef<HTMLInputElement>(null)

  function validate(file: File) {
    if (!allowed.includes(file.type)) return 'Only JPEG, PNG, and WEBP are accepted.'
    if (file.size > 8 * 1024 * 1024) return 'File must be under 8MB.'
    return ''
  }

  function processFile(file: File) {
    const issue = validate(file)
    if (issue) {
      setError(issue)
      return
    }
    setError('')
    const objectUrl = URL.createObjectURL(file)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return objectUrl
    })
    onFile(file, side)
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? [])[0]
      if (file) {
        event.preventDefault()
        processFile(file)
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['front', 'back'] as const).map((value) => (
          <button
            key={value}
            className={value === side ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setSide(value)}
            type="button"
          >
            {value === 'front' ? 'Front image' : 'Back image'}
          </button>
        ))}
      </div>

      <div
        className={`glass cursor-pointer border-2 border-dashed p-6 text-center ${dragging ? 'border-cv-secondary' : 'border-cv-border'}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file) processFile(file)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          className="hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          ref={inputRef}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) processFile(file)
          }}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cv-secondary" />
            <p className="text-sm text-cv-muted">Uploading image...</p>
          </div>
        ) : preview ? (
          <img className="mx-auto max-h-72 rounded-[var(--radius-md)]" src={preview} alt="Preview" />
        ) : (
          <div className="space-y-2">
            <ImagePlus className="mx-auto h-10 w-10 text-cv-secondary" />
            <p className="font-semibold">Drop your card image here or click to browse</p>
            <p className="text-xs text-cv-muted">You can also paste from clipboard (Ctrl/Cmd+V)</p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-cv-danger">{error}</p>}
    </div>
  )
}
