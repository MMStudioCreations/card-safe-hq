import { useEffect, useRef, useState } from 'react'

interface Props {
  sheetUrl: string
  bbox: { x: number; y: number; width: number; height: number }
  className?: string
}

export default function CardCrop({ sheetUrl, bbox, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = sheetUrl

    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const cropX = (bbox.x / 100) * img.naturalWidth
      const cropY = (bbox.y / 100) * img.naturalHeight
      const cropW = (bbox.width / 100) * img.naturalWidth
      const cropH = (bbox.height / 100) * img.naturalHeight

      canvas.width = cropW
      canvas.height = cropH

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
      setLoaded(true)
    }

    img.onerror = () => {
      setLoaded(false)
    }
  }, [sheetUrl, bbox])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: loaded ? 'block' : 'none' }}
    />
  )
}
