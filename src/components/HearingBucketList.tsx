import Link from 'next/link'

type Row = { hearingId: string; caseId: string; caseTitle: string; courtName: string; date: string; purpose: string | null }

export function HearingBucketList({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <section className="mb-6">
      <h2 className="font-medium mb-2">{title}</h2>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.hearingId} className="py-2">
            <Link href={`/cases/${r.caseId}`} className="hover:underline">{r.caseTitle}</Link>
            <p className="text-sm text-gray-500">{r.courtName} · {r.date} · {r.purpose}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
