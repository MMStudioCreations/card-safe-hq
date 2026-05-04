import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  colorBase: string
  alpha: number
  life: number
  maxLife: number
}

const COLORS = [
  'rgba(200,169,81,',
  'rgba(155,89,255,',
  'rgba(0,200,255,',
  'rgba(255,61,180,',
]

function makeParticle(w: number, h: number): Particle {
  const maxLife = 200 + Math.random() * 400
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size: 0.3 + Math.random() * 1.5,
    colorBase: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 0,
    life: 0,
    maxLife,
  }
}

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.innerWidth < 768) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    const particles: Particle[] = Array.from({ length: 80 }, () => {
      const p = makeParticle(window.innerWidth, window.innerHeight)
      p.life = Math.random() * p.maxLife
      return p
    })

    let rafId: number
    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.life++
        p.x += p.vx
        p.y += p.vy

        const half = p.maxLife / 2
        p.alpha = Math.max(0, Math.min(0.7, p.life < half ? p.life / half : (p.maxLife - p.life) / half))

        if (p.life >= p.maxLife) {
          particles[i] = makeParticle(canvas.width, canvas.height)
          continue
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.colorBase + p.alpha + ')'
        ctx.fill()
      }

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }}
    />
  )
}
