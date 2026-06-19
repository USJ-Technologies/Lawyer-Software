'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createCase(formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profile')
    .select('chamber_id')
    .eq('id', userData.user.id)
    .single()
  if (!profile) return { error: 'No chamber found for this user' }

  const cnr = (formData.get('cnr') as string)?.trim() || null

  const { data: newCase, error } = await supabase
    .from('case')
    .insert({
      chamber_id: profile.chamber_id,
      client_id: formData.get('client_id') as string,
      case_type_id: formData.get('case_type_id') as string,
      court_id: formData.get('court_id') as string,
      title: formData.get('title') as string,
      case_number: (formData.get('case_number') as string) || null,
      cnr,
      sync_enabled: cnr !== null,
    })
    .select('id')
    .single()
  if (error || !newCase) return { error: error?.message ?? 'Could not create case' }
  redirect(`/cases/${newCase.id}`)
}

export async function addHearing(caseId: string, formData: FormData) {
  const supabase = await createClient()
  const date = formData.get('date') as string
  const purpose = formData.get('purpose') as string

  const { data: hearing, error } = await supabase
    .from('hearing')
    .insert({ case_id: caseId, date, purpose, source: 'manual' })
    .select('id')
    .single()
  if (error || !hearing) return { error: error?.message ?? 'Could not add hearing' }

  const hearingDateTime = new Date(date + 'T09:00:00')
  const threeDaysBefore = new Date(hearingDateTime.getTime() - 3 * 86_400_000)
  await supabase.from('reminder').insert([
    { hearing_id: hearing.id, remind_at: threeDaysBefore.toISOString(), channel: 'in_app' },
    { hearing_id: hearing.id, remind_at: hearingDateTime.toISOString(), channel: 'in_app' },
  ])
  return { success: true }
}

export async function recordOutcome(hearingId: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('hearing')
    .update({
      outcome: formData.get('outcome') as string,
      next_action: formData.get('next_action') as string,
    })
    .eq('id', hearingId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function addNote(caseId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('note')
    .insert({ case_id: caseId, body: formData.get('body') as string, author: userData.user.id })
  if (error) return { error: error.message }
  revalidatePath(`/cases/${caseId}`)
  return { success: true }
}

export async function uploadDocument(caseId: string, chamberId: string, file: File) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const path = `${chamberId}/${caseId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('case-documents').upload(path, file)
  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase.from('document').insert({
    case_id: caseId,
    chamber_id: chamberId,
    storage_ref: path,
    label: file.name,
    uploaded_by: userData.user.id,
  })
  if (dbError) return { error: dbError.message }
  return { success: true }
}
