# Indian Lawyer Software — Design Doc

**Date:** 2026-06-19
**Status:** Phase 1 spec approved for planning; Phases 2–5 are roadmap-level.
**Goal of this build:** A real product / startup MVP for Indian litigators (criminal, bail, civil), narrow and genuinely reliable rather than broad and shallow.

---

## 1. Vision & Decomposition

The full ambition is a complete legal-tech platform: practice/case management, document management & generation, firm operations, AI legal intelligence, and a legal knowledge base. That is **five independent products**, and designing all five at once produces a vague spec for everything and a buildable spec for nothing.

These pieces depend on each other in one direction, which dictates build order:

```
                    ┌─────────────────────────────────┐
                    │   1. CASE TRACKER (the spine)    │
                    │   clients · cases · hearings ·   │
                    │   dates · reminders              │
                    └─────────────────────────────────┘
                          ▲            ▲           ▲
            attaches to ──┘            │           └── converts into
                                       │
        ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐
        │ 2. DOC VAULT &   │  │ 3. AI ANALYZER &   │  │ 4. CLIENT/ENQUIRY │
        │    DRAFTING      │  │   "MISSING THINGS" │  │    CRM            │
        └──────────────────┘  └────────────────────┘  └──────────────────┘
```

- Documents must live on a **case** → doc vault needs the spine.
- The AI analyzer flags missing documents/steps → needs the **case type + its docs** as input.
- The CRM is the front of the funnel → an enquiry that **converts into a case**.

So the case tracker is the **platform** the others plug into, not "feature 1 of 4."

### Phased Roadmap

| Phase | What ships | Why this order |
|-------|-----------|----------------|
| **1 — MVP** | Case tracker spine: clients, cases (any type), hearings/dates, reminders, basic per-case doc upload | The daily habit + the data foundation everything else needs |
| **2** | Document vault + template-based drafting (bail apps, pleadings, vakalatnama) | Builds on Phase-1 cases & docs |
| **3** | AI case analysis + "missing documents/steps" audit reports | Needs real cases + docs to analyze |
| **4** | Legal knowledge base (statutes, Constitution, court hierarchy, case law) woven into AI + drafting | Most content-heavy; powers Phases 2–3 |
| **5** | Firm ops: staff, hiring, billing, advanced notifications | Matters once a firm has adopted the core |

Each of Phases 2–5 gets its own spec → plan → implementation cycle.

---

## 2. Phase 1 — Scope

**What it is:** A responsive web **PWA** where a civil/criminal litigator manages their cases and never misses a hearing date.

**In scope:**
- Auth + a "chamber" (firm) that owns all data — multi-tenant-ready schema, solo UI
- **Clients** (parties the lawyer represents)
- **Cases** of any type (civil/criminal/bail first), with court, case number, optional CNR
- **Hearings/dates** per case — manual entry + optional CNR auto-sync from a third-party eCourts API
- **Reminders** — in-app + PWA push, ahead of each hearing
- **Dashboard** — Today / This week / Overdue
- **Basic document upload** per case (storage only; the vault & drafting is Phase 2)
- **Case notes / hearing outcomes** (what happened, next step)

**Explicit non-goals (deferred):** drafting/templates, AI analysis, knowledge base, billing, staff/hiring, WhatsApp/SMS, client login. Designed *around*, not built.

**Target user:** Solo litigator / small firm in district & high courts. Data model general enough to represent any case type/court; workflow depth focused on the litigation lifecycle (filed → listed → heard → order/next-date → repeat) shared by ~80% of criminal/civil/bail practice.

---

## 3. Tech Stack

- **Frontend:** Next.js (React) responsive PWA — one codebase for phone + laptop, installable, supports push notifications. Fastest to validate an MVP, no app-store friction.
- **Backend / data:** Supabase — Postgres DB, built-in auth, file storage, realtime, edge functions, **pgvector** (for the Phase-4 knowledge base) and cron-capable Edge Functions (for CNR sync + reminders).
- **AI (Phases 3–4):** **Google Gemini / Vertex AI** — see §8.

Rationale: one foundation covers Phase 1 *and* gives auth, document storage, a SQL DB, and a vector store for AI later — no re-platforming.

---

## 4. Data Model

Core tables (Supabase Postgres). Every table carries `chamber_id` and is protected by Row-Level Security.

```
chamber            — the tenant (firm/solo practice). Owns everything.
profile            — a user; belongs to a chamber; has a role (owner now; junior/clerk later)
client             — name, phone, email, address; belongs to chamber
case               — title, case_type, court_id, case_number, cnr (nullable),
                     stage, status (active/disposed), client_id, chamber_id,
                     sync_enabled (bool)
party              — opposing/other parties on a case (name, role: petitioner/respondent…)
hearing            — case_id, date, purpose/stage, source (manual|cnr_sync),
                     outcome (nullable), next_action (nullable)
document           — case_id, storage_ref (Supabase Storage), label, uploaded_by
note               — case_id, body, author, created_at
reminder           — hearing_id, remind_at, channel (in_app|push), status, sent_at
case_type          — reference lookup (civil/criminal/bail/…), seeded, extensible
court              — reference lookup (Indian court hierarchy), seeded, extensible
cnr_sync_log       — case_id, fetched_at, raw_payload, parsed_next_date, status
                     (audit trail of every auto-sync)
```

Key design choices:
- **`case_type` and `court` are reference tables, not enums** — "serve every case type/court" is true without code changes.
- **`hearing.source`** distinguishes manual vs auto-synced dates, so an API failure never overwrites what the lawyer typed.
- **`cnr_sync_log`** keeps the raw API response every time — essential for trust ("where did this date come from?") and debugging a flaky third-party API.
- **`chamber_id` + RLS everywhere** — multi-tenancy enforced at the database, not just the app.

---

## 5. Core Flows

**A. Add a case**
1. "+ Case" → pick/create a client → select case type + court (reference data) → optionally paste a **CNR**.
2. Case saved with `chamber_id`; if a CNR is present and `sync_enabled`, a background sync job fires.

**B. Hearing-date capture (the wedge)**
- *Manual:* lawyer enters next date + purpose → `hearing` (`source = manual`) + `reminder` rows created.
- *CNR auto-sync:* scheduled Edge Function calls the eCourts provider, parses the next date, **upserts** a `hearing` (`source = cnr_sync`) + logs raw payload to `cnr_sync_log`.

**C. Dashboard (the daily open)**
- Buckets: **Today / This week / Overdue**. Each hearing shows case, court, purpose, and a one-tap "record outcome" → updates `hearing.outcome` + `next_action`.

---

## 6. CNR Auto-Sync Design

Context: there is no free official eCourts API, but the portal works on a **CNR** (16-digit Case Number Record). Third-party services (Surepass, Vakeel360, eCourtsIndia, Apify scrapers) expose case data by CNR — including the **next hearing date** — across district courts, 25 High Courts, and the Supreme Court, per-call or by subscription. Reliability/legality varies, so this is isolated behind a clean boundary.

```
case (cnr, sync_enabled)
        │  cron (e.g. daily 06:00 IST)
        ▼
  sync-worker (Edge Function)
        │  calls →  CnrProvider (interface)
        │              └─ implementation: Surepass / Vakeel360 / … (swappable)
        ▼
  parse → compare to latest hearing
        ├─ new/changed date → upsert hearing(source=cnr_sync) + reminder
        ├─ unchanged        → just log
        └─ API error/timeout→ log status=failed, DO NOT touch manual data
```

Safety rules:
- **`CnrProvider` is an interface** — the vendor is one swappable implementation; no lock-in.
- **Auto-sync never overwrites a `manual` hearing** — the lawyer's own entry always wins.
- **Every call logs to `cnr_sync_log`** — provenance + debuggability.
- A failed sync is invisible except a small "last synced / sync failed" indicator on the case — the app never *appears* broken because a scraper hiccuped.

---

## 7. Reminder Engine & Security

**Reminders:** a scheduled function scans `reminder` rows where `remind_at <= now()` and `status = pending`, delivers via **in-app + PWA push**, marks `sent`. Default per hearing: a few days before + morning-of (configurable later). Idempotent — re-running never double-sends. WhatsApp/SMS/client-reminders are easy later add-ons (the `reminder.channel` field already anticipates them).

**Security / multi-tenancy:** every table carries `chamber_id`; **Supabase RLS** policies ensure a user only reads/writes rows for their own chamber — at the database layer. Documents in Supabase Storage are access-controlled per chamber. This foundation makes both the firm/multi-user expansion and later AI-on-confidential-docs safe.

**Testing approach:**
- Unit-test the date/reminder logic and the CNR parser/upsert rules (with **recorded API fixtures**, since the live API is flaky and paid).
- RLS policy tests proving cross-chamber isolation.
- A thin happy-path integration test: add case → see it on dashboard → reminder fires.

---

## 8. AI Architecture (Phases 3–4) — Direction

AI is Phase 3–4 because it is *dependent*: the "missing things" auditor needs cases + documents as input; the knowledge base is the most content-heavy piece. The Phase-1 data model is already AI-ready (structured cases in Postgres, docs in Storage, pgvector available).

**Standardized on Google Gemini / Vertex AI.** Rationale for this use case:
- **OCR of scanned/handwritten/vernacular documents** — a large share of Indian court documents are scanned PDFs, photocopies, or handwritten notes in Hindi/regional scripts. Gemini's multimodal OCR (and Vertex Document AI) handles these better than text-only LLMs.
- **Vernacular support** — strong across Indian languages.
- **Cost** — the Flash tier is very cheap for high-volume bulk extraction/classification.
- **Data residency / DPDP Act 2023** — Vertex AI supports India-region hosting, critical for client confidentiality.
- **One vendor** — LLM, multilingual text-embeddings, and OCR (Document AI) all from Vertex; embeddings → Supabase pgvector for RAG.

**Tiering (cost discipline):** Gemini Flash for bulk extraction/classification/routing; a stronger Gemini tier for document analysis, Q&A, and the "missing things" audit. Reserve the most capable model for the trust-critical audit/advice.

**Non-negotiable legal guardrails (baked into the Phase-3 spec):**
- Every AI output **cites its source** (grounding) so the lawyer can verify.
- The AI **assists, never replaces** the lawyer's judgment.
- Outputs carry a clear "verify before relying / not a substitute for professional judgment" framing — an unverified AI citation in a filing is a real professional risk in Indian practice.

**Engineering principle:** wrap the LLM/OCR/embeddings behind thin interfaces (same pattern as `CnrProvider`) so a provider change is never a rewrite.

---

## 9. Open Questions (revisit at the relevant phase)

- Which specific eCourts third-party provider to contract with (cost, coverage, ToS) — decide when building Phase-1 CNR sync.
- Reminder cadence defaults and whether to let lawyers customize per case.
- Phase-3: final Gemini model tiers and whether to add Vertex Document AI as a separate OCR stage.
- Phase-4: knowledge-base sourcing (statute/Constitution/case-law corpora) and update cadence.
