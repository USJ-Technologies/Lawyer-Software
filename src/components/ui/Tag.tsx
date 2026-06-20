type Tone = 'ink' | 'seal' | 'brass' | 'court-green'

const toneClasses: Record<Tone, string> = {
  ink: 'border-ink-soft text-ink-soft',
  seal: 'border-seal text-seal',
  brass: 'border-brass text-brass',
  'court-green': 'border-court-green text-court-green',
}

/** A small bordered label — file-tab styling, not a rounded SaaS pill. */
export function Tag({ children, tone = 'ink' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs font-mono uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
