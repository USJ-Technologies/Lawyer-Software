import { createClientRecord } from '../actions'
import { Field, TextField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

export default function NewClientPage() {
  return (
    <div className="max-w-md">
      <PageHeader eyebrow="New entry" title="New client" />
      <form
        action={async (formData: FormData) => {
          'use server'
          await createClientRecord(formData)
        }}
        className="space-y-6"
      >
        <Field label="Full name" name="name" required />
        <Field label="Phone" name="phone" />
        <Field label="Email" name="email" type="email" />
        <TextField label="Address" name="address" rows={3} />
        <Button type="submit">Save</Button>
      </form>
    </div>
  )
}
