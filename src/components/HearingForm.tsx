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
