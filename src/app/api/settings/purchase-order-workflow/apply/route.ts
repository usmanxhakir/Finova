import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

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

const applySchema = z.object({
  po_id: z.string().uuid(),
})

function toBigInt(value: unknown) {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  if (typeof value === 'string') return BigInt(value)
  throw new Error('Invalid bigint value')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = applySchema.parse(body)

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = await getCompanyId(supabase, user.id)

    const { data: purchaseOrder, error: poError } = await (supabase.from('purchase_orders') as any)
      .select('id, company_id, total')
      .eq('id', validated.po_id)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (poError) throw new Error(poError.message)
    if (!purchaseOrder) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })

    const { data: existingApproval, error: existingError } = await (supabase.from('po_approval_records') as any)
      .select('id')
      .eq('po_id', validated.po_id)
      .limit(1)
      .maybeSingle()

    if (existingError) throw new Error(existingError.message)
    if (existingApproval) {
      return NextResponse.json({ error: 'Approval workflow already applied to this purchase order' }, { status: 400 })
    }

    const { data: workflow, error: workflowError } = await (supabase.from('po_approval_workflows') as any)
      .select('id, is_active, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (workflowError) throw new Error(workflowError.message)
    if (!workflow) return NextResponse.json({ error: 'No active approval workflow configured' }, { status: 400 })

    const { data: tiers, error: tiersError } = await (supabase.from('po_workflow_tiers') as any)
      .select('id, min_amount, max_amount')
      .eq('workflow_id', workflow.id)
      .order('min_amount', { ascending: true })

    if (tiersError) throw new Error(tiersError.message)
    if (!tiers || tiers.length === 0) return NextResponse.json({ error: 'Workflow has no tiers' }, { status: 400 })

    const poTotal = toBigInt(purchaseOrder.total ?? 0)

    const matchedTier = (tiers as any[]).find((tier) => {
      const min = toBigInt(tier.min_amount ?? 0)
      const max = tier.max_amount === null || tier.max_amount === undefined ? null : toBigInt(tier.max_amount)
      if (poTotal < min) return false
      if (max !== null && poTotal > max) return false
      return true
    })

    if (!matchedTier) {
      return NextResponse.json({ error: 'No matching workflow tier for this purchase order total' }, { status: 400 })
    }

    const { data: steps, error: stepsError } = await (supabase.from('po_workflow_steps') as any)
      .select('id, step_order, step_label, approver_user_id, approver_email')
      .eq('tier_id', matchedTier.id)
      .order('step_order', { ascending: true })

    if (stepsError) throw new Error(stepsError.message)
    if (!steps || steps.length === 0) return NextResponse.json({ error: 'Matched tier has no approval steps' }, { status: 400 })

    const approvalRows = (steps as any[]).map((step) => ({
      id: crypto.randomUUID(),
      company_id: companyId,
      po_id: validated.po_id,
      step_id: step.id,
      step_order: step.step_order,
      step_label: step.step_label,
      approver_user_id: step.approver_user_id ?? null,
      approver_email: step.approver_email ?? null,
      status: 'pending',
    }))

    const { error: insertError } = await (supabase.from('po_approval_records') as any).insert(approvalRows)
    if (insertError) throw new Error(insertError.message)

    const { error: updatePoError } = await (supabase.from('purchase_orders') as any)
      .update({
        matched_tier_id: matchedTier.id,
        current_step_order: 1,
      })
      .eq('id', validated.po_id)
      .eq('company_id', companyId)

    if (updatePoError) throw new Error(updatePoError.message)

    return NextResponse.json(approvalRows)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[API Purchase Order Workflow APPLY] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
