import { createClient } from '@supabase/supabase-js'
import { Client as PgClient } from 'pg'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function createConfirmedUser(pg: InstanceType<typeof PgClient>, email: string, password: string) {
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

export async function signUpAndSetupChamber(pg: InstanceType<typeof PgClient>, email: string, chamberName: string) {
  const password = 'Test1234!'
  const userId = await createConfirmedUser(pg, email, password)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, anonKey)
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('create_chamber_and_profile', { p_chamber_name: chamberName })
    .single()
  if (rpcError || !rpcResult) throw rpcError ?? new Error('chamber/profile bootstrap failed')

  return { supabase, chamberId: (rpcResult as { chamber_id: string }).chamber_id, userId }
}

// Deleting auth.users only cascades down to `profile` (profile.id -> auth.users.id, ON DELETE CASCADE).
// `chamber` is the *parent* referenced by `profile` (profile.chamber_id -> chamber.id), so it is never
// reached by that cascade and is left as an orphan, along with everything chamber-scoped underneath it
// (client, case, hearing, reminder, ...). Also, `case.client_id -> client.id` is ON DELETE RESTRICT, so
// `case` rows must be deleted before their `client` row. Delete top-down: case (cascades to hearing,
// reminder, party, document, note, cnr_sync_log) -> client -> chamber -> auth.users (cascades to profile,
// identities, sessions, etc).
export async function cleanupChamberAndUser(
  pg: InstanceType<typeof PgClient>,
  chamberId: string,
  userIds: string[]
) {
  await pg.query('delete from "case" where chamber_id = $1', [chamberId])
  await pg.query('delete from client where chamber_id = $1', [chamberId])
  await pg.query('delete from chamber where id = $1', [chamberId])
  await pg.query('delete from auth.users where id = any($1::uuid[])', [userIds])
}
