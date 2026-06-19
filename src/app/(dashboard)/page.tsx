import { createClient } from '@/lib/supabase/server'
import { classifyHearing } from '@/lib/dates/buckets'
import { HearingBucketList } from '@/components/HearingBucketList'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: hearings } = await supabase
    .from('hearing')
    .select('id, date, purpose, case:case_id(id, title, court:court_id(name))')
    .is('outcome', null)
    .order('date')

  const rows = (hearings ?? []).map((h: any) => ({
    hearingId: h.id,
    caseId: h.case.id,
    caseTitle: h.case.title,
    courtName: h.case.court?.name ?? '',
    date: h.date,
    purpose: h.purpose,
    bucket: classifyHearing(h.date),
  }))

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>
      <HearingBucketList title="Overdue" rows={rows.filter((r) => r.bucket === 'overdue')} />
      <HearingBucketList title="Today" rows={rows.filter((r) => r.bucket === 'today')} />
      <HearingBucketList title="This week" rows={rows.filter((r) => r.bucket === 'this_week')} />
      {rows.every((r) => r.bucket !== 'overdue' && r.bucket !== 'today' && r.bucket !== 'this_week') && (
        <p className="text-gray-500">Nothing due in the next 7 days.</p>
      )}
    </div>
  )
}
