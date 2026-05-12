import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType
  const redirectTo = searchParams.get('redirect_to') ?? '/dashboard'

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL('/login?reason=invite_error', request.url)
    )
  }

  const supabase = await createClient()

  // Verify the token server-side — sets session cookie
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  })

  if (verifyError) {
    console.error('verifyOtp error:', verifyError)
    return NextResponse.redirect(
      new URL('/login?reason=invite_error', request.url)
    )
  }

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user || userError) {
    console.error('getUser error:', userError)
    return NextResponse.redirect(
      new URL('/login?reason=invite_error', request.url)
    )
  }

  const company_id = user.user_metadata?.company_id
  const role = user.user_metadata?.role ?? 'viewer'

  if (!company_id) {
    console.error('No company_id in metadata:', user.user_metadata)
    return NextResponse.redirect(
      new URL('/login?reason=invite_error', request.url)
    )
  }

  // Use admin client for upsert to bypass RLS
  // (profile row doesn't exist yet so RLS can't verify company membership)
  const adminClient = createAdminClient()

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: user.id,
      company_id,
      role,
      full_name: user.user_metadata?.full_name ?? '',
      is_active: true,
    })

  if (profileError) {
    console.error('Profile upsert error:', profileError)
    return NextResponse.redirect(
      new URL('/login?reason=invite_error', request.url)
    )
  }

  // Mark invitation accepted
  await adminClient
    .from('invitations')
    .update({ status: 'accepted' })
    .eq('email', user.email!)
    .eq('company_id', company_id)

  return NextResponse.redirect(new URL(redirectTo, request.url))
}
