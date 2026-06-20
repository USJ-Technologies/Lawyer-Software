import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase.from('client').select('id, name, phone, email').order('name')

  return (
    <div>
      <PageHeader
        eyebrow="Chamber roll"
        title="Clients"
        action={<ButtonLink href="/clients/new">+ Client</ButtonLink>}
      />
      {(clients ?? []).length === 0 ? (
        <p className="text-ink-soft border-t border-rule pt-6">No clients on file yet.</p>
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {(clients ?? []).map((c) => (
            <li key={c.id} className="py-3">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-ink-soft font-mono">
                {[c.phone, c.email].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
