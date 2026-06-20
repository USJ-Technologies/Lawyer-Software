'use client'
import { useRouter } from 'next/navigation'
import { addHearing } from '@/app/(dashboard)/cases/actions'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

export function HearingForm({ caseId }: { caseId: string }) {
  const router = useRouter()
  async function handleSubmit(formData: FormData) {
    const result = await addHearing(caseId, formData)
    if (!result.error) router.refresh()
  }
  return (
    <form action={handleSubmit} className="flex gap-4 items-end pt-2">
      <Field label="Date" name="date" type="date" required className="w-40" />
      <Field label="Purpose" name="purpose" className="flex-1" />
      <Button type="submit" variant="ghost">
        + Add hearing
      </Button>
    </form>
  )
}
