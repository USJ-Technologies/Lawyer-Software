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
  return (
    <label className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-seal cursor-pointer hover:underline">
      + Upload document
      <input type="file" onChange={handleChange} className="sr-only" />
    </label>
  )
}
