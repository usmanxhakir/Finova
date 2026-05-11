import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    console.log('token_hash:', token_hash)
    console.log('type:', type)
    console.log('error:', error)
    console.log('user:', data?.user?.id)


    if (!error && data.user) {
      const user = data.user
      const company_id = user.user_metadata?.company_id
      const role = user.user_metadata?.role ?? 'viewer'

      if (company_id) {
        // Create the profile for the invited user
        await (supabase.from('profiles') as any).upsert({
          id: user.id,
          company_id,
          role,
          full_name: user.user_metadata?.full_name ?? '',
          is_active: true,
        })

        // Mark invitation as accepted
        await (supabase.from('invitations') as any)
          .update({ status: 'accepted' })
          .eq('email', user.email!)
          .eq('company_id', company_id)

        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // company_id missing — treat as error
      return NextResponse.redirect(new URL('/login?reason=invite_error', request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?reason=invite_error', request.url))
}
