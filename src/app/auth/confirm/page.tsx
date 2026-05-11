'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let handled = false
    let timeout: NodeJS.Timeout

    async function setupProfile(userId: string, email: string, metadata: any) {
      if (handled) return
      handled = true
      clearTimeout(timeout)

      const company_id = metadata?.company_id
      const role = metadata?.role ?? 'viewer'

      if (!company_id) {
        console.error('No company_id in metadata:', metadata)
        router.push('/login?reason=invite_error')
        return
      }

      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .upsert({
          id: userId,
          company_id,
          role,
          full_name: metadata?.full_name ?? '',
          is_active: true,
        })

      if (profileError) {
        console.error('Profile upsert failed:', profileError)
        router.push('/login?reason=invite_error')
        return
      }

      await (supabase.from('invitations') as any)
        .update({ status: 'accepted' })
        .eq('email', email)
        .eq('company_id', company_id)

      router.push('/dashboard')
    }

    // Approach 1: check if session already exists right now
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setupProfile(
          session.user.id,
          session.user.email!,
          session.user.user_metadata
        )
      }
    })

    // Approach 2: wait for auth state change (fires when hash is processed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
          session?.user
        ) {
          setupProfile(
            session.user.id,
            session.user.email!,
            session.user.user_metadata
          )
        }
      }
    )

    // Approach 3: timeout fallback after 15 seconds
    timeout = setTimeout(() => {
      if (!handled) {
        console.error('Auth confirm timed out')
        router.push('/login?reason=invite_error')
      }
    }, 15000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Setting up your account...</p>
      </div>
    </div>
  )
}