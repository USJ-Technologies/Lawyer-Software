import { createClient } from '@/lib/supabase/server'
import { createCase } from '../actions'
import { CaseForm } from '@/components/CaseForm'

export default async function NewCasePage() {
  const supabase = await createClient()
  const [{ data: clients }, { data: caseTypes }, { data: courts }] = await Promise.all([
    supabase.from('client').select('id, name').order('name'),
    supabase.from('case_type').select('id, label').order('label'),
    supabase.from('court').select('id, name').order('name'),
  ])

  return (
    <CaseForm
      action={async (formData: FormData) => {
        'use server'
        await createCase(formData)
      }}
      clients={(clients ?? []).map((c) => ({ id: c.id, label: c.name }))}
      caseTypes={(caseTypes ?? []).map((c) => ({ id: c.id, label: c.label }))}
      courts={(courts ?? []).map((c) => ({ id: c.id, label: c.name }))}
    />
  )
}
