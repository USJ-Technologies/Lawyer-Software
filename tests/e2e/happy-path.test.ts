process.loadEnvFile('.env.local')

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client as PgClient } from 'pg'
import { classifyHearing } from '@/lib/dates/buckets'
import { isDue } from '@/lib/reminders/scan'
import { signUpAndSetupChamber, cleanupChamberAndUser } from '../helpers/testAuth'

describe('happy path: add case -> dashboard -> reminder fires', () => {
  let pg: InstanceType<typeof PgClient>
  let supabase: ReturnType<typeof createClient>
  let chamberId: string
  let userId: string
  let caseTypeId: string
  let courtId: string

  beforeAll(async () => {
    const stamp = Date.now()
    pg = new PgClient({ connectionString: process.env.SUPABASE_DB_URL! })
    await pg.connect()

    const setup = await signUpAndSetupChamber(pg, `happy-path-${stamp}@gmail.com`, 'Happy Path Chamber')
    supabase = setup.supabase
    chamberId = setup.chamberId
    userId = setup.userId

    const { data: caseType } = await supabase.from('case_type').select('id').eq('code', 'civil').single()
    caseTypeId = caseType!.id
    const { data: court } = await supabase.from('court').select('id').limit(1).single()
    courtId = court!.id
  })

  afterAll(async () => {
    await supabase.auth.signOut()
    // chamber is never reached by auth.users' delete cascade (profile is the only direct child of
    // auth.users; chamber is profile's parent, not its child), so it and everything chamber-scoped
    // underneath (client, case, hearing, reminder) must be deleted explicitly. See cleanupChamberAndUser.
    await cleanupChamberAndUser(pg, chamberId, [userId])
    await pg.end()
  })

  it('adding a case with a near-term hearing surfaces it on the dashboard and its reminder is due', async () => {
    const { data: client } = await supabase
      .from('client')
      .insert({ chamber_id: chamberId, name: 'Happy Path Client' })
      .select('id')
      .single()

    const { data: createdCase } = await supabase
      .from('case')
      .insert({
        chamber_id: chamberId,
        client_id: client!.id,
        case_type_id: caseTypeId,
        court_id: courtId,
        title: 'Happy Path Case',
      })
      .select('id')
      .single()

    const today = new Date().toISOString().slice(0, 10)
    const { data: hearing } = await supabase
      .from('hearing')
      .insert({ case_id: createdCase!.id, date: today, purpose: 'First listing', source: 'manual' })
      .select('id')
      .single()

    // dashboard query: today's hearings without outcomes recorded
    const { data: dashboardHearings } = await supabase
      .from('hearing')
      .select('id, date, case:case_id(title)')
      .is('outcome', null)
      .eq('case_id', createdCase!.id)
    expect(dashboardHearings).toHaveLength(1)
    expect(classifyHearing(dashboardHearings![0].date)).toBe('today')

    // reminder fires: create one in the past and confirm it's due
    const { data: reminder } = await supabase
      .from('reminder')
      .insert({ hearing_id: hearing!.id, remind_at: new Date(Date.now() - 60_000).toISOString(), channel: 'in_app' })
      .select('id, remind_at, status')
      .single()
    expect(isDue({ remindAt: reminder!.remind_at, status: reminder!.status })).toBe(true)
  })
})
