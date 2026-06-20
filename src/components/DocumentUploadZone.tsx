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
