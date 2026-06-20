import { describe, it, expect } from 'vitest'
import { isDue } from '@/lib/reminders/scan'

describe('isDue', () => {
  const now = new Date('2026-06-19T09:00:00Z')

  it('is due when remind_at is in the past and status is pending', () => {
    expect(isDue({ remindAt: '2026-06-19T08:00:00Z', status: 'pending' }, now)).toBe(true)
  })

  it('is not due when remind_at is in the future', () => {
    expect(isDue({ remindAt: '2026-06-20T08:00:00Z', status: 'pending' }, now)).toBe(false)
  })

  it('is not due when status is already sent — re-running never double-sends', () => {
    expect(isDue({ remindAt: '2026-06-19T08:00:00Z', status: 'sent' }, now)).toBe(false)
  })

  it('is not due when status is cancelled', () => {
    expect(isDue({ remindAt: '2026-06-19T08:00:00Z', status: 'cancelled' }, now)).toBe(false)
  })
})
