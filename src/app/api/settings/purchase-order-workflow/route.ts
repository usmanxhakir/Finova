/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'

type WorkflowPayload = {
  name: string
  is_active: boolean
  tiers: Array<{
    name: string
    min_amount: string
    max_amount: string | null
    steps: Array<{
      step_order: number
      step_label: string
      approver_user_id: string | null
      approver_email: string | null
    }>
  }>
}

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

async function getAuthedCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  return getCompanyId(supabase, user.id)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const companyId = await getAuthedCompanyId(supabase)

    const { data: workflow, error: workflowError } = await (supabase.from('po_approval_workflows') as any)
      .select('id, name, is_active')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (workflowError) throw new Error(workflowError.message)
    if (!workflow) return Response.json(null)

    const { data: tiers, error: tiersError } = await (supabase.from('po_workflow_tiers') as any)
      .select('id, name, min_amount, max_amount')
      .eq('workflow_id', workflow.id)
      .order('min_amount', { ascending: true })

    if (tiersError) throw new Error(tiersError.message)

    const tiersWithSteps = []

    for (const tier of tiers || []) {
      const { data: steps, error: stepsError } = await (supabase.from('po_workflow_steps') as any)
        .select('id, step_order, step_label, approver_user_id, approver_email')
        .eq('tier_id', tier.id)
        .order('step_order', { ascending: true })

      if (stepsError) throw new Error(stepsError.message)

      tiersWithSteps.push({
        id: tier.id,
        name: tier.name,
        min_amount: tier.min_amount,
        max_amount: tier.max_amount,
        steps: (steps || []).map((step: any) => ({
          id: step.id,
          step_order: step.step_order,
          step_label: step.step_label,
          approver_user_id: step.approver_user_id ?? null,
          approver_email: step.approver_email ?? null,
        })),
      })
    }

    return Response.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        is_active: workflow.is_active,
      },
      tiers: tiersWithSteps,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : 500
    return Response.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const companyId = await getAuthedCompanyId(supabase)
    const body = await request.json() as WorkflowPayload

    const { data: existingWorkflow, error: existingError } = await (supabase.from('po_approval_workflows') as any)
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (existingError) throw new Error(existingError.message)

    let workflowId: string

    if (!existingWorkflow) {
      const { data: newWorkflow, error: insertWorkflowError } = await (supabase.from('po_approval_workflows') as any)
        .insert({
          company_id: companyId,
          name: body.name,
          is_active: body.is_active,
        })
        .select('id')
        .limit(1)
        .maybeSingle()

      if (insertWorkflowError) throw new Error(insertWorkflowError.message)
      if (!newWorkflow?.id) throw new Error('Failed to create workflow')

      workflowId = newWorkflow.id
    } else {
      workflowId = existingWorkflow.id

      const { error: updateWorkflowError } = await (supabase.from('po_approval_workflows') as any)
        .update({
          name: body.name,
          is_active: body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId)

      if (updateWorkflowError) throw new Error(updateWorkflowError.message)
    }

    const { data: existingTiers, error: existingTiersError } = await (supabase.from('po_workflow_tiers') as any)
      .select('id')
      .eq('workflow_id', workflowId)

    if (existingTiersError) throw new Error(existingTiersError.message)

    const existingTierIds = (existingTiers || []).map((tier: any) => tier.id)

    if (existingTierIds.length > 0) {
      const { error: deleteStepsError } = await (supabase.from('po_workflow_steps') as any)
        .delete()
        .in('tier_id', existingTierIds)

      if (deleteStepsError) throw new Error(deleteStepsError.message)
    }

    const { error: deleteTiersError } = await (supabase.from('po_workflow_tiers') as any)
      .delete()
      .eq('workflow_id', workflowId)

    if (deleteTiersError) throw new Error(deleteTiersError.message)

    for (const tier of body.tiers || []) {
      const { data: newTier, error: insertTierError } = await (supabase.from('po_workflow_tiers') as any)
        .insert({
          workflow_id: workflowId,
          name: tier.name,
          min_amount: tier.min_amount,
          max_amount: tier.max_amount,
        })
        .select('id')
        .limit(1)
        .maybeSingle()

      if (insertTierError) throw new Error(insertTierError.message)
      if (!newTier?.id) throw new Error('Failed to create workflow tier')

      for (const step of tier.steps || []) {
        const { error: insertStepError } = await (supabase.from('po_workflow_steps') as any)
          .insert({
            tier_id: newTier.id,
            step_order: step.step_order,
            step_label: step.step_label,
            approver_user_id: step.approver_user_id,
            approver_email: step.approver_email,
          })

        if (insertStepError) throw new Error(insertStepError.message)
      }
    }

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : 500
    return Response.json({ error: message }, { status })
  }
}
