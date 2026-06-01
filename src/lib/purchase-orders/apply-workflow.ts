import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type ApplyWorkflowResult = {
  success: boolean
  error?: string
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(Math.round(value))
  if (typeof value === 'string' && value.trim() !== '') return BigInt(value.trim())
  return BigInt(0)
}

export async function applyWorkflowToPO(
  supabase: SupabaseClient<Database>,
  poId: string,
  companyId: string
): Promise<ApplyWorkflowResult> {
  try {
    if (!companyId) {
      return { success: false, error: 'Company not found for user' }
    }

    const { data: purchaseOrder, error: poError } = await (supabase.from('purchase_orders') as any)
      .select('id, company_id, total')
      .eq('id', poId)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (poError) return { success: false, error: poError.message }
    if (!purchaseOrder) return { success: false, error: 'Purchase order not found' }

    const { data: existingApproval, error: existingError } = await (supabase.from('po_approval_records') as any)
      .select('id')
      .eq('po_id', poId)
      .limit(1)
      .maybeSingle()

    if (existingError) return { success: false, error: existingError.message }
    if (existingApproval) {
      return { success: false, error: 'Approval workflow already applied to this purchase order' }
    }

    const { data: workflow, error: workflowError } = await (supabase.from('po_approval_workflows') as any)
      .select('id, is_active, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (workflowError) return { success: false, error: workflowError.message }
    if (!workflow) return { success: false, error: 'No active approval workflow configured' }

    const { data: tiers, error: tiersError } = await (supabase.from('po_workflow_tiers') as any)
      .select('id, min_amount, max_amount')
      .eq('workflow_id', workflow.id)
      .order('min_amount', { ascending: true })

    if (tiersError) return { success: false, error: tiersError.message }
    if (!tiers || tiers.length === 0) return { success: false, error: 'Workflow has no tiers' }

    let matchedTier: any

    try {
      const poTotal = toBigInt(purchaseOrder.total ?? 0)

      matchedTier = (tiers as any[]).find((tier) => {
        const min = toBigInt(tier.min_amount ?? 0)
        const max = tier.max_amount === null || tier.max_amount === undefined ? null : toBigInt(tier.max_amount)
        if (poTotal < min) return false
        if (max !== null && poTotal > max) return false
        return true
      })
    } catch (error) {
      console.error('[Purchase Order Workflow] tier matching error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to match workflow tier',
      }
    }

    if (!matchedTier) {
      return { success: false, error: 'No matching workflow tier for this purchase order total' }
    }

    const { data: steps, error: stepsError } = await (supabase.from('po_workflow_steps') as any)
      .select('id, step_order, step_label, approver_user_id, approver_email')
      .eq('tier_id', matchedTier.id)
      .order('step_order', { ascending: true })

    if (stepsError) return { success: false, error: stepsError.message }
    if (!steps || steps.length === 0) return { success: false, error: 'Matched tier has no approval steps' }

    const approvalRows = (steps as any[]).map((step) => ({
      id: crypto.randomUUID(),
      company_id: companyId,
      po_id: poId,
      step_id: step.id,
      step_order: step.step_order,
      step_label: step.step_label,
      approver_user_id: step.approver_user_id ?? null,
      approver_email: step.approver_email ?? null,
      status: 'pending',
    }))

    const { error: insertError } = await (supabase.from('po_approval_records') as any).insert(approvalRows)
    if (insertError) return { success: false, error: insertError.message }

    const { error: updatePoError } = await (supabase.from('purchase_orders') as any)
      .update({
        matched_tier_id: matchedTier.id,
        current_step_order: 1,
      })
      .eq('id', poId)
      .eq('company_id', companyId)

    if (updatePoError) return { success: false, error: updatePoError.message }

    return { success: true }
  } catch (error) {
    console.error('[Purchase Order Workflow] apply error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal Server Error',
    }
  }
}
