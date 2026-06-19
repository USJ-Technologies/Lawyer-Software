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
