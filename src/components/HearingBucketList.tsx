import Link from 'next/link'
import { Tag } from '@/components/ui/Tag'

type Row = { hearingId: string; caseId: string; caseTitle: string; courtName: string; date: string; purpose: string | null }
type Tone = 'seal' | 'brass' | 'ink' | 'court-green'

export function HearingBucketList({ title, rows, tone = 'ink' }: { title: string; rows: Row[]; tone?: Tone }) {
  if (rows.length === 0) return null
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-display text-xl">{title}</h2>
        <Tag tone={tone}>{rows.length}</Tag>
      </div>
      <ul className="divide-y divide-rule border-t border-rule">
        {rows.map((r) => (
          <li key={r.hearingId} className="py-3 flex items-baseline justify-between gap-4">
            <div>
              <Link href={`/cases/${r.caseId}`} className="hover:text-seal transition-colors">
                {r.caseTitle}
              </Link>
              <p className="text-sm text-ink-soft mt-0.5">
                {r.courtName}
                {r.purpose ? ` · ${r.purpose}` : ''}
              </p>
            </div>
            <span className="font-mono text-sm text-ink-soft whitespace-nowrap">{r.date}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
