import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CasesPage() {
  const supabase = await createClient()
  const { data: cases } = await supabase
    .from('case')
    .select('id, title, case_number, stage, status, client:client_id(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Cases</h1>
        <Link href="/cases/new" className="bg-black text-white px-3 py-1.5 rounded">+ Case</Link>
      </div>
      <ul className="divide-y">
        {(cases ?? []).map((c: any) => (
          <li key={c.id} className="py-2">
            <Link href={`/cases/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
            <p className="text-sm text-gray-500">{c.client?.name} · {c.stage} · {c.status}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
