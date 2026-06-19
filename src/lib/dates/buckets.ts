export type HearingBucket = 'overdue' | 'today' | 'this_week' | 'later'

export function classifyHearing(hearingDate: string, today: Date = new Date()): HearingBucket {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(hearingDate + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86_400_000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'this_week'
  return 'later'
}
