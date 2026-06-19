'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
