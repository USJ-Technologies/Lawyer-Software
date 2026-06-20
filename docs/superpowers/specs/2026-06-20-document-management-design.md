# Document Management — Design Spec

Date: 2026-06-20
Status: Approved for implementation planning

## Context

Phase 1 shipped a minimal document feature: a `document` table with `storage_ref`/`label`/`uploaded_by`, a private Supabase Storage bucket (`case-documents`) with a chamber-scoped RLS policy, and a single-file `<input type="file">` on the case detail page. There is no way to view, categorize, or delete an uploaded document — only upload and see a filename in a flat list.

This is the first of four planned Phase 2 subsystems (Document Management → Case workflow/stages → AI Lawyer → Calendar/cause-list), ordered by data dependency: the AI Lawyer subsystem will need well-organized, viewable documents and case-lifecycle context to analyze, so those two come first.

## Goals

1. Categorize documents (fixed category + optional freeform label).
2. View documents in-app (PDF/image preview) without leaving the case detail page.
3. Multi-file, drag-and-drop upload with per-file progress/error feedback.
4. Delete a wrongly-uploaded document (no replace/versioning — re-upload as a new entry).

## Explicit non-goals (deferred to later subsystems)

- AI-powered OCR/text extraction or document analysis — deferred to the **AI Lawyer** subsystem. Document Management produces well-categorized, viewable raw documents; it does not read their content.
- Cross-case document search/library — deferred to a future **search & filters** subsystem. This spec only covers the per-case Documents section.
- Document versioning/replace-in-place — explicitly out of scope per user decision; delete-and-re-upload is the only correction path.

## Schema changes

New migration extending the existing `document` table (from `0005_document_note.sql`):

```sql
alter table document
  add column category text not null default 'other'
    check (category in ('petition', 'affidavit', 'order', 'evidence', 'correspondence', 'other')),
  add column mime_type text,
  add column size_bytes bigint;

alter table document alter column label drop not null;
```

- `category` — required, fixed set matching common Indian litigation filing types. Defaults existing rows to `'other'` (backward-compatible with Task 10's leftover test data).
- `label` — already exists; becomes optional. Carries the freeform specifics (e.g. "Stay order dated 12-06-2026").
- `mime_type`, `size_bytes` — captured from the browser `File` object at upload time. Used to pick a preview renderer and to display file size in the list. Nullable because they can't be backfilled for documents already in Storage without re-reading every object; new uploads always set them.

No changes to the storage bucket or its RLS policy (`supabase/migrations/0009_case_documents_storage.sql`) — chamber isolation is already enforced there and nothing about categorization or preview changes who can read/write what.

## Server actions

All added to `src/app/(dashboard)/cases/actions.ts`, following the existing pattern (auth check via `createClient()`, chamber_id sourced server-side, never trusted from client input):

- **`uploadDocument(caseId, chamberId, file, category, label?)`** — modified from the existing signature. Captures `file.type` → `mime_type` and `file.size` → `size_bytes` alongside the existing upload-then-insert flow. Rejects (returns `{error}`) files over 20MB before attempting the Storage upload.
- **`deleteDocument(documentId)`** — new. Looks up the document's `storage_ref` via a query scoped to the caller's own chamber (RLS-gated `select`), removes the Storage object (`supabase.storage.from('case-documents').remove([path])`), then deletes the `document` row. If the row lookup returns nothing (wrong chamber or already deleted), returns `{error: 'Document not found'}` rather than attempting any deletion.
- **`getDocumentSignedUrl(documentId)`** — new. Looks up `storage_ref` (chamber-scoped, same as above), calls `supabase.storage.from('case-documents').createSignedUrl(path, 60)` (60-second expiry — long enough to load a preview, short enough to not be a durable shareable link), returns `{url}` or `{error}`.

## UI components

Replaces the current `DocumentUpload` component and the flat list in `cases/[id]/page.tsx`'s Documents section with:

- **`DocumentList`** (`src/components/DocumentList.tsx`) — client component. Groups documents by `category` (fixed order: Petition, Affidavit, Order, Evidence, Correspondence, Other — only non-empty groups render, consistent with `HearingBucketList`'s existing empty-section-hides pattern). Each row: label or filename, category `Tag`, formatted size, upload date, a "Preview" action (sets the selected document, triggering `DocumentPreview`) and a "Delete" action (confirms, then calls `deleteDocument` + `router.refresh()`).
- **`DocumentPreview`** (`src/components/DocumentPreview.tsx`) — client component. Given a selected document, calls `getDocumentSignedUrl` on mount/selection-change, then renders: an `<iframe>` for `mime_type === 'application/pdf'`, an `<img>` for `mime_type.startsWith('image/')`, or a "Preview not available — download" link (still via the same signed URL) for anything else. Shows a loading state while the signed URL is being fetched, and a clear error state if the fetch fails.
- **`DocumentUploadZone`** (`src/components/DocumentUploadZone.tsx`) — client component. A drop target (`onDragOver`/`onDrop`) plus a hidden `<input type="file" multiple>` for click-to-browse, a category `<select>` applied to the whole batch, and a per-file status list (queued → uploading → done/error) rendered while uploads are in flight. Files upload sequentially via repeated `uploadDocument` calls — sequential rather than parallel, so error reporting stays simple (each file's status updates independently and a failure on file 2 doesn't affect the already-succeeded file 1).
- **`DocumentManager`** (`src/components/DocumentManager.tsx`) — the container the case detail page actually renders. Holds the "currently selected document" state and lays out `DocumentList` + `DocumentPreview` side by side (stacked on narrow viewports), with `DocumentUploadZone` beneath the list.

## Pure logic (TDD)

`src/lib/documents/preview.ts`:

```ts
export type PreviewKind = 'pdf' | 'image' | 'unsupported'

export function classifyPreviewKind(mimeType: string | null): PreviewKind {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType?.startsWith('image/')) return 'image'
  return 'unsupported'
}
```

Tested in `tests/unit/previewKind.test.ts` (PDF, image, unsupported/null cases) — same TDD pattern as `classifyHearing`/`isDue` from Phase 1.

## Data flow (end to end)

1. User drags files onto `DocumentUploadZone` (or browses), picks one category for the batch.
2. Each file uploads sequentially via `uploadDocument(caseId, chamberId, file, category, label)`; each insert triggers `router.refresh()` so `DocumentList` picks up the new row.
3. User clicks a row in `DocumentList` → `DocumentManager` sets it as selected → `DocumentPreview` calls `getDocumentSignedUrl` and renders based on `classifyPreviewKind(doc.mime_type)`.
4. User clicks Delete on a row → confirms → `deleteDocument` removes the Storage object and DB row → `router.refresh()`.

## Error handling

- **Upload**: oversized files (>20MB) rejected client-side before any network call, with an inline message next to that file. Server-side `uploadDocument` errors (Storage failure, DB insert failure) surface per-file in the same status list; other files in the batch continue.
- **Preview**: a failed signed-URL fetch (e.g., the document was deleted by someone else in another tab) shows "This document could not be loaded" in the preview pane instead of a broken `<iframe>`/`<img>`.
- **Delete**: UI does not optimistically remove the row before the server action confirms success — a failed delete leaves the row in place with an inline error rather than silently desyncing the list from the database.

## Testing plan

- TDD unit test for `classifyPreviewKind` (3-4 cases: pdf, image, unsupported, null).
- Manual verification: upload multiple files across different categories in one batch, preview a PDF and an image, attempt deleting a document, confirm chamber isolation still holds (a signed URL generated for chamber A's document cannot be produced for a chamber B user, since `getDocumentSignedUrl`'s lookup query is itself RLS-scoped).
- `npx next build` + full `npm test` suite must stay green, per the established project convention.

## Open questions / explicitly deferred

- AI-based OCR/analysis of scanned documents — deferred to the AI Lawyer subsystem (next in the dependency order). No provider (Claude vs. Gemini) decision is needed for this subsystem.
- Cross-case document search — deferred to a future search/filters subsystem.
