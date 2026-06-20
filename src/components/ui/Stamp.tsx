type StampProps = {
  children: React.ReactNode
  tone?: 'seal' | 'ink' | 'court-green' | 'brass'
  className?: string
}

const toneClasses: Record<NonNullable<StampProps['tone']>, string> = {
  seal: 'text-seal',
  ink: 'text-ink-soft',
  'court-green': 'text-court-green',
  brass: 'text-brass',
}

/**
 * The recurring signature element: an ink-stamp mark. Used sparingly —
 * one per screen at most — for the single most load-bearing fact on
 * that screen (filed, overdue, sync status), never as decoration.
 */
export function Stamp({ children, tone = 'seal', className = '' }: StampProps) {
  return (
    <span className={`stamp ${toneClasses[tone]} ${className}`} aria-hidden={false}>
      {children}
    </span>
  )
}
