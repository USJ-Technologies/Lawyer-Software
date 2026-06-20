import { createClient } from '@/lib/supabase/server'
import { addNote } from '../actions'
import { HearingForm } from '@/components/HearingForm'
import { OutcomeForm } from '@/components/OutcomeForm'
import { DocumentManager } from '@/components/DocumentManager'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stamp } from '@/components/ui/Stamp'
import { Button } from '@/components/ui/Button'

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: caseRow }, { data: hearings }, { data: documents }, { data: notes }] = await Promise.all([
    supabase.from('case').select('id, title, chamber_id, cnr, sync_enabled, client:client_id(name)').eq('id', id).single(),
    supabase.from('hearing').select('id, date, purpose, source, outcome, next_action').eq('case_id', id).order('date'),
    supabase.from('document').select('id, label, storage_ref, category, mime_type, size_bytes, created_at').eq('case_id', id),
    supabase.from('note').select('id, body, created_at').eq('case_id', id).order('created_at', { ascending: false }),
  ])

  if (!caseRow) {
    return (
      <div>
        <PageHeader eyebrow="Case register" title="Not found" />
        <p className="text-ink-soft">No case matches this entry.</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <div>
        <PageHeader
          eyebrow={(caseRow as any).client?.name ?? 'Case file'}
          title={caseRow.title}
          action={
            caseRow.cnr ? (
              <Stamp tone={caseRow.sync_enabled ? 'court-green' : 'ink'}>
                CNR Sync {caseRow.sync_enabled ? 'On' : 'Off'}
              </Stamp>
            ) : undefined
          }
        />
        {caseRow.cnr && <p className="text-sm font-mono text-ink-soft -mt-2">CNR {caseRow.cnr}</p>}
      </div>

      <section>
        <h2 className="font-display text-xl mb-3">Hearings</h2>
        {(hearings ?? []).length > 0 && (
          <ul className="divide-y divide-rule border-t border-rule mb-2">
            {(hearings ?? []).map((h) => (
              <li key={h.id} className="py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <p>
                    <span className="font-mono text-sm text-ink-soft">{h.date}</span>
                    {h.purpose ? ` — ${h.purpose}` : ''}
                  </p>
                  <span className="text-xs font-mono uppercase tracking-wide text-ink-soft">{h.source}</span>
                </div>
                {h.outcome && (
                  <p className="text-sm text-ink-soft mt-1">
                    Outcome: {h.outcome} → {h.next_action}
                  </p>
                )}
                <OutcomeForm hearingId={h.id} />
              </li>
            ))}
          </ul>
        )}
        <HearingForm caseId={id} />
      </section>

      <section>
        <h2 className="font-display text-xl mb-3">Documents</h2>
        <DocumentManager caseId={id} chamberId={caseRow.chamber_id} documents={documents ?? []} />
      </section>

      <section>
        <h2 className="font-display text-xl mb-3">Notes</h2>
        <form
          action={async (formData: FormData) => {
            'use server'
            await addNote(id, formData)
          }}
          className="flex gap-3 mb-4"
        >
          <input name="body" placeholder="Add a note" className="field-input flex-1" required />
          <Button type="submit">Add</Button>
        </form>
        {(notes ?? []).length > 0 && (
          <ul className="divide-y divide-rule border-t border-rule">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="py-2 text-sm">
                {n.body}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
