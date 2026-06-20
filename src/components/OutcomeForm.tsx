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
    <form action={handleSubmit} className="flex gap-3 mt-2 items-baseline">
      <input
        name="outcome"
        placeholder="Outcome"
        className="field-input text-sm flex-1"
      />
      <input
        name="next_action"
        placeholder="Next action"
        className="field-input text-sm flex-1"
      />
      <button type="submit" className="text-xs font-mono uppercase tracking-wide text-seal hover:underline">
        Save
      </button>
    </form>
  )
}
