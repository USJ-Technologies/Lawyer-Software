'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createClientRecord(formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profile')
    .select('chamber_id')
    .eq('id', userData.user.id)
    .single()
  if (!profile) return { error: 'No chamber found for this user' }

  const { error } = await supabase.from('client').insert({
    chamber_id: profile.chamber_id,
    name: formData.get('name') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    address: formData.get('address') as string,
  })
  if (error) return { error: error.message }
  redirect('/clients')
}
