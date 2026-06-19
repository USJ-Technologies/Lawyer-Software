import type { CnrProvider, CnrResult } from './provider'

export class MockCnrProvider implements CnrProvider {
  constructor(private readonly responses: Record<string, CnrResult>) {}

  async fetchCaseStatus(cnr: string): Promise<CnrResult> {
    return this.responses[cnr] ?? { ok: false, errorMessage: 'No fixture for CNR', raw: null }
  }
}
