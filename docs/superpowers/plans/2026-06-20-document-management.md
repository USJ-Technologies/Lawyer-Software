# Document Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 flat document-upload list with categorized, viewable, deletable document management on the case detail page.

**Architecture:** Extend the existing `document` table with `category`/`mime_type`/`size_bytes` columns; extend the existing `cases/actions.ts` server actions with delete and signed-URL-fetch operations; replace the single-file `DocumentUpload` component with a `DocumentManager` container composing a categorized `DocumentList`, an on-demand `DocumentPreview`, and a multi-file `DocumentUploadZone`.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase (Postgres + Storage + RLS), Vitest.

## Global Constraints

- No "Co-Authored-By" or "Claude" text in any commit message (standing project rule).
- Never add an explicit `chamber_id` filter to a Supabase query that RLS already scopes — rely on RLS, exactly as every existing query in this codebase does (see `cases/actions.ts`, `cases/page.tsx`).
- `category` is one of exactly: `petition`, `affidavit`, `order`, `evidence`, `correspondence`, `other`.
- Max upload size: 20MB per file, enforced both client-side (before upload attempt) and server-side (in the server action).
- Signed URLs for document preview expire after 60 seconds.
- Apply the schema migration to the live Supabase project (ref `czznfdzvapqernkzclvw`) via the `mcp__supabase__apply_migration` tool, the same live project every other migration in this codebase has been applied to.

---

### Task 1: Schema migration — document categories

**Files:**
- Create: `supabase/migrations/0011_document_categories.sql`

**Interfaces:**
- Produces: `document.category` (text, not null, check-constrained), `document.mime_type` (text, nullable), `document.size_bytes` (bigint, nullable), `document.label` becomes nullable — consumed by Task 3's server actions and Task 5/6's components.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0011_document_categories.sql`:
```sql
alter table document
  add column category text not null default 'other'
    check (category in ('petition', 'affidavit', 'order', 'evidence', 'correspondence', 'other')),
  add column mime_type text,
  add column size_bytes bigint;

alter table document alter column label drop not null;
```

- [ ] **Step 2: Apply the migration to the live project**

Use the `mcp__supabase__apply_migration` tool with `name: "0011_document_categories"` and the SQL above as `query`.

- [ ] **Step 3: Verify the schema change**

Use `mcp__supabase__execute_sql` with:
```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_name = 'document'
order by ordinal_position;
```
Expected: `category` (not null, default `'other'`), `mime_type` (nullable), `size_bytes` (nullable), `label` (nullable — changed from `NO` to `YES`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0011_document_categories.sql
git commit -m "feat: document categories, mime type, and size columns"
```

---

### Task 2: Preview-kind classifier (pure function, TDD)

**Files:**
- Create: `src/lib/documents/preview.ts`
- Test: `tests/unit/previewKind.test.ts`

**Interfaces:**
- Produces: `classifyPreviewKind(mimeType: string | null): 'pdf' | 'image' | 'unsupported'` — consumed by Task 6's `DocumentPreview`.

- [ ] **Step 1: Write the failing test**

`tests/unit/previewKind.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifyPreviewKind } from '@/lib/documents/preview'

describe('classifyPreviewKind', () => {
  it('classifies application/pdf as pdf', () => {
    expect(classifyPreviewKind('application/pdf')).toBe('pdf')
  })

  it('classifies any image/* mime type as image', () => {
    expect(classifyPreviewKind('image/png')).toBe('image')
    expect(classifyPreviewKind('image/jpeg')).toBe('image')
  })

  it('classifies other known mime types as unsupported', () => {
    expect(classifyPreviewKind('application/msword')).toBe('unsupported')
  })

  it('classifies a null mime type as unsupported', () => {
    expect(classifyPreviewKind(null)).toBe('unsupported')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- previewKind`
Expected: FAIL — `Cannot find module '@/lib/documents/preview'`

- [ ] **Step 3: Implement**

`src/lib/documents/preview.ts`:
```ts
export type PreviewKind = 'pdf' | 'image' | 'unsupported'

export function classifyPreviewKind(mimeType: string | null): PreviewKind {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType?.startsWith('image/')) return 'image'
  return 'unsupported'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- previewKind`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/preview.ts tests/unit/previewKind.test.ts
git commit -m "feat: document preview-kind classifier"
```

---

### Task 3: Server actions — upload, delete, signed URL

**Files:**
- Modify: `src/app/(dashboard)/cases/actions.ts:84-102` (replace the existing `uploadDocument` function with the version below; add the two new functions after it)

**Interfaces:**
- Consumes: `document` table's new `category`/`mime_type`/`size_bytes`/nullable `label` columns (Task 1).
- Produces: `uploadDocument(caseId: string, chamberId: string, file: File, category: string, label?: string): Promise<{error?: string} | {success: true}>`, `deleteDocument(documentId: string): Promise<{error?: string} | {success: true}>`, `getDocumentSignedUrl(documentId: string): Promise<{error?: string} | {url: string}>` — consumed by Task 4 (`DocumentUploadZone`), Task 5 (`DocumentList`), Task 6 (`DocumentPreview`).

- [ ] **Step 1: Replace `uploadDocument` and add the two new actions**

In `src/app/(dashboard)/cases/actions.ts`, replace lines 84-102 (the existing `uploadDocument` function) with:

```ts
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export async function uploadDocument(
  caseId: string,
  chamberId: string,
  file: File,
  category: string = 'other',
  label?: string
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Not authenticated' }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `${file.name} is larger than 20MB` }
  }

  const path = `${chamberId}/${caseId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('case-documents').upload(path, file)
  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase.from('document').insert({
    case_id: caseId,
    chamber_id: chamberId,
    storage_ref: path,
    label: label?.trim() || null,
    category,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: userData.user.id,
  })
  if (dbError) return { error: dbError.message }
  return { success: true }
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient()
  const { data: doc } = await supabase.from('document').select('storage_ref').eq('id', documentId).single()
  if (!doc) return { error: 'Document not found' }

  const { error: storageError } = await supabase.storage.from('case-documents').remove([doc.storage_ref])
  if (storageError) return { error: storageError.message }

  const { error: dbError } = await supabase.from('document').delete().eq('id', documentId)
  if (dbError) return { error: dbError.message }
  return { success: true }
}

export async function getDocumentSignedUrl(documentId: string) {
  const supabase = await createClient()
  const { data: doc } = await supabase.from('document').select('storage_ref').eq('id', documentId).single()
  if (!doc) return { error: 'Document not found' }

  const { data, error } = await supabase.storage.from('case-documents').createSignedUrl(doc.storage_ref, 60)
  if (error || !data) return { error: error?.message ?? 'Could not create signed URL' }
  return { url: data.signedUrl }
}
```

Note: `deleteDocument` and `getDocumentSignedUrl` deliberately query `document` without an explicit `chamber_id` filter — the existing RLS policy on `document` (from `0007_rls_policies.sql`) already restricts `select` to the caller's own chamber, so a document ID from another chamber simply returns no row (`!doc` branch), not a cross-tenant read.

`category` defaults to `'other'` specifically so that `DocumentUpload.tsx`'s existing 3-argument call (`uploadDocument(caseId, chamberId, file)`) still type-checks until Task 7 replaces that component — this keeps the build green at every task boundary instead of only at the end of the plan.

- [ ] **Step 2: Run the existing test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 3: Run a build to confirm the new signature type-checks**

Run: `npx next build`
Expected: succeeds, including `DocumentUpload.tsx`'s old 3-argument call site (valid because `category` now defaults).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/cases/actions.ts"
git commit -m "feat: document upload categories, delete, and signed URL actions"
```

---

### Task 4: Multi-file drag-and-drop upload component

**Files:**
- Create: `src/components/DocumentUploadZone.tsx`

**Interfaces:**
- Consumes: `uploadDocument` from `@/app/(dashboard)/cases/actions` (Task 3), `SelectField` from `@/components/ui/Field`.
- Produces: `DocumentUploadZone({ caseId, chamberId }: { caseId: string; chamberId: string })` — consumed by Task 7's `DocumentManager`.

- [ ] **Step 1: Implement**

`src/components/DocumentUploadZone.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadDocument } from '@/app/(dashboard)/cases/actions'
import { SelectField } from '@/components/ui/Field'

type FileStatus = { name: string; status: 'queued' | 'uploading' | 'done' | 'error'; error?: string }

const MAX_BYTES = 20 * 1024 * 1024
const CATEGORIES = ['petition', 'affidavit', 'order', 'evidence', 'correspondence', 'other'] as const

export function DocumentUploadZone({ caseId, chamberId }: { caseId: string; chamberId: string }) {
  const router = useRouter()
  const [category, setCategory] = useState<string>('other')
  const [files, setFiles] = useState<FileStatus[]>([])
  const [dragOver, setDragOver] = useState(false)

  async function uploadFiles(fileList: FileList) {
    const incoming = Array.from(fileList)
    setFiles(incoming.map((f) => ({ name: f.name, status: 'queued' as const })))

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i]
      if (file.size > MAX_BYTES) {
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: 'Larger than 20MB' } : f))
        )
        continue
      }
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f)))
      const result = await uploadDocument(caseId, chamberId, file, category)
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: result.error ? 'error' : 'done', error: result.error } : f
        )
      )
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <SelectField label="Category for this batch" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </option>
        ))}
      </SelectField>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
        }}
        className={`block border border-dashed p-6 text-center text-sm cursor-pointer transition-colors ${
          dragOver ? 'border-seal text-seal' : 'border-rule text-ink-soft'
        }`}
      >
        Drop files here, or click to browse
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files)
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="text-sm space-y-1">
          {files.map((f, idx) => (
            <li key={idx} className="flex justify-between gap-4">
              <span>{f.name}</span>
              <span
                className={
                  f.status === 'error' ? 'text-seal' : f.status === 'done' ? 'text-court-green' : 'text-ink-soft'
                }
              >
                {f.status === 'error' ? f.error : f.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run a build to confirm it type-checks**

Run: `npx next build`
Expected: succeeds (this component isn't imported anywhere yet, so it can't break an existing page, but it must compile standalone).

- [ ] **Step 3: Commit**

```bash
git add src/components/DocumentUploadZone.tsx
git commit -m "feat: drag-and-drop multi-file document upload component"
```

---

### Task 5: Categorized document list with delete

**Files:**
- Create: `src/components/DocumentList.tsx`

**Interfaces:**
- Consumes: `deleteDocument` from `@/app/(dashboard)/cases/actions` (Task 3), `Tag` from `@/components/ui/Tag`.
- Produces: `DocumentRow` type (`{ id: string; label: string | null; storage_ref: string; category: string; mime_type: string | null; size_bytes: number | null; created_at: string }`), `DocumentList({ documents, selectedId, onSelect }: { documents: DocumentRow[]; selectedId: string | null; onSelect: (id: string) => void })` — both consumed by Task 6 (`DocumentRow` type) and Task 7's `DocumentManager`.

- [ ] **Step 1: Implement**

`src/components/DocumentList.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteDocument } from '@/app/(dashboard)/cases/actions'

export type DocumentRow = {
  id: string
  label: string | null
  storage_ref: string
  category: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

const CATEGORY_ORDER = ['petition', 'affidavit', 'order', 'evidence', 'correspondence', 'other']

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function filenameFromPath(path: string): string {
  const segments = path.split('/')
  const last = segments[segments.length - 1]
  return last.replace(/^\d+-/, '')
}

export function DocumentList({
  documents,
  selectedId,
  onSelect,
}: {
  documents: DocumentRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setDeletingId(id)
    setError(null)
    const result = await deleteDocument(id)
    setDeletingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  if (documents.length === 0) {
    return <p className="text-sm text-ink-soft">No documents filed yet.</p>
  }

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    rows: documents.filter((d) => d.category === category),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-seal">{error}</p>}
      {groups.map((group) => (
        <div key={group.category}>
          <h3 className="text-xs font-mono uppercase tracking-widest text-ink-soft mb-2">{group.category}</h3>
          <ul className="divide-y divide-rule border-t border-rule">
            {group.rows.map((d) => (
              <li key={d.id} className="py-2 flex items-baseline justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelect(d.id)}
                  className={`text-left text-sm hover:text-seal transition-colors ${
                    selectedId === d.id ? 'text-seal' : ''
                  }`}
                >
                  {d.label || filenameFromPath(d.storage_ref)}
                </button>
                <div className="flex items-baseline gap-3 whitespace-nowrap">
                  <span className="text-xs font-mono text-ink-soft">{formatSize(d.size_bytes)}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingId === d.id}
                    className="text-xs font-mono uppercase tracking-wide text-seal hover:underline disabled:opacity-50"
                  >
                    {deletingId === d.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run a build to confirm it type-checks**

Run: `npx next build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/DocumentList.tsx
git commit -m "feat: categorized document list with delete"
```

---

### Task 6: On-demand document preview

**Files:**
- Create: `src/components/DocumentPreview.tsx`

**Interfaces:**
- Consumes: `getDocumentSignedUrl` from `@/app/(dashboard)/cases/actions` (Task 3), `classifyPreviewKind` from `@/lib/documents/preview` (Task 2), `DocumentRow` type from `@/components/DocumentList` (Task 5).
- Produces: `DocumentPreview({ document }: { document: DocumentRow | null })` — consumed by Task 7's `DocumentManager`.

- [ ] **Step 1: Implement**

`src/components/DocumentPreview.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { getDocumentSignedUrl } from '@/app/(dashboard)/cases/actions'
import { classifyPreviewKind } from '@/lib/documents/preview'
import type { DocumentRow } from '@/components/DocumentList'

export function DocumentPreview({ document }: { document: DocumentRow | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUrl(null)
    setError(null)
    if (!document) return
    setLoading(true)
    getDocumentSignedUrl(document.id).then((result) => {
      setLoading(false)
      if (result.error || !result.url) {
        setError(result.error ?? 'Could not load this document')
        return
      }
      setUrl(result.url)
    })
  }, [document])

  if (!document) {
    return <p className="text-sm text-ink-soft">Select a document to preview it.</p>
  }

  if (loading) {
    return <p className="text-sm text-ink-soft">Loading preview…</p>
  }

  if (error || !url) {
    return <p className="text-sm text-seal">{error ?? 'This document could not be loaded.'}</p>
  }

  const kind = classifyPreviewKind(document.mime_type)

  if (kind === 'pdf') {
    return (
      <iframe
        src={url}
        title={document.label ?? 'Document preview'}
        className="w-full h-[32rem] border border-rule"
      />
    )
  }

  if (kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={document.label ?? 'Document preview'} className="max-w-full border border-rule" />
    )
  }

  return (
    <p className="text-sm">
      Preview not available for this file type.{' '}
      <a href={url} target="_blank" rel="noreferrer" className="text-seal underline-offset-4 hover:underline">
        Download instead
      </a>
    </p>
  )
}
```

- [ ] **Step 2: Run a build to confirm it type-checks**

Run: `npx next build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/DocumentPreview.tsx
git commit -m "feat: on-demand document preview pane"
```

---

### Task 7: Wire it together — DocumentManager, case detail page, cleanup, verification

**Files:**
- Create: `src/components/DocumentManager.tsx`
- Modify: `src/app/(dashboard)/cases/[id]/page.tsx` (the document query and the Documents `<section>`)
- Delete: `src/components/DocumentUpload.tsx` (superseded by `DocumentManager`/`DocumentUploadZone`)

**Interfaces:**
- Consumes: `DocumentList`/`DocumentRow` (Task 5), `DocumentPreview` (Task 6), `DocumentUploadZone` (Task 4).
- Produces: `DocumentManager({ caseId, chamberId, documents }: { caseId: string; chamberId: string; documents: DocumentRow[] })` — the case detail page's sole entry point into document management.

- [ ] **Step 1: Create the container component**

`src/components/DocumentManager.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { DocumentList, type DocumentRow } from '@/components/DocumentList'
import { DocumentPreview } from '@/components/DocumentPreview'
import { DocumentUploadZone } from '@/components/DocumentUploadZone'

export function DocumentManager({
  caseId,
  chamberId,
  documents,
}: {
  caseId: string
  chamberId: string
  documents: DocumentRow[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = documents.find((d) => d.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-8">
        <DocumentList documents={documents} selectedId={selectedId} onSelect={setSelectedId} />
        <DocumentPreview document={selected} />
      </div>
      <DocumentUploadZone caseId={caseId} chamberId={chamberId} />
    </div>
  )
}
```

- [ ] **Step 2: Delete the superseded upload-only component**

```bash
git rm src/components/DocumentUpload.tsx
```

- [ ] **Step 3: Update the case detail page's document query and section**

In `src/app/(dashboard)/cases/[id]/page.tsx`:

Replace the import line:
```ts
import { DocumentUpload } from '@/components/DocumentUpload'
```
with:
```ts
import { DocumentManager } from '@/components/DocumentManager'
```

Replace the document `select` in the `Promise.all` call:
```ts
supabase.from('document').select('id, label, storage_ref').eq('case_id', id),
```
with:
```ts
supabase.from('document').select('id, label, storage_ref, category, mime_type, size_bytes, created_at').eq('case_id', id),
```

Replace the entire Documents `<section>`:
```tsx
<section>
  <h2 className="font-display text-xl mb-3">Documents</h2>
  {(documents ?? []).length > 0 && (
    <ul className="divide-y divide-rule border-t border-rule mb-3">
      {(documents ?? []).map((d) => (
        <li key={d.id} className="py-2 text-sm">
          {d.label}
        </li>
      ))}
    </ul>
  )}
  <DocumentUpload caseId={id} chamberId={caseRow.chamber_id} />
</section>
```
with:
```tsx
<section>
  <h2 className="font-display text-xl mb-3">Documents</h2>
  <DocumentManager caseId={id} chamberId={caseRow.chamber_id} documents={documents ?? []} />
</section>
```

- [ ] **Step 4: Run the full build**

Run: `npx next build`
Expected: exits 0, no type errors. (This is where the old `DocumentUpload.tsx`'s outdated 3-argument `uploadDocument` call would have failed to type-check — confirm it's gone and the new wiring compiles clean.)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `previewKind` tests from Task 2.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, log in (`dev-test@lawyersoftware.local` / `TestPassword123!`), open any existing case detail page.
1. Drop or browse-select 2-3 files (mix a PDF and an image if you have them handy; any small files work) with a chosen category, confirm each shows `queued` → `uploading` → `done` in the status list, and confirm they appear grouped under the right category heading after the page refreshes.
2. Click a PDF or image document in the list — confirm it loads in the preview pane (PDF via the embedded viewer, image via `<img>`). Click a different document — confirm the preview updates.
3. Click Delete on a document, confirm the browser confirmation prompt, confirm it disappears from the list after confirming, and confirm the underlying Storage object is gone too (check via `mcp__supabase__execute_sql`: `select count(*) from storage.objects where name = '<storage_ref of the deleted doc>'` — expect `0`).
4. Try dropping a file larger than 20MB if you have one handy (or temporarily lower `MAX_BYTES` locally to test the rejection path with a small file, then revert) — confirm it shows an inline error and does not upload.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/cases/[id]/page.tsx" src/components/DocumentManager.tsx
git commit -m "feat: wire categorized document management into the case detail page"
```

Do NOT include any "Co-Authored-By" or "Claude" text in any commit message in this plan.

---
