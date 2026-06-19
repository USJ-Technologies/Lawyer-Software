import { describe, it, expect } from 'vitest'
import { classifyHearing } from '@/lib/dates/buckets'

describe('classifyHearing', () => {
  const today = new Date('2026-06-19T00:00:00')

  it('classifies a past date as overdue', () => {
    expect(classifyHearing('2026-06-15', today)).toBe('overdue')
  })

  it('classifies today as today', () => {
    expect(classifyHearing('2026-06-19', today)).toBe('today')
  })

  it('classifies a date within the next 7 days as this_week', () => {
    expect(classifyHearing('2026-06-24', today)).toBe('this_week')
  })

  it('classifies a date beyond 7 days as later', () => {
    expect(classifyHearing('2026-07-01', today)).toBe('later')
  })
})
