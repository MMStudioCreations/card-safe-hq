import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const ringPos = useRef({ x: -100, y: -100 })
  const mousePos = useRef({ x: -100, y: -100 })
  const hovered = useRef(false)
  const scale = useRef(1)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) return
    setReady(true)

    function onMove(e: MouseEvent) {
      mousePos.current = { x: e.clientX, y: e.clientY }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 5}px, ${e.clientY - 5}px)`
      }
    }

    function onOver(e: MouseEvent) {
      hovered.current = !!(e.target as Element).closest(
        'a, button, .hoverable, [role="button"]',
      )
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)

    let rafId: number
    function loop() {
      const ease = 0.12
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * ease
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * ease
      scale.current += ((hovered.current ? 1.8 : 1) - scale.current) * 0.15
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPos.current.x - 18}px, ${ringPos.current.y - 18}px) scale(${scale.current})`
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      cancelAnimationFrame(rafId)
    }
  }, [])

  if (!ready) return null

  return (
    <>
      <div
        ref={dotRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: 10, height: 10, borderRadius: '50%',
          background: '#C8A951',
          pointerEvents: 'none', zIndex: 9999,
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: 36, height: 36, borderRadius: '50%',
          border: '1.5px solid rgba(200,169,81,0.7)',
          pointerEvents: 'none', zIndex: 9998,
          willChange: 'transform',
        }}
      />
    </>
  )
}
