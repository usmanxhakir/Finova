/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyId = await getCompanyId(supabase, user.id)
    
    // Fetch PO
    const { data: purchaseOrder, error: poError } = await (supabase.from('purchase_orders') as any)
      .select('id, status, current_step_order')
      .eq('id', id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (poError) throw new Error(poError.message)
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    if (purchaseOrder.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Purchase order is not pending approval' }, { status: 400 })
    }

    // Fetch current pending approval record
    const { data: record, error: recordError } = await (supabase.from('po_approval_records') as any)
      .select('*')
      .eq('po_id', id)
      .eq('step_order', purchaseOrder.current_step_order)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()

    if (recordError) throw new Error(recordError.message)
    if (!record) {
      return NextResponse.json({ error: 'No pending approval record found for the current step' }, { status: 404 })
    }

    // Verify logged in user is the designated approver
    if (record.approver_user_id !== user.id) {
      return NextResponse.json({ error: 'You are not the designated approver for this step' }, { status: 403 })
    }

    // Update approval record
    const { error: updateRecordError } = await (supabase.from('po_approval_records') as any)
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
      })
      .eq('id', record.id)

    if (updateRecordError) throw new Error(updateRecordError.message)

    // Check for the next pending step.
    const { data: nextRecord, error: nextRecordError } = await (supabase.from('po_approval_records') as any)
      .select('step_order')
      .eq('po_id', id)
      .eq('status', 'pending')
      .order('step_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (nextRecordError) throw new Error(nextRecordError.message)

    let newStatus = 'pending_approval'
    let updatePoData: any = {}

    if (!nextRecord) {
      newStatus = 'approved'
      updatePoData = { status: 'approved' }
    } else {
      updatePoData = { current_step_order: nextRecord.step_order }
    }

    const { error: updatePoError } = await (supabase.from('purchase_orders') as any)
      .update(updatePoData)
      .eq('id', id)

    if (updatePoError) throw new Error(updatePoError.message)

    if (nextRecord) {
      try {
        await sendExternalApprovalEmailForCurrentStep(id)
      } catch (emailError) {
        console.error('[API PO Approve] email send failed:', emailError)
      }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error: any) {
    console.error('[API PO Approve] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
