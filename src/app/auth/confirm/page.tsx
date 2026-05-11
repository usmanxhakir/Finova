'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function setupProfile() {
      // Directly get session — Supabase client automatically
      // reads the access_token from the URL hash fragment
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session?.user) {
        console.error('No session found:', error)
        router.push('/login?reason=invite_error')
        return
      }

      const user = session.user
      const company_id = user.user_metadata?.company_id
      const role = user.user_metadata?.role ?? 'viewer'

      if (!company_id) {
        console.error('No company_id in metadata:', user.user_metadata)
        router.push('/login?reason=invite_error')
        return
      }

      // Create profile
      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .upsert({
          id: user.id,
          company_id,
          role,
          full_name: user.user_metadata?.full_name ?? '',
          is_active: true,
        })

      if (profileError) {
        console.error('Profile upsert failed:', profileError)
        router.push('/login?reason=invite_error')
        return
      }

      // Mark invitation accepted
      await (supabase.from('invitations') as any)
        .update({ status: 'accepted' })
        .eq('email', user.email!)
        .eq('company_id', company_id)

      router.push('/dashboard')
    }

    setupProfile()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent"/>
        <p className="text-sm text-muted-foreground">Setting up your account...</p>
      </div>
    </div>
  )
}
