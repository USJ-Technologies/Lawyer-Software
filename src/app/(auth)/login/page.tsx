'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Stamp } from '@/components/ui/Stamp'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs font-mono uppercase tracking-widest text-ink-soft mb-10">
          Smart Vakeel — Case Register
        </p>

        <div className="relative border-l-2 border-seal pl-6">
          <p className="text-xs font-mono uppercase tracking-widest text-seal mb-1">Entry</p>
          <h1 className="font-display text-3xl mb-8">Log in to your chamber</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <p role="alert" className="text-sm text-seal">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Logging in…' : 'Log in'}
            </Button>
          </form>

          <p className="mt-8 text-sm text-ink-soft">
            New chamber?{' '}
            <a href="/signup" className="text-seal underline-offset-4 hover:underline">
              Register it
            </a>
          </p>
        </div>

        <div className="flex justify-end mt-10">
          <Stamp tone="brass">Filed · Phase 1</Stamp>
        </div>
      </div>
    </div>
  )
}
