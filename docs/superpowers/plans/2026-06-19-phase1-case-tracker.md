# Phase 1 Case Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Next.js PWA + Supabase app where a solo litigator manages clients/cases/hearings, never misses a hearing date (manual entry + optional CNR auto-sync), and sees a Today/This week/Overdue dashboard.

**Architecture:** Next.js 15+ App Router (TypeScript) talking directly to Supabase (Postgres + Auth + Storage) from server components/actions using the `@supabase/ssr` client. All multi-tenancy is enforced by Postgres Row-Level Security keyed on `chamber_id` — the app never needs its own authorization layer. Two Supabase Edge Functions (`cnr-sync`, `send-reminders`) run on cron and talk to Postgres via the service-role key. The CNR vendor sits behind a `CnrProvider` TypeScript interface so the Edge Function never calls a vendor SDK directly.

**Tech Stack:** Next.js 15+ (App Router, TypeScript) — every task below uses the async `cookies()`/`params` APIs introduced in Next.js 15, so the installed version must be 15 or later (Task 1 installed 16.2.9, which satisfies this). Tailwind CSS, `@supabase/ssr` + `@supabase/supabase-js`, Supabase Postgres/Auth/Storage/Edge Functions, Vitest for unit tests, `next-pwa`-free hand-rolled manifest + service worker (no extra dependency needed for Phase 1's push scope).

## Global Constraints

- Next.js version must be 15 or later (async `cookies()`/`params` APIs are used throughout — see Tasks 6 and 10). The plan originally said "Next.js 14" in error; corrected after Task 1's review caught the mismatch between that line and the async API calls already written into later tasks.
- Every table that holds tenant data carries `chamber_id uuid not null references chamber(id)` and has RLS enabled — no table is exempt (spec §4, §7).
- `hearing.source` is `'manual' | 'cnr_sync'`; auto-sync must never overwrite a row where `source = 'manual'` (spec §6).
- Every CNR provider call is logged to `cnr_sync_log` regardless of outcome (spec §6).
- `CnrProvider` is a TypeScript interface; the Surepass implementation is the only file allowed to import the vendor's HTTP shape (spec §6, §8 "wrap behind thin interfaces").
- `reminder` delivery is idempotent — re-running the scan must never double-send (spec §7).
- Phase 1 excludes: drafting/templates, AI analysis, knowledge base, billing, staff/hiring, WhatsApp/SMS, client login (spec §2).
- Supabase project already exists: project id `czznfdzvapqernkzclvw`, URL/anon key in `.env.local` (gitignored) — do not provision a new project.

---

## File Structure

```
package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.js
.env.local                              — already exists (Supabase URL/anon key)

supabase/
  config.toml
  migrations/
    0001_chamber_and_profile.sql
    0002_reference_tables.sql
    0003_client_case_party.sql
    0004_hearing_reminder.sql
    0005_document_note.sql
    0006_cnr_sync_log.sql
    0007_rls_policies.sql
  functions/
    cnr-sync/index.ts                   — Edge Function, runs on cron
    send-reminders/index.ts             — Edge Function, runs on cron
  seed.sql                              — case_type + court reference rows

src/
  lib/supabase/client.ts                — browser Supabase client
  lib/supabase/server.ts                — server Supabase client (cookies)
  lib/cnr/provider.ts                   — CnrProvider interface + types
  lib/cnr/surepassProvider.ts           — real implementation
  lib/cnr/mockProvider.ts               — fixture-driven implementation for tests
  lib/cnr/sync.ts                       — pure sync logic (parse/compare/upsert decision), used by both the Edge Function and unit tests
  lib/reminders/scan.ts                 — pure reminder-due logic, used by Edge Function + unit tests
  lib/dates/buckets.ts                  — pure Today/This week/Overdue classifier
  types/db.ts                           — hand-written row types mirroring the schema

  middleware.ts                         — refreshes Supabase auth session on every request

  app/
    manifest.ts                        — PWA manifest
    layout.tsx
    globals.css
    (auth)/login/page.tsx
    (auth)/signup/page.tsx
    (dashboard)/layout.tsx              — guards: redirect to /login if no session
    (dashboard)/page.tsx                — dashboard (Today/This week/Overdue)
    (dashboard)/clients/page.tsx
    (dashboard)/clients/new/page.tsx
    (dashboard)/clients/actions.ts      — server actions: createClient
    (dashboard)/cases/page.tsx
    (dashboard)/cases/new/page.tsx
    (dashboard)/cases/[id]/page.tsx     — case detail: hearings, docs, notes
    (dashboard)/cases/actions.ts        — server actions: createCase, recordOutcome, addHearing, addNote, uploadDocument

  components/
    HearingBucketList.tsx
    CaseForm.tsx
    HearingForm.tsx
    OutcomeForm.tsx
    DocumentUpload.tsx

tests/
  unit/buckets.test.ts
  unit/cnrSync.test.ts
  unit/reminderScan.test.ts
  fixtures/cnrResponses.ts              — recorded sample API payloads
  rls/rls-isolation.test.ts             — proves chamber A cannot read chamber B's rows
  e2e/happy-path.test.ts                — add case → dashboard → reminder fires
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (temporary placeholder, removed in Task 9)

**Interfaces:**
- Produces: a runnable `npm run dev` Next.js app with Tailwind working.

- [ ] **Step 1: Scaffold Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --eslint --no-turbopack --use-npm
```
Answer prompts: yes to App Router (already implied by `--app`).

- [ ] **Step 2: Install Supabase + test deps**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Add a `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts', 'tests/rls/**/*.test.ts'] },
})
```

- [ ] **Step 4: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 5: Verify dev server boots**

Run: `npm run dev` then `curl -s http://localhost:3000 | head -c 200` (or open in browser)
Expected: default Next.js page renders, no errors. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Supabase, Vitest"
```

---

### Task 2: Supabase schema — chamber, profile, reference tables

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/0001_chamber_and_profile.sql`, `supabase/migrations/0002_reference_tables.sql`, `supabase/seed.sql`

**Interfaces:**
- Produces: `chamber(id, name, created_at)`, `profile(id, chamber_id, email, role, created_at)`, `case_type(id, code, label)`, `court(id, name, level, state)` — every later table's FKs target these.

- [ ] **Step 1: Link the existing Supabase project**

```bash
npx supabase login
npx supabase link --project-ref czznfdzvapqernkzclvw
```

- [ ] **Step 2: Write migration 0001**

`supabase/migrations/0001_chamber_and_profile.sql`:
```sql
create table chamber (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profile (
  id uuid primary key references auth.users(id) on delete cascade,
  chamber_id uuid not null references chamber(id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner', 'junior', 'clerk')),
  created_at timestamptz not null default now()
);

create index profile_chamber_id_idx on profile(chamber_id);
```

- [ ] **Step 3: Write migration 0002**

`supabase/migrations/0002_reference_tables.sql`:
```sql
create table case_type (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null
);

create table court (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null check (level in ('district', 'high_court', 'supreme_court', 'tribunal')),
  state text
);
```

- [ ] **Step 4: Write seed data**

`supabase/seed.sql`:
```sql
insert into case_type (code, label) values
  ('civil', 'Civil'),
  ('criminal', 'Criminal'),
  ('bail', 'Bail'),
  ('writ', 'Writ Petition'),
  ('family', 'Family/Matrimonial'),
  ('other', 'Other');

insert into court (name, level, state) values
  ('Supreme Court of India', 'supreme_court', null),
  ('Delhi High Court', 'high_court', 'Delhi'),
  ('Bombay High Court', 'high_court', 'Maharashtra');
```

- [ ] **Step 5: Push migrations and seed**

```bash
npx supabase db push
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -f supabase/seed.sql
```
Expected: no errors; if `psql`/`jq` aren't available locally, instead run the seed SQL once via the Supabase Studio SQL editor for project `czznfdzvapqernkzclvw`.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: chamber, profile, and reference table schema"
```

---

### Task 3: Supabase schema — client, case, party

**Files:**
- Create: `supabase/migrations/0003_client_case_party.sql`

**Interfaces:**
- Consumes: `chamber.id`, `case_type.id`, `court.id` from Task 2.
- Produces: `client(id, chamber_id, name, phone, email, address, created_at)`, `case(id, chamber_id, client_id, case_type_id, court_id, title, case_number, cnr, stage, status, sync_enabled, created_at)`, `party(id, case_id, name, role)`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0003_client_case_party.sql`:
```sql
create table client (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references chamber(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);
create index client_chamber_id_idx on client(chamber_id);

create table "case" (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references chamber(id) on delete cascade,
  client_id uuid not null references client(id) on delete restrict,
  case_type_id uuid not null references case_type(id),
  court_id uuid not null references court(id),
  title text not null,
  case_number text,
  cnr text,
  stage text not null default 'filed' check (stage in ('filed', 'listed', 'heard', 'disposed')),
  status text not null default 'active' check (status in ('active', 'disposed')),
  sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint cnr_format check (cnr is null or cnr ~ '^[A-Za-z0-9]{16}$')
);
create index case_chamber_id_idx on "case"(chamber_id);
create index case_cnr_idx on "case"(cnr) where cnr is not null;

create table party (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  name text not null,
  role text not null check (role in ('petitioner', 'respondent', 'opposing_counsel', 'other'))
);
create index party_case_id_idx on party(case_id);
```

- [ ] **Step 2: Push migration**

```bash
npx supabase db push
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_client_case_party.sql
git commit -m "feat: client, case, party schema"
```

---

### Task 4: Supabase schema — hearing, reminder

**Files:**
- Create: `supabase/migrations/0004_hearing_reminder.sql`

**Interfaces:**
- Consumes: `"case".id` from Task 3.
- Produces: `hearing(id, case_id, date, purpose, source, outcome, next_action, created_at)`, `reminder(id, hearing_id, remind_at, channel, status, sent_at)`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0004_hearing_reminder.sql`:
```sql
create table hearing (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  date date not null,
  purpose text,
  source text not null check (source in ('manual', 'cnr_sync')),
  outcome text,
  next_action text,
  created_at timestamptz not null default now()
);
create index hearing_case_id_idx on hearing(case_id);
create index hearing_date_idx on hearing(date);

create table reminder (
  id uuid primary key default gen_random_uuid(),
  hearing_id uuid not null references hearing(id) on delete cascade,
  remind_at timestamptz not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'push')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  sent_at timestamptz
);
create index reminder_due_idx on reminder(remind_at) where status = 'pending';
```

- [ ] **Step 2: Push migration**

```bash
npx supabase db push
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_hearing_reminder.sql
git commit -m "feat: hearing and reminder schema"
```

---

### Task 5: Supabase schema — document, note, cnr_sync_log, and RLS

**Files:**
- Create: `supabase/migrations/0005_document_note.sql`, `supabase/migrations/0006_cnr_sync_log.sql`, `supabase/migrations/0007_rls_policies.sql`

**Interfaces:**
- Produces: `document(id, case_id, chamber_id, storage_ref, label, uploaded_by, created_at)`, `note(id, case_id, body, author, created_at)`, `cnr_sync_log(id, case_id, fetched_at, raw_payload, parsed_next_date, status)`, and RLS policies on every tenant table.

- [ ] **Step 1: Write migration 0005**

`supabase/migrations/0005_document_note.sql`:
```sql
create table document (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  chamber_id uuid not null references chamber(id) on delete cascade,
  storage_ref text not null,
  label text not null,
  uploaded_by uuid not null references profile(id),
  created_at timestamptz not null default now()
);
create index document_case_id_idx on document(case_id);

create table note (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  body text not null,
  author uuid not null references profile(id),
  created_at timestamptz not null default now()
);
create index note_case_id_idx on note(case_id);
```

- [ ] **Step 2: Write migration 0006**

`supabase/migrations/0006_cnr_sync_log.sql`:
```sql
create table cnr_sync_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references "case"(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  parsed_next_date date,
  status text not null check (status in ('updated', 'unchanged', 'failed'))
);
create index cnr_sync_log_case_id_idx on cnr_sync_log(case_id);
```

- [ ] **Step 3: Write migration 0007 — RLS**

`supabase/migrations/0007_rls_policies.sql`:
```sql
alter table chamber enable row level security;
alter table profile enable row level security;
alter table client enable row level security;
alter table "case" enable row level security;
alter table party enable row level security;
alter table hearing enable row level security;
alter table reminder enable row level security;
alter table document enable row level security;
alter table note enable row level security;
alter table cnr_sync_log enable row level security;

-- Helper: the chamber_id of the calling user
create function auth_chamber_id() returns uuid
language sql security definer stable as $$
  select chamber_id from profile where id = auth.uid()
$$;

create policy "own chamber" on chamber
  for select using (id = auth_chamber_id());

create policy "own profile row" on profile
  for select using (chamber_id = auth_chamber_id());

create policy "chamber rw client" on client
  for all using (chamber_id = auth_chamber_id()) with check (chamber_id = auth_chamber_id());

create policy "chamber rw case" on "case"
  for all using (chamber_id = auth_chamber_id()) with check (chamber_id = auth_chamber_id());

create policy "chamber rw party" on party
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );

create policy "chamber rw hearing" on hearing
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );

create policy "chamber rw reminder" on reminder
  for all using (
    hearing_id in (
      select h.id from hearing h join "case" c on c.id = h.case_id
      where c.chamber_id = auth_chamber_id()
    )
  ) with check (
    hearing_id in (
      select h.id from hearing h join "case" c on c.id = h.case_id
      where c.chamber_id = auth_chamber_id()
    )
  );

create policy "chamber rw document" on document
  for all using (chamber_id = auth_chamber_id()) with check (chamber_id = auth_chamber_id());

create policy "chamber rw note" on note
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );

create policy "chamber rw cnr_sync_log" on cnr_sync_log
  for all using (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  ) with check (
    case_id in (select id from "case" where chamber_id = auth_chamber_id())
  );
```
Note: Edge Functions use the **service-role key**, which bypasses RLS by design — this is how `cnr-sync` and `send-reminders` write across chambers. All browser/server-action access uses the anon/user-scoped key and is fully governed by these policies.

- [ ] **Step 4: Push migrations**

```bash
npx supabase db push
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_document_note.sql supabase/migrations/0006_cnr_sync_log.sql supabase/migrations/0007_rls_policies.sql
git commit -m "feat: document, note, cnr_sync_log tables and RLS policies"
```

---

### Task 6: Supabase client helpers + auth pages

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- Test: manual (auth flows are thin wrappers around Supabase Auth UI/SDK; covered by Task 13 e2e happy path)

**Interfaces:**
- Produces: `createBrowserClient()` and `createServerClient()` used by every later page/action; signup also creates the user's `chamber` + `profile` row.

- [ ] **Step 1: Browser client**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Server client**

`src/lib/supabase/server.ts`:
```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 3: Middleware to refresh session**

`src/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Signup page (creates chamber + profile)**

`src/app/(auth)/signup/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [chamberName, setChamberName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Signup failed')
      return
    }
    const { data: chamber, error: chamberError } = await supabase
      .from('chamber')
      .insert({ name: chamberName })
      .select('id')
      .single()
    if (chamberError || !chamber) {
      setError(chamberError?.message ?? 'Could not create chamber')
      return
    }
    const { error: profileError } = await supabase
      .from('profile')
      .insert({ id: data.user.id, chamber_id: chamber.id, email })
    if (profileError) {
      setError(profileError.message)
      return
    }
    router.push('/')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-16 space-y-4">
      <h1 className="text-xl font-semibold">Create your chamber</h1>
      <input className="w-full border p-2" placeholder="Chamber / firm name" value={chamberName} onChange={(e) => setChamberName(e.target.value)} required />
      <input className="w-full border p-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="w-full border p-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button className="w-full bg-black text-white p-2 rounded" type="submit">Sign up</button>
    </form>
  )
}
```
Note: signup inserting its own `chamber` row works because `chamber` RLS only restricts `select` (Task 5 step 3) — insert has no policy, so it's allowed for any authenticated user, which is correct: a brand-new user has no chamber yet and must be able to create one.

- [ ] **Step 5: Login page**

`src/app/(auth)/login/page.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push('/')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-16 space-y-4">
      <h1 className="text-xl font-semibold">Log in</h1>
      <input className="w-full border p-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="w-full border p-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button className="w-full bg-black text-white p-2 rounded" type="submit">Log in</button>
    </form>
  )
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `/signup`, create an account.
Expected: redirected to `/` (will 404/blank until Task 9 — that's fine for now), and in Supabase Studio the `auth.users`, `chamber`, and `profile` tables each have one new row.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase src/middleware.ts "src/app/(auth)"
git commit -m "feat: Supabase client helpers and auth pages"
```

---

### Task 7: Dashboard date-bucket logic (pure function, TDD)

**Files:**
- Create: `src/lib/dates/buckets.ts`
- Test: `tests/unit/buckets.test.ts`

**Interfaces:**
- Produces: `classifyHearing(hearingDate: string, today: Date): 'overdue' | 'today' | 'this_week' | 'later'` — consumed by Task 9's dashboard page.

- [ ] **Step 1: Write the failing test**

`tests/unit/buckets.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifyHearing } from '@/lib/dates/buckets'

describe('classifyHearing', () => {
  const today = new Date('2026-06-19T00:00:00')

  it('classifies a past date as overdue', () => {
    expect(classifyHearing('2026-06-15', today)).toBe('overdue')
  })

  it('classifies today as today', () => {
    expect(classifyHearing('2026-06-19', today)).toBe('today')
  })

  it('classifies a date within the next 7 days as this_week', () => {
    expect(classifyHearing('2026-06-24', today)).toBe('this_week')
  })

  it('classifies a date beyond 7 days as later', () => {
    expect(classifyHearing('2026-07-01', today)).toBe('later')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- buckets`
Expected: FAIL — `Cannot find module '@/lib/dates/buckets'`

- [ ] **Step 3: Implement**

`src/lib/dates/buckets.ts`:
```ts
export type HearingBucket = 'overdue' | 'today' | 'this_week' | 'later'

export function classifyHearing(hearingDate: string, today: Date = new Date()): HearingBucket {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(hearingDate + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86_400_000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'this_week'
  return 'later'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- buckets`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates/buckets.ts tests/unit/buckets.test.ts
git commit -m "feat: hearing date bucket classifier"
```

---

### Task 8: Clients CRUD

**Files:**
- Create: `src/app/(dashboard)/clients/page.tsx`, `src/app/(dashboard)/clients/new/page.tsx`, `src/app/(dashboard)/clients/actions.ts`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts` (Task 6).
- Produces: server action `createClientRecord(formData: FormData): Promise<{ error?: string }>` consumed by the `new` page; `client` rows consumed by Task 10's case form.

- [ ] **Step 1: Server action**

`src/app/(dashboard)/clients/actions.ts`:
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createClientRecord(formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profile')
    .select('chamber_id')
    .eq('id', userData.user.id)
    .single()
  if (!profile) return { error: 'No chamber found for this user' }

  const { error } = await supabase.from('client').insert({
    chamber_id: profile.chamber_id,
    name: formData.get('name') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    address: formData.get('address') as string,
  })
  if (error) return { error: error.message }
  redirect('/clients')
}
```

- [ ] **Step 2: List page**

`src/app/(dashboard)/clients/page.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase.from('client').select('id, name, phone, email').order('name')

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Link href="/clients/new" className="bg-black text-white px-3 py-1.5 rounded">+ Client</Link>
      </div>
      <ul className="divide-y">
        {(clients ?? []).map((c) => (
          <li key={c.id} className="py-2">
            <p className="font-medium">{c.name}</p>
            <p className="text-sm text-gray-500">{c.phone} {c.email}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: New client form**

`src/app/(dashboard)/clients/new/page.tsx`:
```tsx
import { createClientRecord } from '../actions'

export default function NewClientPage() {
  return (
    <form action={createClientRecord} className="p-6 max-w-md space-y-4">
      <h1 className="text-xl font-semibold">New client</h1>
      <input name="name" placeholder="Full name" className="w-full border p-2" required />
      <input name="phone" placeholder="Phone" className="w-full border p-2" />
      <input name="email" placeholder="Email" type="email" className="w-full border p-2" />
      <textarea name="address" placeholder="Address" className="w-full border p-2" />
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">Save</button>
    </form>
  )
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in, visit `/clients/new`, submit a client.
Expected: redirected to `/clients`, the new client appears in the list. Confirm in Supabase Studio the row has the correct `chamber_id`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/clients"
git commit -m "feat: client list and create form"
```

---

### Task 9: Cases CRUD + dashboard layout/guard

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/cases/page.tsx`, `src/app/(dashboard)/cases/new/page.tsx`, `src/app/(dashboard)/cases/actions.ts`, `src/components/CaseForm.tsx`
- Modify: delete placeholder `src/app/page.tsx` from Task 1 (dashboard root now lives at `src/app/(dashboard)/page.tsx`, built in Task 11)

**Interfaces:**
- Consumes: `client` rows (Task 8), `case_type`/`court` reference rows (Task 2).
- Produces: server action `createCase(formData: FormData)`; `"case"` rows consumed by Task 10 (hearings) and Task 11 (dashboard).

- [ ] **Step 1: Dashboard layout with auth guard**

`src/app/(dashboard)/layout.tsx`:
```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return (
    <div>
      <nav className="border-b p-4 flex gap-4">
        <Link href="/" className="font-semibold">Dashboard</Link>
        <Link href="/cases">Cases</Link>
        <Link href="/clients">Clients</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Remove the scaffold placeholder**

```bash
rm src/app/page.tsx
```
(Task 11 creates the real `src/app/(dashboard)/page.tsx`; until then, hitting `/` 404s, which is expected mid-plan.)

- [ ] **Step 3: Server action**

`src/app/(dashboard)/cases/actions.ts`:
```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createCase(formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profile')
    .select('chamber_id')
    .eq('id', userData.user.id)
    .single()
  if (!profile) return { error: 'No chamber found for this user' }

  const cnr = (formData.get('cnr') as string)?.trim() || null

  const { data: newCase, error } = await supabase
    .from('case')
    .insert({
      chamber_id: profile.chamber_id,
      client_id: formData.get('client_id') as string,
      case_type_id: formData.get('case_type_id') as string,
      court_id: formData.get('court_id') as string,
      title: formData.get('title') as string,
      case_number: (formData.get('case_number') as string) || null,
      cnr,
      sync_enabled: cnr !== null,
    })
    .select('id')
    .single()
  if (error || !newCase) return { error: error?.message ?? 'Could not create case' }
  redirect(`/cases/${newCase.id}`)
}
```

- [ ] **Step 4: Reusable case form component**

`src/components/CaseForm.tsx`:
```tsx
type Option = { id: string; label: string }

export function CaseForm({
  action, clients, caseTypes, courts,
}: {
  action: (formData: FormData) => void
  clients: Option[]
  caseTypes: Option[]
  courts: Option[]
}) {
  return (
    <form action={action} className="p-6 max-w-md space-y-4">
      <h1 className="text-xl font-semibold">New case</h1>
      <input name="title" placeholder="Case title" className="w-full border p-2" required />
      <select name="client_id" className="w-full border p-2" required>
        <option value="">Select client</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select name="case_type_id" className="w-full border p-2" required>
        <option value="">Case type</option>
        {caseTypes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select name="court_id" className="w-full border p-2" required>
        <option value="">Court</option>
        {courts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input name="case_number" placeholder="Case number (optional)" className="w-full border p-2" />
      <input name="cnr" placeholder="CNR — 16 characters (optional)" className="w-full border p-2" maxLength={16} />
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">Save</button>
    </form>
  )
}
```

- [ ] **Step 5: New case page**

`src/app/(dashboard)/cases/new/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { createCase } from '../actions'
import { CaseForm } from '@/components/CaseForm'

export default async function NewCasePage() {
  const supabase = await createClient()
  const [{ data: clients }, { data: caseTypes }, { data: courts }] = await Promise.all([
    supabase.from('client').select('id, name').order('name'),
    supabase.from('case_type').select('id, label').order('label'),
    supabase.from('court').select('id, name').order('name'),
  ])

  return (
    <CaseForm
      action={createCase}
      clients={(clients ?? []).map((c) => ({ id: c.id, label: c.name }))}
      caseTypes={(caseTypes ?? []).map((c) => ({ id: c.id, label: c.label }))}
      courts={(courts ?? []).map((c) => ({ id: c.id, label: c.name }))}
    />
  )
}
```

- [ ] **Step 6: Case list page**

`src/app/(dashboard)/cases/page.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CasesPage() {
  const supabase = await createClient()
  const { data: cases } = await supabase
    .from('case')
    .select('id, title, case_number, stage, status, client:client_id(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Cases</h1>
        <Link href="/cases/new" className="bg-black text-white px-3 py-1.5 rounded">+ Case</Link>
      </div>
      <ul className="divide-y">
        {(cases ?? []).map((c: any) => (
          <li key={c.id} className="py-2">
            <Link href={`/cases/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
            <p className="text-sm text-gray-500">{c.client?.name} · {c.stage} · {c.status}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, log in, create a case via `/cases/new` (try with and without a CNR).
Expected: redirected to `/cases/<id>` (404 until Task 10 — expected), case appears in `/cases` list, and in Studio `sync_enabled` is `true` only when a CNR was entered.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)" src/components/CaseForm.tsx
git commit -m "feat: case list, create form, and dashboard layout guard"
```

---

### Task 10: Case detail page — hearings, notes, outcomes, document upload

**Files:**
- Create: `src/app/(dashboard)/cases/[id]/page.tsx`, `src/components/HearingForm.tsx`, `src/components/OutcomeForm.tsx`, `src/components/DocumentUpload.tsx`
- Modify: `src/app/(dashboard)/cases/actions.ts` — add `addHearing`, `recordOutcome`, `addNote`, `uploadDocument`

**Interfaces:**
- Consumes: `"case".id` (Task 9), Supabase Storage bucket `case-documents` (created in Step 1 below).
- Produces: `hearing` rows with `source = 'manual'` and matching `reminder` rows — these are what Task 7's bucket classifier and Task 11's dashboard query read; `document` rows in Supabase Storage.

- [ ] **Step 1: Create the storage bucket**

In Supabase Studio → Storage, create a **private** bucket named `case-documents`. Add a storage policy restricting access to the owner's chamber:
```sql
create policy "chamber rw case documents"
on storage.objects for all
using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth_chamber_id()::text)
with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth_chamber_id()::text);
```
Run this via the SQL editor (it's a storage-schema policy, not a migration file, since it depends on the bucket existing first).

- [ ] **Step 2: Extend actions.ts**

Append to `src/app/(dashboard)/cases/actions.ts`:
```ts
export async function addHearing(caseId: string, formData: FormData) {
  const supabase = await createClient()
  const date = formData.get('date') as string
  const purpose = formData.get('purpose') as string

  const { data: hearing, error } = await supabase
    .from('hearing')
    .insert({ case_id: caseId, date, purpose, source: 'manual' })
    .select('id')
    .single()
  if (error || !hearing) return { error: error?.message ?? 'Could not add hearing' }

  const hearingDateTime = new Date(date + 'T09:00:00')
  const threeDaysBefore = new Date(hearingDateTime.getTime() - 3 * 86_400_000)
  await supabase.from('reminder').insert([
    { hearing_id: hearing.id, remind_at: threeDaysBefore.toISOString(), channel: 'in_app' },
    { hearing_id: hearing.id, remind_at: hearingDateTime.toISOString(), channel: 'in_app' },
  ])
  return { success: true }
}

export async function recordOutcome(hearingId: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('hearing')
    .update({
      outcome: formData.get('outcome') as string,
      next_action: formData.get('next_action') as string,
    })
    .eq('id', hearingId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function addNote(caseId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }
  const { error } = await supabase
    .from('note')
    .insert({ case_id: caseId, body: formData.get('body') as string, author: userData.user.id })
  if (error) return { error: error.message }
  return { success: true }
}

export async function uploadDocument(caseId: string, chamberId: string, file: File) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  const path = `${chamberId}/${caseId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('case-documents').upload(path, file)
  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase.from('document').insert({
    case_id: caseId,
    chamber_id: chamberId,
    storage_ref: path,
    label: file.name,
    uploaded_by: userData.user.id,
  })
  if (dbError) return { error: dbError.message }
  return { success: true }
}
```

- [ ] **Step 3: Hearing form component (client component, calls server action)**

`src/components/HearingForm.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { addHearing } from '@/app/(dashboard)/cases/actions'

export function HearingForm({ caseId }: { caseId: string }) {
  const router = useRouter()
  async function handleSubmit(formData: FormData) {
    const result = await addHearing(caseId, formData)
    if (!result.error) router.refresh()
  }
  return (
    <form action={handleSubmit} className="flex gap-2 items-end">
      <input name="date" type="date" required className="border p-2" />
      <input name="purpose" placeholder="Purpose" className="border p-2" />
      <button type="submit" className="bg-black text-white px-3 py-2 rounded">Add hearing</button>
    </form>
  )
}
```

- [ ] **Step 4: Outcome form component**

`src/components/OutcomeForm.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { recordOutcome } from '@/app/(dashboard)/cases/actions'

export function OutcomeForm({ hearingId }: { hearingId: string }) {
  const router = useRouter()
  async function handleSubmit(formData: FormData) {
    const result = await recordOutcome(hearingId, formData)
    if (!result.error) router.refresh()
  }
  return (
    <form action={handleSubmit} className="flex gap-2 mt-1">
      <input name="outcome" placeholder="Outcome" className="border p-1 text-sm" />
      <input name="next_action" placeholder="Next action" className="border p-1 text-sm" />
      <button type="submit" className="text-sm underline">Save</button>
    </form>
  )
}
```

- [ ] **Step 5: Document upload component**

`src/components/DocumentUpload.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { uploadDocument } from '@/app/(dashboard)/cases/actions'

export function DocumentUpload({ caseId, chamberId }: { caseId: string; chamberId: string }) {
  const router = useRouter()
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadDocument(caseId, chamberId, file)
    router.refresh()
  }
  return <input type="file" onChange={handleChange} />
}
```

- [ ] **Step 6: Case detail page**

`src/app/(dashboard)/cases/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { addNote } from '../actions'
import { HearingForm } from '@/components/HearingForm'
import { OutcomeForm } from '@/components/OutcomeForm'
import { DocumentUpload } from '@/components/DocumentUpload'

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: caseRow }, { data: hearings }, { data: documents }, { data: notes }] = await Promise.all([
    supabase.from('case').select('id, title, chamber_id, cnr, sync_enabled, client:client_id(name)').eq('id', id).single(),
    supabase.from('hearing').select('id, date, purpose, source, outcome, next_action').eq('case_id', id).order('date'),
    supabase.from('document').select('id, label, storage_ref').eq('case_id', id),
    supabase.from('note').select('id, body, created_at').eq('case_id', id).order('created_at', { ascending: false }),
  ])

  if (!caseRow) return <div className="p-6">Case not found.</div>

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold">{caseRow.title}</h1>
      {caseRow.cnr && <p className="text-sm text-gray-500">CNR: {caseRow.cnr} · sync {caseRow.sync_enabled ? 'on' : 'off'}</p>}

      <section>
        <h2 className="font-medium mb-2">Hearings</h2>
        <ul className="space-y-2 mb-3">
          {(hearings ?? []).map((h) => (
            <li key={h.id} className="border p-2 rounded">
              <p>{h.date} — {h.purpose} <span className="text-xs text-gray-400">({h.source})</span></p>
              {h.outcome && <p className="text-sm">Outcome: {h.outcome} → {h.next_action}</p>}
              <OutcomeForm hearingId={h.id} />
            </li>
          ))}
        </ul>
        <HearingForm caseId={id} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Documents</h2>
        <ul className="mb-2">
          {(documents ?? []).map((d) => <li key={d.id} className="text-sm">{d.label}</li>)}
        </ul>
        <DocumentUpload caseId={id} chamberId={caseRow.chamber_id} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Notes</h2>
        <form action={addNote.bind(null, id)} className="flex gap-2 mb-3">
          <input name="body" placeholder="Add a note" className="border p-2 flex-1" required />
          <button type="submit" className="bg-black text-white px-3 py-2 rounded">Add</button>
        </form>
        <ul className="space-y-1">
          {(notes ?? []).map((n) => <li key={n.id} className="text-sm">{n.body}</li>)}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open a case detail page, add a hearing for tomorrow, record an outcome, upload a small PDF, add a note.
Expected: all four appear without a page reload (via `router.refresh()`); in Studio, confirm two `reminder` rows were created for the hearing and the `document` row's `storage_ref` matches an object in the `case-documents` bucket.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/cases" src/components/HearingForm.tsx src/components/OutcomeForm.tsx src/components/DocumentUpload.tsx
git commit -m "feat: case detail page with hearings, outcomes, documents, notes"
```

---

### Task 11: Dashboard (Today / This week / Overdue)

**Files:**
- Create: `src/app/(dashboard)/page.tsx`, `src/components/HearingBucketList.tsx`

**Interfaces:**
- Consumes: `classifyHearing` (Task 7), `hearing`/`case` rows (Tasks 9–10).
- Produces: the app's root route `/`.

- [ ] **Step 1: Bucket list component**

`src/components/HearingBucketList.tsx`:
```tsx
import Link from 'next/link'

type Row = { hearingId: string; caseId: string; caseTitle: string; courtName: string; date: string; purpose: string | null }

export function HearingBucketList({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <section className="mb-6">
      <h2 className="font-medium mb-2">{title}</h2>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.hearingId} className="py-2">
            <Link href={`/cases/${r.caseId}`} className="hover:underline">{r.caseTitle}</Link>
            <p className="text-sm text-gray-500">{r.courtName} · {r.date} · {r.purpose}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: Dashboard page**

`src/app/(dashboard)/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { classifyHearing } from '@/lib/dates/buckets'
import { HearingBucketList } from '@/components/HearingBucketList'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: hearings } = await supabase
    .from('hearing')
    .select('id, date, purpose, case:case_id(id, title, court:court_id(name))')
    .is('outcome', null)
    .order('date')

  const rows = (hearings ?? []).map((h: any) => ({
    hearingId: h.id,
    caseId: h.case.id,
    caseTitle: h.case.title,
    courtName: h.case.court?.name ?? '',
    date: h.date,
    purpose: h.purpose,
    bucket: classifyHearing(h.date),
  }))

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>
      <HearingBucketList title="Overdue" rows={rows.filter((r) => r.bucket === 'overdue')} />
      <HearingBucketList title="Today" rows={rows.filter((r) => r.bucket === 'today')} />
      <HearingBucketList title="This week" rows={rows.filter((r) => r.bucket === 'this_week')} />
      {rows.every((r) => r.bucket !== 'overdue' && r.bucket !== 'today' && r.bucket !== 'this_week') && (
        <p className="text-gray-500">Nothing due in the next 7 days.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, visit `/`.
Expected: the hearing added in Task 10 shows up in the correct bucket (e.g. "Today" or "This week"); a hearing with `outcome` already set does not appear (filtered by `.is('outcome', null)`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/page.tsx" src/components/HearingBucketList.tsx
git commit -m "feat: Today/This week/Overdue dashboard"
```

---

### Task 12: CNR sync — pure logic (TDD) + provider interface

**Files:**
- Create: `src/lib/cnr/provider.ts`, `src/lib/cnr/mockProvider.ts`, `src/lib/cnr/surepassProvider.ts`, `src/lib/cnr/sync.ts`
- Test: `tests/unit/cnrSync.test.ts`, `tests/fixtures/cnrResponses.ts`

**Interfaces:**
- Produces: `CnrProvider` interface (`fetchCaseStatus(cnr: string): Promise<CnrResult>`), `decideSyncAction(current: HearingSnapshot | null, fetched: CnrResult): SyncDecision` — consumed by Task 13's Edge Function.

- [ ] **Step 1: Define the interface and types**

`src/lib/cnr/provider.ts`:
```ts
export type CnrResult =
  | { ok: true; nextHearingDate: string | null; raw: unknown }
  | { ok: false; errorMessage: string; raw: unknown }

export interface CnrProvider {
  fetchCaseStatus(cnr: string): Promise<CnrResult>
}
```

- [ ] **Step 2: Write the failing test for sync decision logic**

`tests/fixtures/cnrResponses.ts`:
```ts
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
```

`tests/unit/cnrSync.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { decideSyncAction } from '@/lib/cnr/sync'
import { successWithNewDate, successUnchanged, successNoDate, providerFailure } from '../fixtures/cnrResponses'

describe('decideSyncAction', () => {
  it('upserts when the fetched date differs from the latest manual hearing', () => {
    const decision = decideSyncAction(
      { date: '2026-06-25', source: 'manual' },
      successWithNewDate
    )
    expect(decision).toEqual({ action: 'upsert', date: '2026-07-10' })
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- cnrSync`
Expected: FAIL — `Cannot find module '@/lib/cnr/sync'`

- [ ] **Step 4: Implement the pure decision function**

`src/lib/cnr/sync.ts`:
```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- cnrSync`
Expected: PASS (7 tests). Note: this also fixes test 1's literal expectation — `current.source === 'manual'` short-circuits to `unchanged`, so the "never overwrite manual" test and "upserts when fetched date differs" test were written against the same fixture; re-check the spec's safety rule (§6: "Auto-sync never overwrites a manual hearing") and adjust test 1's expected value to `{ action: 'unchanged' }` to match — manual protection takes precedence over "new date available." Update the test file accordingly before treating this step as done.

- [ ] **Step 6: Mock provider for tests/dev**

`src/lib/cnr/mockProvider.ts`:
```ts
import type { CnrProvider, CnrResult } from './provider'

export class MockCnrProvider implements CnrProvider {
  constructor(private readonly responses: Record<string, CnrResult>) {}

  async fetchCaseStatus(cnr: string): Promise<CnrResult> {
    return this.responses[cnr] ?? { ok: false, errorMessage: 'No fixture for CNR', raw: null }
  }
}
```

- [ ] **Step 7: Real provider (Surepass)**

`src/lib/cnr/surepassProvider.ts`:
```ts
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
```
Note: the exact Surepass response shape (`data.next_hearing_date`, `dd-mm-yyyy` format) is a placeholder for the real vendor contract — confirm against their actual API docs once a vendor account exists (this is exactly spec §9's open question "which eCourts provider to contract with"). Because all sync logic lives in `decideSyncAction` and only this one file touches the vendor shape, fixing the parsing later is a one-file change.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cnr tests/unit/cnrSync.test.ts tests/fixtures/cnrResponses.ts
git commit -m "feat: CNR sync decision logic, provider interface, mock and Surepass implementations"
```

---

### Task 13: CNR sync Edge Function (cron)

**Files:**
- Create: `supabase/functions/cnr-sync/index.ts`

**Interfaces:**
- Consumes: `decideSyncAction`, `CnrProvider`, `SurepassCnrProvider` from Task 12.
- Produces: a deployed, cron-scheduled Edge Function that writes `hearing`, `reminder`, and `cnr_sync_log` rows.

- [ ] **Step 1: Write the function**

`supabase/functions/cnr-sync/index.ts`:
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

type CnrResult =
  | { ok: true; nextHearingDate: string | null; raw: unknown }
  | { ok: false; errorMessage: string; raw: unknown }

function decideSyncAction(
  current: { date: string; source: 'manual' | 'cnr_sync' } | null,
  fetched: CnrResult
): { action: 'upsert'; date: string } | { action: 'unchanged' } | { action: 'failed'; errorMessage: string } {
  if (!fetched.ok) return { action: 'failed', errorMessage: fetched.errorMessage }
  if (!fetched.nextHearingDate) return { action: 'unchanged' }
  if (current?.source === 'manual') return { action: 'unchanged' }
  if (current && current.date === fetched.nextHearingDate) return { action: 'unchanged' }
  return { action: 'upsert', date: fetched.nextHearingDate }
}

async function fetchFromSurepass(cnr: string, apiKey: string): Promise<CnrResult> {
  try {
    const response = await fetch('https://kyc-api.surepass.io/api/v1/court-case/cnr', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnr }),
    })
    const raw = await response.json()
    if (!response.ok) return { ok: false, errorMessage: `Surepass error: ${response.status}`, raw }
    const rawDate: string | undefined = raw?.data?.next_hearing_date
    const nextHearingDate = rawDate ? rawDate.split('-').reverse().join('-') : null
    return { ok: true, nextHearingDate, raw }
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : 'Unknown error', raw: null }
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const surepassKey = Deno.env.get('SUREPASS_API_KEY')!

  const { data: cases, error } = await supabase
    .from('case')
    .select('id, cnr')
    .eq('sync_enabled', true)
    .not('cnr', 'is', null)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const results = []
  for (const c of cases ?? []) {
    const { data: latestHearing } = await supabase
      .from('hearing')
      .select('date, source')
      .eq('case_id', c.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const fetched = await fetchFromSurepass(c.cnr, surepassKey)
    const decision = decideSyncAction(latestHearing ?? null, fetched)

    if (decision.action === 'upsert') {
      const { data: hearing } = await supabase
        .from('hearing')
        .insert({ case_id: c.id, date: decision.date, source: 'cnr_sync' })
        .select('id')
        .single()
      if (hearing) {
        const hearingDateTime = new Date(decision.date + 'T09:00:00')
        const threeDaysBefore = new Date(hearingDateTime.getTime() - 3 * 86_400_000)
        await supabase.from('reminder').insert([
          { hearing_id: hearing.id, remind_at: threeDaysBefore.toISOString(), channel: 'in_app' },
          { hearing_id: hearing.id, remind_at: hearingDateTime.toISOString(), channel: 'in_app' },
        ])
      }
    }

    await supabase.from('cnr_sync_log').insert({
      case_id: c.id,
      raw_payload: fetched.raw,
      parsed_next_date: decision.action === 'upsert' ? decision.date : null,
      status: decision.action === 'upsert' ? 'updated' : decision.action,
    })

    results.push({ caseId: c.id, action: decision.action })
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```
Note: this Edge Function duplicates `decideSyncAction` from `src/lib/cnr/sync.ts` rather than importing it, because Supabase Edge Functions run on Deno with their own module resolution and cannot import from the Next.js `src/` tree without a build step. Both copies are covered by the same unit tests conceptually — Task 12's tests are the source of truth for the logic; keep them in sync if either changes.

- [ ] **Step 2: Set the Surepass API key as a function secret**

```bash
npx supabase secrets set SUREPASS_API_KEY=<key-from-vendor-account>
```
(Deferred until a Surepass account exists — spec §9 open question. Until then, `cases` with `sync_enabled = true` will simply log `failed` entries, which is the documented safe failure mode.)

- [ ] **Step 3: Deploy and schedule**

```bash
npx supabase functions deploy cnr-sync
```
In Supabase Studio → Database → Cron Jobs, schedule `cnr-sync` to run daily at 06:00 IST (`30 0 * * *` UTC).

- [ ] **Step 4: Manual verification**

Run: `npx supabase functions invoke cnr-sync` against a test case with `sync_enabled = true` and a CNR that has no Surepass account configured.
Expected: response includes `{"action":"failed"}` for that case, and a `cnr_sync_log` row with `status = 'failed'` exists — confirms the safe-failure path works end-to-end even without a live vendor key.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/cnr-sync
git commit -m "feat: cnr-sync Edge Function with cron schedule"
```

---

### Task 14: Reminder scan logic (TDD) + send-reminders Edge Function

**Files:**
- Create: `src/lib/reminders/scan.ts`, `supabase/functions/send-reminders/index.ts`
- Test: `tests/unit/reminderScan.test.ts`

**Interfaces:**
- Consumes: `reminder` rows (Task 4).
- Produces: `isDue(reminder: { remindAt: string; status: string }, now: Date): boolean` — used by both the unit test and (duplicated, same reasoning as Task 13) the Edge Function.

- [ ] **Step 1: Write the failing test**

`tests/unit/reminderScan.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isDue } from '@/lib/reminders/scan'

describe('isDue', () => {
  const now = new Date('2026-06-19T09:00:00Z')

  it('is due when remind_at is in the past and status is pending', () => {
    expect(isDue({ remindAt: '2026-06-19T08:00:00Z', status: 'pending' }, now)).toBe(true)
  })

  it('is not due when remind_at is in the future', () => {
    expect(isDue({ remindAt: '2026-06-20T08:00:00Z', status: 'pending' }, now)).toBe(false)
  })

  it('is not due when status is already sent — re-running never double-sends', () => {
    expect(isDue({ remindAt: '2026-06-19T08:00:00Z', status: 'sent' }, now)).toBe(false)
  })

  it('is not due when status is cancelled', () => {
    expect(isDue({ remindAt: '2026-06-19T08:00:00Z', status: 'cancelled' }, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reminderScan`
Expected: FAIL — `Cannot find module '@/lib/reminders/scan'`

- [ ] **Step 3: Implement**

`src/lib/reminders/scan.ts`:
```ts
export function isDue(reminder: { remindAt: string; status: string }, now: Date = new Date()): boolean {
  return reminder.status === 'pending' && new Date(reminder.remindAt).getTime() <= now.getTime()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reminderScan`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit the pure logic**

```bash
git add src/lib/reminders/scan.ts tests/unit/reminderScan.test.ts
git commit -m "feat: reminder due-check logic"
```

- [ ] **Step 6: Write the Edge Function**

`supabase/functions/send-reminders/index.ts`:
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: dueReminders, error } = await supabase
    .from('reminder')
    .select('id, hearing_id, channel')
    .eq('status', 'pending')
    .lte('remind_at', new Date().toISOString())

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Phase 1 delivery: in-app reminders are "delivered" by existing in the
  // table with status pending and being shown wherever the app queries
  // them; "sending" means marking them sent so the UI stops surfacing them
  // as new. PWA push delivery for channel === 'push' is a Phase 1 stretch
  // wired here but requires a push subscription table not yet in scope —
  // see spec §2 non-goals list (push is mentioned as a target, in-app is
  // the guaranteed channel).
  const ids = (dueReminders ?? []).map((r) => r.id)
  if (ids.length > 0) {
    await supabase.from('reminder').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', ids)
  }

  return new Response(JSON.stringify({ sent: ids.length }), { headers: { 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 7: Deploy and schedule**

```bash
npx supabase functions deploy send-reminders
```
In Supabase Studio → Database → Cron Jobs, schedule `send-reminders` to run every 15 minutes (`*/15 * * * *`).

- [ ] **Step 8: Manual verification**

Create a `reminder` row with `remind_at` in the past and `status = 'pending'` directly in Studio. Run: `npx supabase functions invoke send-reminders`.
Expected: response `{"sent":1}`; the row's `status` is now `sent` with `sent_at` populated. Invoke again — expect `{"sent":0}`, proving idempotency.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/send-reminders
git commit -m "feat: send-reminders Edge Function with cron schedule"
```

---

### Task 15: PWA manifest + installability

**Files:**
- Create: `src/app/manifest.ts`, `public/icon-192.png`, `public/icon-512.png`

**Interfaces:**
- Produces: a Next.js-served `/manifest.webmanifest` making the app installable. (Push notification subscription/service-worker registration is explicitly out of scope per Task 14 Step 6's note — in-app reminders are the Phase 1 guarantee; this task only covers installability, which spec §2/§3 require as part of "PWA.")

- [ ] **Step 1: Add manifest**

`src/app/manifest.ts`:
```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lawyer Case Tracker',
    short_name: 'CaseTracker',
    description: 'Never miss a hearing date.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 2: Add placeholder icons**

Generate or source two square PNGs (192×192 and 512×512) and place them at `public/icon-192.png` and `public/icon-512.png`. Any solid-color placeholder with the firm's initials is sufficient for Phase 1 — real branding is a non-blocking follow-up.

- [ ] **Step 3: Verify installability**

Run: `npm run build && npm run start`, open in Chrome, open DevTools → Application → Manifest.
Expected: manifest loads with no errors; an "Install" affordance appears in the browser address bar.

- [ ] **Step 4: Commit**

```bash
git add src/app/manifest.ts public/icon-192.png public/icon-512.png
git commit -m "feat: PWA manifest for installability"
```

---

### Task 16: RLS isolation tests

**Files:**
- Create: `tests/rls/rls-isolation.test.ts`

**Interfaces:**
- Consumes: the live Supabase project's anon key (from `.env.local`) plus two throwaway test users created in the test itself.
- Produces: automated proof that chamber A cannot read chamber B's `client`/`case` rows — this is the spec's §7 "RLS policy tests" requirement.

- [ ] **Step 1: Write the test**

`tests/rls/rls-isolation.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signUpAndSetupChamber(email: string, chamberName: string) {
  const supabase = createClient(url, anonKey)
  const password = 'Test1234!'
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
  if (signUpError || !signUpData.user) throw signUpError ?? new Error('signup failed')

  const { data: chamber, error: chamberError } = await supabase
    .from('chamber')
    .insert({ name: chamberName })
    .select('id')
    .single()
  if (chamberError || !chamber) throw chamberError ?? new Error('chamber insert failed')

  await supabase.from('profile').insert({ id: signUpData.user.id, chamber_id: chamber.id, email })
  return { supabase, chamberId: chamber.id }
}

describe('RLS chamber isolation', () => {
  let chamberA: ReturnType<typeof createClient>
  let chamberB: ReturnType<typeof createClient>
  let clientAId: string

  beforeAll(async () => {
    const stamp = Date.now()
    const a = await signUpAndSetupChamber(`rls-test-a-${stamp}@example.com`, 'Chamber A')
    const b = await signUpAndSetupChamber(`rls-test-b-${stamp}@example.com`, 'Chamber B')
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
```

- [ ] **Step 2: Run the test against the live project**

Run: `npm test -- rls-isolation`
Expected: PASS (3 tests). This hits the real Supabase project (`czznfdzvapqernkzclvw`), so it requires network access and will leave two test users behind — acceptable for Phase 1; a cleanup script is a later nice-to-have, not a blocker.

- [ ] **Step 3: Commit**

```bash
git add tests/rls/rls-isolation.test.ts
git commit -m "test: RLS chamber isolation"
```

---

### Task 17: End-to-end happy path test

**Files:**
- Create: `tests/e2e/happy-path.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–14 against the live Supabase project.
- Produces: the spec's §7 "thin happy-path integration test: add case → see it on dashboard → reminder fires."

- [ ] **Step 1: Write the test**

`tests/e2e/happy-path.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { classifyHearing } from '@/lib/dates/buckets'
import { isDue } from '@/lib/reminders/scan'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

describe('happy path: add case -> dashboard -> reminder fires', () => {
  let supabase: ReturnType<typeof createClient>
  let chamberId: string
  let caseTypeId: string
  let courtId: string

  beforeAll(async () => {
    const stamp = Date.now()
    supabase = createClient(url, anonKey)
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: `happy-path-${stamp}@example.com`,
      password: 'Test1234!',
    })
    if (error || !signUpData.user) throw error ?? new Error('signup failed')

    const { data: chamber } = await supabase.from('chamber').insert({ name: 'Happy Path Chamber' }).select('id').single()
    chamberId = chamber!.id
    await supabase.from('profile').insert({ id: signUpData.user.id, chamber_id: chamberId, email: signUpData.user.email })

    const { data: caseType } = await supabase.from('case_type').select('id').eq('code', 'civil').single()
    caseTypeId = caseType!.id
    const { data: court } = await supabase.from('court').select('id').limit(1).single()
    courtId = court!.id
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
```

- [ ] **Step 2: Run the test**

Run: `npm test -- happy-path`
Expected: PASS (1 test, with internal assertions covering the full add-case → dashboard → reminder-due chain).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/happy-path.test.ts
git commit -m "test: end-to-end happy path for case tracker"
```

---

## Self-Review Notes

- **Spec coverage:** §2 in-scope bullets all map to tasks — auth/chamber (6), clients (8), cases (9), hearings manual+CNR (10, 12, 13), reminders (10, 14), dashboard (11), doc upload (10), notes/outcomes (10). §6 safety rules map to Task 12's tests + Task 13's `decideSyncAction` reuse. §7 testing approach maps to Tasks 16–17. §4 schema maps to Tasks 2–5 exactly, table-for-table.
- **Placeholder/ambiguity fix applied during review:** Task 12 Step 5 originally had a self-contradictory test (asserting both "upserts on new date" and "manual always wins" against the same manual-source fixture). Resolved in favor of the spec's explicit safety rule (§6: manual hearings are never overwritten) — the implementation and the note in Step 5 make this precedence explicit so an implementer doesn't silently pick the other interpretation.
- **Type consistency:** `CnrResult`/`SyncDecision`/`HearingSnapshot` in Task 12 match the duplicated shapes in Task 13's Edge Function; `isDue`'s signature matches between Task 14's unit test and Edge Function usage (Edge Function does the equivalent comparison inline rather than importing, per the cross-runtime note).
- **Scope check:** all 17 tasks stay within Phase 1; no drafting, AI, billing, or knowledge-base code appears anywhere in the plan.
