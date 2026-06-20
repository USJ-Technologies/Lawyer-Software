import { createClient } from '@/lib/supabase/server'
import { classifyHearing } from '@/lib/dates/buckets'
import { HearingBucketList } from '@/components/HearingBucketList'
import { PageHeader } from '@/components/ui/PageHeader'

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

  const nothingDue = rows.every((r) => r.bucket !== 'overdue' && r.bucket !== 'today' && r.bucket !== 'this_week')

  return (
    <div>
      <PageHeader eyebrow="Daily register" title="What's due" />
      <HearingBucketList title="Overdue" tone="seal" rows={rows.filter((r) => r.bucket === 'overdue')} />
      <HearingBucketList title="Today" tone="brass" rows={rows.filter((r) => r.bucket === 'today')} />
      <HearingBucketList title="This week" tone="ink" rows={rows.filter((r) => r.bucket === 'this_week')} />
      {nothingDue && (
        <p className="text-ink-soft border-t border-rule pt-6">Nothing due in the next 7 days.</p>
      )}
    </div>
  )
}
