'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [chamberName, setChamberName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Signup failed')
      return
    }
    const { data: result, error: rpcError } = await supabase
      .rpc('create_chamber_and_profile', { p_chamber_name: chamberName })
      .single()
    if (rpcError || !result) {
      setError(rpcError?.message ?? 'Could not create chamber')
      return
    }
    router.push('/')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-16 space-y-4">
      <h1 className="text-xl font-semibold">Create your chamber</h1>
      <input className="w-full border p-2" placeholder="Chamber / firm name" value={chamberName} onChange={(e) => setChamberName(e.target.value)} required />
      <input className="w-full border p-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="w-full border p-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button className="w-full bg-black text-white p-2 rounded" type="submit">Sign up</button>
    </form>
  )
}
