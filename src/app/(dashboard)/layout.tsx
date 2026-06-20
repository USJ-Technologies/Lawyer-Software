import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-rule">
        <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-8">
          <Link href="/" className="font-display text-xl tracking-tight">
            Smart Vakeel
          </Link>
          <div className="flex gap-6 text-xs font-mono uppercase tracking-widest">
            <Link href="/" className="text-ink-soft hover:text-seal transition-colors">
              Register
            </Link>
            <Link href="/cases" className="text-ink-soft hover:text-seal transition-colors">
              Cases
            </Link>
            <Link href="/clients" className="text-ink-soft hover:text-seal transition-colors">
              Clients
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">{children}</main>
    </div>
  )
}
