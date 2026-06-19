import { describe, it, expect } from 'vitest'
import { decideSyncAction } from '@/lib/cnr/sync'
import { successWithNewDate, successUnchanged, successNoDate, providerFailure } from '../fixtures/cnrResponses'

describe('decideSyncAction', () => {
  it('does not upsert when the fetched date differs from a manual hearing — manual wins', () => {
    const decision = decideSyncAction(
      { date: '2026-06-25', source: 'manual' },
      successWithNewDate
    )
    expect(decision).toEqual({ action: 'unchanged' })
  })

  it('never overwrites a manual hearing even if dates differ — manual always wins', () => {
    const decision = decideSyncAction(
      { date: '2026-06-25', source: 'manual' },
      successWithNewDate
    )
    expect(decision.action).not.toBe('overwrite_manual')
  })

  it('logs unchanged when the fetched date matches an existing cnr_sync hearing', () => {
    const decision = decideSyncAction(
      { date: '2026-06-25', source: 'cnr_sync' },
      successUnchanged
    )
    expect(decision).toEqual({ action: 'unchanged' })
  })

  it('upserts over a previous cnr_sync hearing when the date changed', () => {
    const decision = decideSyncAction(
      { date: '2026-06-20', source: 'cnr_sync' },
      successWithNewDate
    )
    expect(decision).toEqual({ action: 'upsert', date: '2026-07-10' })
  })

  it('does nothing when there is no current hearing and no fetched date', () => {
    const decision = decideSyncAction(null, successNoDate)
    expect(decision).toEqual({ action: 'unchanged' })
  })

  it('creates a hearing when there is no current hearing but a date was fetched', () => {
    const decision = decideSyncAction(null, successWithNewDate)
    expect(decision).toEqual({ action: 'upsert', date: '2026-07-10' })
  })

  it('returns failed on a provider error, regardless of current state', () => {
    const decision = decideSyncAction({ date: '2026-06-25', source: 'manual' }, providerFailure)
    expect(decision).toEqual({ action: 'failed', errorMessage: 'Upstream timeout' })
  })
})
