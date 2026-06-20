import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return (
    <div className="min-h-screen flex md:flex-row flex-col">
      <Sidebar />
      <main className="flex-1 w-full px-6 py-10 max-w-5xl mx-auto">{children}</main>
    </div>
  )
}
