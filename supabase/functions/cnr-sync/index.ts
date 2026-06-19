import { createClient } from 'jsr:@supabase/supabase-js@2'

type CnrResult =
  | { ok: true; nextHearingDate: string | null; raw: unknown }
  | { ok: false; errorMessage: string; raw: unknown }

function decideSyncAction(
  current: { date: string; source: 'manual' | 'cnr_sync' } | null,
  fetched: CnrResult
): { action: 'upsert'; date: string } | { action: 'unchanged' } | { action: 'failed'; errorMessage: string } {
  if (!fetched.ok) return { action: 'failed', errorMessage: fetched.errorMessage }
  if (!fetched.nextHearingDate) return { action: 'unchanged' }
  if (current?.source === 'manual') return { action: 'unchanged' }
  if (current && current.date === fetched.nextHearingDate) return { action: 'unchanged' }
  return { action: 'upsert', date: fetched.nextHearingDate }
}

async function fetchFromSurepass(cnr: string, apiKey: string): Promise<CnrResult> {
  try {
    const response = await fetch('https://kyc-api.surepass.io/api/v1/court-case/cnr', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnr }),
    })
    const raw = await response.json()
    if (!response.ok) return { ok: false, errorMessage: `Surepass error: ${response.status}`, raw }
    const rawDate: string | undefined = raw?.data?.next_hearing_date
    const nextHearingDate = rawDate ? rawDate.split('-').reverse().join('-') : null
    return { ok: true, nextHearingDate, raw }
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : 'Unknown error', raw: null }
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const surepassKey = Deno.env.get('SUREPASS_API_KEY')!

  const { data: cases, error } = await supabase
    .from('case')
    .select('id, cnr')
    .eq('sync_enabled', true)
    .not('cnr', 'is', null)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const results = []
  for (const c of cases ?? []) {
    const { data: latestHearing } = await supabase
      .from('hearing')
      .select('date, source')
      .eq('case_id', c.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const fetched = await fetchFromSurepass(c.cnr, surepassKey)
    const decision = decideSyncAction(latestHearing ?? null, fetched)

    if (decision.action === 'upsert') {
      const { data: hearing } = await supabase
        .from('hearing')
        .insert({ case_id: c.id, date: decision.date, source: 'cnr_sync' })
        .select('id')
        .single()
      if (hearing) {
        const hearingDateTime = new Date(decision.date + 'T09:00:00')
        const threeDaysBefore = new Date(hearingDateTime.getTime() - 3 * 86_400_000)
        await supabase.from('reminder').insert([
          { hearing_id: hearing.id, remind_at: threeDaysBefore.toISOString(), channel: 'in_app' },
          { hearing_id: hearing.id, remind_at: hearingDateTime.toISOString(), channel: 'in_app' },
        ])
      }
    }

    await supabase.from('cnr_sync_log').insert({
      case_id: c.id,
      raw_payload: fetched.raw,
      parsed_next_date: decision.action === 'upsert' ? decision.date : null,
      status: decision.action === 'upsert' ? 'updated' : decision.action,
    })

    results.push({ caseId: c.id, action: decision.action })
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
