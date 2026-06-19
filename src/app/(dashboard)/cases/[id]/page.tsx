import { createClient } from '@/lib/supabase/server'
import { addNote } from '../actions'
import { HearingForm } from '@/components/HearingForm'
import { OutcomeForm } from '@/components/OutcomeForm'
import { DocumentUpload } from '@/components/DocumentUpload'

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: caseRow }, { data: hearings }, { data: documents }, { data: notes }] = await Promise.all([
    supabase.from('case').select('id, title, chamber_id, cnr, sync_enabled, client:client_id(name)').eq('id', id).single(),
    supabase.from('hearing').select('id, date, purpose, source, outcome, next_action').eq('case_id', id).order('date'),
    supabase.from('document').select('id, label, storage_ref').eq('case_id', id),
    supabase.from('note').select('id, body, created_at').eq('case_id', id).order('created_at', { ascending: false }),
  ])

  if (!caseRow) return <div className="p-6">Case not found.</div>

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold">{caseRow.title}</h1>
      {caseRow.cnr && <p className="text-sm text-gray-500">CNR: {caseRow.cnr} · sync {caseRow.sync_enabled ? 'on' : 'off'}</p>}

      <section>
        <h2 className="font-medium mb-2">Hearings</h2>
        <ul className="space-y-2 mb-3">
          {(hearings ?? []).map((h) => (
            <li key={h.id} className="border p-2 rounded">
              <p>{h.date} — {h.purpose} <span className="text-xs text-gray-400">({h.source})</span></p>
              {h.outcome && <p className="text-sm">Outcome: {h.outcome} → {h.next_action}</p>}
              <OutcomeForm hearingId={h.id} />
            </li>
          ))}
        </ul>
        <HearingForm caseId={id} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Documents</h2>
        <ul className="mb-2">
          {(documents ?? []).map((d) => <li key={d.id} className="text-sm">{d.label}</li>)}
        </ul>
        <DocumentUpload caseId={id} chamberId={caseRow.chamber_id} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Notes</h2>
        <form action={async (formData: FormData) => {
          'use server'
          await addNote(id, formData)
        }} className="flex gap-2 mb-3">
          <input name="body" placeholder="Add a note" className="border p-2 flex-1" required />
          <button type="submit" className="bg-black text-white px-3 py-2 rounded">Add</button>
        </form>
        <ul className="space-y-1">
          {(notes ?? []).map((n) => <li key={n.id} className="text-sm">{n.body}</li>)}
        </ul>
      </section>
    </div>
  )
}
