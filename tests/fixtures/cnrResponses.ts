import type { CnrResult } from '@/lib/cnr/provider'

export const successWithNewDate: CnrResult = {
  ok: true,
  nextHearingDate: '2026-07-10',
  raw: { case_status: 'PENDING', next_hearing_date: '10-07-2026' },
}

export const successUnchanged: CnrResult = {
  ok: true,
  nextHearingDate: '2026-06-25',
  raw: { case_status: 'PENDING', next_hearing_date: '25-06-2026' },
}

export const successNoDate: CnrResult = {
  ok: true,
  nextHearingDate: null,
  raw: { case_status: 'DISPOSED' },
}

export const providerFailure: CnrResult = {
  ok: false,
  errorMessage: 'Upstream timeout',
  raw: null,
}
