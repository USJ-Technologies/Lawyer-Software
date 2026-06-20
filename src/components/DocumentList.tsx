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
