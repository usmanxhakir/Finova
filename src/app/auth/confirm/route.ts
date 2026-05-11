import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // At this point Supabase has already verified the token.
    // The user session is established via cookies.
    // We just need to read the session and set up their profile.
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      console.error('Auth confirm - no user:', error)
      return NextResponse.redirect(new URL('/login?reason=invite_error', request.url))
    }

    const company_id = user.user_metadata?.company_id
    const role = user.user_metadata?.role ?? 'viewer'

    if (!company_id) {
      console.error('Auth confirm - no company_id in metadata:', user.user_metadata)
      return NextResponse.redirect(new URL('/login?reason=invite_error', request.url))
    }

    // Upsert profile
    const { error: profileError } = await (supabase.from('profiles') as any).upsert({
      id: user.id,
      company_id,
      role,
      full_name: user.user_metadata?.full_name ?? '',
      is_active: true,
    })

    if (profileError) {
      console.error('Auth confirm - profile upsert error:', profileError)
      return NextResponse.redirect(new URL('/login?reason=invite_error', request.url))
    }

    // Mark invitation accepted
    await (supabase.from('invitations') as any)
      .update({ status: 'accepted' })
      .eq('email', user.email!)
      .eq('company_id', company_id)

    return NextResponse.redirect(new URL('/dashboard', request.url))

  } catch (err) {
    console.error('Auth confirm - unexpected error:', err)
    return NextResponse.redirect(new URL('/login?reason=invite_error', request.url))
  }
}
