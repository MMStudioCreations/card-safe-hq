import { useEffect, useRef, useState } from 'react'

interface BBox {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  sheetUrl: string
  bbox: BBox
  alt?: string
  className?: string
}

export default function CardCrop({ sheetUrl, bbox, alt, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setError(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Slight inset (0.5%) to avoid showing adjacent card borders.
      // The bbox coordinates from the backend already include the full card area,
      // so we inset slightly rather than expand.
      const INSET = 0.5
      const rawX = Math.min(100, bbox.x + INSET)
      const rawY = Math.min(100, bbox.y + INSET)
      const rawW = Math.max(0, bbox.width - INSET * 2)
      const rawH = Math.max(0, bbox.height - INSET * 2)

      const cropX = (rawX / 100) * img.naturalWidth
      const cropY = (rawY / 100) * img.naturalHeight
      const cropW = (rawW / 100) * img.naturalWidth
      const cropH = (rawH / 100) * img.naturalHeight

      canvas.width = cropW
      canvas.height = cropH
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
      setLoaded(true)
    }

    img.onerror = () => setError(true)
    img.src = sheetUrl
  }, [sheetUrl, bbox.x, bbox.y, bbox.width, bbox.height])

  if (error) return null

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: loaded ? 'block' : 'none',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      }}
      aria-label={alt}
    />
  )
}
