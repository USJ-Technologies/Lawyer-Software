import type { CnrResult } from './provider'

export type HearingSnapshot = { date: string; source: 'manual' | 'cnr_sync' } | null

export type SyncDecision =
  | { action: 'upsert'; date: string }
  | { action: 'unchanged' }
  | { action: 'failed'; errorMessage: string }

export function decideSyncAction(current: HearingSnapshot, fetched: CnrResult): SyncDecision {
  if (!fetched.ok) return { action: 'failed', errorMessage: fetched.errorMessage }
  if (!fetched.nextHearingDate) return { action: 'unchanged' }

  if (current?.source === 'manual') {
    // Manual entries always win; sync only fills in when there's nothing manual to protect.
    return { action: 'unchanged' }
  }

  if (current && current.date === fetched.nextHearingDate) {
    return { action: 'unchanged' }
  }

  return { action: 'upsert', date: fetched.nextHearingDate }
}
