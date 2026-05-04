export default function GlowLine() {
  return (
    <div
      style={{
        height: 1,
        background:
          'linear-gradient(90deg, transparent 0%, var(--gold) 20%, var(--holo-purple) 50%, var(--holo-blue) 80%, transparent 100%)',
        opacity: 0.3,
      }}
    />
  )
}
