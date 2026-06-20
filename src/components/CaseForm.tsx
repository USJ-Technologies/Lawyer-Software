import { Field, SelectField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

type Option = { id: string; label: string }

export function CaseForm({
  action, clients, caseTypes, courts,
}: {
  action: (formData: FormData) => void
  clients: Option[]
  caseTypes: Option[]
  courts: Option[]
}) {
  return (
    <div className="max-w-md">
      <PageHeader eyebrow="New filing" title="New case" />
      <form action={action} className="space-y-6">
        <Field label="Case title" name="title" required />
        <SelectField label="Client" name="client_id" required defaultValue="">
          <option value="" disabled>
            Select client
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Case type" name="case_type_id" required defaultValue="">
          <option value="" disabled>
            Select case type
          </option>
          {caseTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Court" name="court_id" required defaultValue="">
          <option value="" disabled>
            Select court
          </option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <Field label="Case number (optional)" name="case_number" />
        <Field label="CNR — 16 characters (optional)" name="cnr" maxLength={16} className="font-mono" />
        <Button type="submit">Save</Button>
      </form>
    </div>
  )
}
