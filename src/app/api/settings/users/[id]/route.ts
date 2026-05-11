import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: currentProfile } = await (supabase
      .from('profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can manage users' }, { status: 401 })
    }

    // Safety: cannot modify own account
    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot modify your own account' }, { status: 400 })
    }

    const companyId = await getCompanyId()
    const body = await request.json()

    // Only allow permitted fields
    const allowedFields: Record<string, any> = {}
    if (body.role !== undefined) {
      if (!['admin', 'accountant', 'viewer'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      allowedFields.role = body.role
    }
    if (body.is_active !== undefined) {
      allowedFields.is_active = Boolean(body.is_active)
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updatedProfile, error: updateError } = await (supabase
      .from('profiles') as any)
      .update(allowedFields)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updatedProfile)
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
