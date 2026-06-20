import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4 pb-4 mb-6 border-b border-rule">
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-seal mb-1">{eyebrow}</p>
        <h1 className="font-display text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  )
}
