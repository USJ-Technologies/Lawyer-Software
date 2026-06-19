export type CnrResult =
  | { ok: true; nextHearingDate: string | null; raw: unknown }
  | { ok: false; errorMessage: string; raw: unknown }

export interface CnrProvider {
  fetchCaseStatus(cnr: string): Promise<CnrResult>
}
