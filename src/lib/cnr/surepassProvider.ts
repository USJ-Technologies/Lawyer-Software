import type { CnrProvider, CnrResult } from './provider'

export class SurepassCnrProvider implements CnrProvider {
  constructor(private readonly apiKey: string) {}

  async fetchCaseStatus(cnr: string): Promise<CnrResult> {
    try {
      const response = await fetch('https://kyc-api.surepass.io/api/v1/court-case/cnr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnr }),
      })
      const raw = await response.json()
      if (!response.ok) {
        return { ok: false, errorMessage: `Surepass error: ${response.status}`, raw }
      }
      const rawDate: string | undefined = raw?.data?.next_hearing_date
      const nextHearingDate = rawDate ? toIsoDate(rawDate) : null
      return { ok: true, nextHearingDate, raw }
    } catch (err) {
      return { ok: false, errorMessage: err instanceof Error ? err.message : 'Unknown error', raw: null }
    }
  }
}

function toIsoDate(ddMmYyyy: string): string {
  const [day, month, year] = ddMmYyyy.split('-')
  return `${year}-${month}-${day}`
}
