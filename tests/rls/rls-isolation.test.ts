process.loadEnvFile('.env.local')

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Client as PgClient } from 'pg'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// Same pooler connection string pattern used by .superpowers/sdd/run-migrations.js
const pgConnectionString = process.env.SUPABASE_DB_URL!

async function createConfirmedUser(pg: InstanceType<typeof PgClient>, email: string, password: string) {
  const userId = randomUUID()
  const encryptedPassword = bcrypt.hashSync(password, 10)
  await pg.query(
    `insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, phone_change, email_change_token_current, reauthentication_token
    ) values (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', '', '', '', ''
    )`,
    [userId, email, encryptedPassword]
  )
  await pg.query(
    `insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at
    ) values ($1, $2::uuid, $2::text, 'email', $3, now(), now(), now())`,
    [randomUUID(), userId, JSON.stringify({ sub: userId, email })]
  )
  return userId
}

async function signUpAndSetupChamber(pg: InstanceType<typeof PgClient>, email: string, chamberName: string) {
  const password = 'Test1234!'
  await createConfirmedUser(pg, email, password)

  const supabase = createClient(url, anonKey)
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('create_chamber_and_profile', { p_chamber_name: chamberName })
    .single()
  if (rpcError || !rpcResult) throw rpcError ?? new Error('chamber/profile bootstrap failed')

  return { supabase, chamberId: (rpcResult as { chamber_id: string }).chamber_id }
}

describe('RLS chamber isolation', () => {
  let pg: InstanceType<typeof PgClient>
  let chamberA: ReturnType<typeof createClient>
  let chamberB: ReturnType<typeof createClient>
  let clientAId: string

  beforeAll(async () => {
    pg = new PgClient({ connectionString: pgConnectionString })
    await pg.connect()

    const stamp = Date.now()
    // GoTrue rejects @example.com as an invalid domain in this project's config — use a real-looking domain.
    const a = await signUpAndSetupChamber(pg, `rls-test-a-${stamp}@gmail.com`, 'Chamber A')
    const b = await signUpAndSetupChamber(pg, `rls-test-b-${stamp}@gmail.com`, 'Chamber B')
    chamberA = a.supabase
    chamberB = b.supabase

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
