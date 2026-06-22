/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite users' }, { status: 401 })
    }

    const companyId = await getCompanyId()
    const { email, role } = await request.json()

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (!['accountant', 'viewer', 'procurement'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if invitation exists
    const { data: existingInvite } = await (supabase
      .from('invitations') as any)
      .select('id')
      .eq('company_id', companyId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email.' }, { status: 400 })
    }

    // Check if user already in company
    // Note: We need to check if ANY profile exists with this email in THIS company
    // Profiles don't have email directly, we'd need to join with auth.users or check if we have a profile with that ID
    // But we don't know the ID yet. However, we can check if a user with this email exists in auth.users via admin client.
    const adminClient = createAdminClient()
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()
    
    if (listError) throw listError

    const existingUser = users.find(u => u.email === email)
    if (existingUser) {
      const { data: existingProfile } = await (supabase
        .from('profiles') as any)
        .select('company_id')
        .eq('id', existingUser.id)
        .single()
      
      if (existingProfile?.company_id === companyId) {
        return NextResponse.json({ error: 'This user is already a member of your company.' }, { status: 400 })
      }
    }

    // Invite user
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
      data: { company_id: companyId, role }
    })

    if (inviteError) throw inviteError

    // Record in invitations table
    const { data: newInvite, error: insertError } = await (supabase
      .from('invitations') as any)
      .insert({
        company_id: companyId,
        email,
        role,
        invited_by: user.id,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json(newInvite)
  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
