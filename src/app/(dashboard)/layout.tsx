import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return (
    <div>
      <nav className="border-b p-4 flex gap-4">
        <Link href="/" className="font-semibold">Dashboard</Link>
        <Link href="/cases">Cases</Link>
        <Link href="/clients">Clients</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
