'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Stamp } from '@/components/ui/Stamp'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [chamberName, setChamberName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Signup failed')
      setLoading(false)
      return
    }
    const { data: result, error: rpcError } = await supabase
      .rpc('create_chamber_and_profile', { p_chamber_name: chamberName })
      .single()
    if (rpcError || !result) {
      setError(rpcError?.message ?? 'Could not create chamber')
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
          <p className="text-xs font-mono uppercase tracking-widest text-seal mb-1">New filing</p>
          <h1 className="font-display text-3xl mb-8">Register your chamber</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Field
              label="Chamber / firm name"
              value={chamberName}
              onChange={(e) => setChamberName(e.target.value)}
              required
            />
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
              minLength={6}
              autoComplete="new-password"
            />

            {error && (
              <p role="alert" className="text-sm text-seal">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Registering…' : 'Register chamber'}
            </Button>
          </form>

          <p className="mt-8 text-sm text-ink-soft">
            Already have a chamber?{' '}
            <a href="/login" className="text-seal underline-offset-4 hover:underline">
              Log in
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
