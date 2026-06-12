/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyWorkflowToPO } from '@/lib/purchase-orders/apply-workflow'
import { sendExternalApprovalEmailForCurrentStep } from '@/lib/purchase-orders/approval-notifications'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error } = await (supabase.from('profiles') as any)
    .select('company_id')
    .eq('id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile?.company_id) throw new Error('Company not found for user')

  return profile.company_id as string
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    const result = await applyWorkflowToPO(supabase, id, companyId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to apply purchase order approval workflow' },
        { status: 400 }
      )
    }

    const { error: updateError } = await (supabase.from('purchase_orders') as any)
      .update({ status: 'pending_approval', submitted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)

    if (updateError) throw new Error(updateError.message)

    try {
      await sendExternalApprovalEmailForCurrentStep(id)
    } catch (emailError) {
      console.error('[PO Submit] email send failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API PO Submit] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
