process.loadEnvFile('.env.local')

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client as PgClient } from 'pg'
import { signUpAndSetupChamber, cleanupChamberAndUser } from '../helpers/testAuth'

// Same pooler connection string pattern used by .superpowers/sdd/run-migrations.js
const pgConnectionString = process.env.SUPABASE_DB_URL!

describe('RLS chamber isolation', () => {
  let pg: InstanceType<typeof PgClient>
  let chamberA: ReturnType<typeof createClient>
  let chamberB: ReturnType<typeof createClient>
  let clientAId: string
  let userAId: string
  let userBId: string
  let chamberAId: string
  let chamberBId: string

  beforeAll(async () => {
    pg = new PgClient({ connectionString: pgConnectionString })
    await pg.connect()

    const stamp = Date.now()
    // GoTrue rejects @example.com as an invalid domain in this project's config — use a real-looking domain.
    const a = await signUpAndSetupChamber(pg, `rls-test-a-${stamp}@gmail.com`, 'Chamber A')
    const b = await signUpAndSetupChamber(pg, `rls-test-b-${stamp}@gmail.com`, 'Chamber B')
    chamberA = a.supabase
    chamberB = b.supabase
    userAId = a.userId
    userBId = b.userId
    chamberAId = a.chamberId
    chamberBId = b.chamberId

    const { data: clientRow } = await chamberA
      .from('client')
      .insert({ chamber_id: a.chamberId, name: 'Confidential Client' })
      .select('id')
      .single()
    clientAId = clientRow!.id
  })

  afterAll(async () => {
    await chamberA.auth.signOut()
    await chamberB.auth.signOut()
    // Deleting auth.users only cascades to `profile` (its direct child); `chamber` is profile's
    // *parent* so it is never reached and is left orphaned along with everything chamber-scoped
    // underneath it (client, case, hearing, reminder, ...) — see cleanupChamberAndUser for why.
    await cleanupChamberAndUser(pg, chamberAId, [userAId])
    await cleanupChamberAndUser(pg, chamberBId, [userBId])
    await pg.end()
  })

  it('chamber B cannot see chamber A clients in a list query', async () => {
    const { data } = await chamberB.from('client').select('id').eq('id', clientAId)
    expect(data ?? []).toHaveLength(0)
  })

  it('chamber B cannot fetch chamber A client by direct id lookup', async () => {
    const { data } = await chamberB.from('client').select('id').eq('id', clientAId).maybeSingle()
    expect(data).toBeNull()
  })

  it('chamber A can see its own client', async () => {
    const { data } = await chamberA.from('client').select('id').eq('id', clientAId).maybeSingle()
    expect(data?.id).toBe(clientAId)
  })
})
