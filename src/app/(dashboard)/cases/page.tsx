import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Tag'

export default async function CasesPage() {
  const supabase = await createClient()
  const { data: cases } = await supabase
    .from('case')
    .select('id, title, case_number, stage, status, client:client_id(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        eyebrow="Case register"
        title="Cases"
        action={<ButtonLink href="/cases/new">+ Case</ButtonLink>}
      />
      {(cases ?? []).length === 0 ? (
        <p className="text-ink-soft border-t border-rule pt-6">No cases on the docket yet.</p>
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {(cases ?? []).map((c: any) => (
            <li key={c.id} className="py-3 flex items-baseline justify-between gap-4">
              <div>
                <Link href={`/cases/${c.id}`} className="font-medium hover:text-seal transition-colors">
                  {c.title}
                </Link>
                <p className="text-sm text-ink-soft mt-0.5">
                  {c.client?.name}
                  {c.case_number ? ` · ${c.case_number}` : ''}
                </p>
              </div>
              <div className="flex gap-2 whitespace-nowrap">
                <Tag>{c.stage}</Tag>
                <Tag tone={c.status === 'closed' ? 'court-green' : 'seal'}>{c.status}</Tag>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
