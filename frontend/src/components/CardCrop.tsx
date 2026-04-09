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
      // Add 3% padding on each side so card edges are never clipped
      const PAD = 3
      const rawX = Math.max(0, bbox.x - PAD)
      const rawY = Math.max(0, bbox.y - PAD)
      const rawW = Math.min(100 - rawX, bbox.width + PAD * 2)
      const rawH = Math.min(100 - rawY, bbox.height + PAD * 2)

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
      style={{ display: loaded ? 'block' : 'none' }}
      aria-label={alt}
    />
  )
}
