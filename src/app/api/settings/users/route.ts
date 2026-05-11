import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = await getCompanyId()

    // Fetch profiles
    const { data: profiles, error: profileError } = await (supabase
      .from('profiles') as any)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (profileError) throw profileError

    // Fetch emails from auth.users via admin client
    const adminClient = createAdminClient()
    const { data: { users: authUsers }, error: authUserError } = await adminClient.auth.admin.listUsers()

    if (authUserError) throw authUserError

    // Merge email into profile data
    const usersWithEmail = (profiles as any[]).map((profile: any) => {
      const authUser = authUsers.find((u: any) => u.id === profile.id)
      return {
        ...profile,
        email: authUser?.email ?? 'N/A',
      }
    })

    return NextResponse.json(usersWithEmail)
  } catch (error: any) {
    console.error('Fetch users error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
