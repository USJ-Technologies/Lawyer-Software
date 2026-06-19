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
    <form action={action} className="p-6 max-w-md space-y-4">
      <h1 className="text-xl font-semibold">New case</h1>
      <input name="title" placeholder="Case title" className="w-full border p-2" required />
      <select name="client_id" className="w-full border p-2" required>
        <option value="">Select client</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select name="case_type_id" className="w-full border p-2" required>
        <option value="">Case type</option>
        {caseTypes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <select name="court_id" className="w-full border p-2" required>
        <option value="">Court</option>
        {courts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input name="case_number" placeholder="Case number (optional)" className="w-full border p-2" />
      <input name="cnr" placeholder="CNR — 16 characters (optional)" className="w-full border p-2" maxLength={16} />
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">Save</button>
    </form>
  )
}
