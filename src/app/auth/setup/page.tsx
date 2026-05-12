'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    // Update password and full name on auth user
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName }
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Update full_name on profiles table
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await (supabase.from('profiles') as any)
        .update({ full_name: fullName })
        .eq('id', user.id)
    }

    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-zinc-200">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600">
            <span className="text-xl font-bold text-white">F</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Welcome to Fyntrax</h1>
          <p className="mt-2 text-sm text-zinc-500">Set up your account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={loading}
          >
            {loading ? 'Setting up...' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  )
}
