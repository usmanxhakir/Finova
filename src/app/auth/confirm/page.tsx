'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        const company_id = user.user_metadata?.company_id
        const role = user.user_metadata?.role ?? 'viewer'

        if (!company_id) {
          router.push('/login?reason=invite_error')
          return
        }

        await (supabase.from('profiles') as any).upsert({
          id: user.id,
          company_id,
          role,
          full_name: user.user_metadata?.full_name ?? '',
          is_active: true,
        })

        await (supabase.from('invitations') as any)
          .update({ status: 'accepted' })
          .eq('email', user.email!)
          .eq('company_id', company_id)

        router.push('/dashboard')
      } else if (event === 'TOKEN_REFRESHED') {
        router.push('/dashboard')
      }
    })
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
