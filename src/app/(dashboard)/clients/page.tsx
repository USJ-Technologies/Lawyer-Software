import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase.from('client').select('id, name, phone, email').order('name')

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Link href="/clients/new" className="bg-black text-white px-3 py-1.5 rounded">+ Client</Link>
      </div>
      <ul className="divide-y">
        {(clients ?? []).map((c) => (
          <li key={c.id} className="py-2">
            <p className="font-medium">{c.name}</p>
            <p className="text-sm text-gray-500">{c.phone} {c.email}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
