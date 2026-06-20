import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: dueReminders, error } = await supabase
    .from('reminder')
    .select('id, hearing_id, channel')
    .eq('status', 'pending')
    .lte('remind_at', new Date().toISOString())

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Phase 1 delivery: in-app reminders are "delivered" by existing in the
  // table with status pending and being shown wherever the app queries
  // them; "sending" means marking them sent so the UI stops surfacing them
  // as new. PWA push delivery for channel === 'push' is a Phase 1 stretch
  // wired here but requires a push subscription table not yet in scope —
  // see spec §2 non-goals list (push is mentioned as a target, in-app is
  // the guaranteed channel).
  const ids = (dueReminders ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await supabase.from('reminder').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', ids)
  }

  return new Response(JSON.stringify({ sent: ids.length }), { headers: { 'Content-Type': 'application/json' } })
})
