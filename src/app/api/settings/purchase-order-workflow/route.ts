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

function toBigIntCentsString(value: string | number) {
  const raw = typeof value === 'number' ? String(value) : value
  if (typeof raw !== 'string') throw new Error('Invalid amount')
  const normalized = raw.trim()
  if (!/^\d+$/.test(normalized)) throw new Error('Amounts must be integer cents')
  return BigInt(normalized).toString()
}

const stepSchema = z
  .object({
    step_order: z.number().int().positive(),
    step_label: z.string().min(1),
    approver_user_id: z.string().uuid().nullable().optional(),
    approver_email: z.string().email().nullable().optional(),
  })
  .refine(
    (step) => Boolean(step.approver_user_id) !== Boolean(step.approver_email),
    { message: 'Step must have exactly one approver (user or external email).' }
  )

const tierSchema = z.object({
  name: z.string().min(1),
  min_amount: z.union([z.string(), z.number()]),
  max_amount: z.union([z.string(), z.number()]).nullable().optional(),
  steps: z.array(stepSchema),
})

const workflowSchema = z.object({
  name: z.string().min(1),
  is_active: z.boolean().optional(),
  tiers: z.array(tierSchema).min(1),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = await getCompanyId(supabase, user.id)

    const { data: workflow, error: workflowError } = await (supabase.from('po_approval_workflows') as any)
      .select('id, name, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (workflowError) throw new Error(workflowError.message)
    if (!workflow) return NextResponse.json(null)

    const { data: tiers, error: tiersError } = await (supabase.from('po_workflow_tiers') as any)
      .select('id, name, min_amount, max_amount')
      .eq('workflow_id', workflow.id)
      .order('min_amount', { ascending: true })

    if (tiersError) throw new Error(tiersError.message)

    const tierIds = (tiers || []).map((tier: any) => tier.id)
    let steps: any[] = []
    if (tierIds.length > 0) {
      const { data: stepsData, error: stepsError } = await (supabase.from('po_workflow_steps') as any)
        .select('id, tier_id, step_order, step_label, approver_user_id, approver_email')
        .in('tier_id', tierIds)
        .order('step_order', { ascending: true })

      if (stepsError) throw new Error(stepsError.message)
      steps = stepsData || []
    }

    const stepsByTierId = new Map<string, any[]>()
    for (const step of steps) {
      const list = stepsByTierId.get(step.tier_id) || []
      list.push(step)
      stepsByTierId.set(step.tier_id, list)
    }

    const payload = {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        is_active: Boolean(workflow.is_active),
      },
      tiers: (tiers || []).map((tier: any) => ({
        ...tier,
        steps: (stepsByTierId.get(tier.id) || []).map((step) => ({
          id: step.id,
          step_order: step.step_order,
          step_label: step.step_label,
          approver_user_id: step.approver_user_id ?? null,
          approver_email: step.approver_email ?? null,
        })),
      })),
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('[API Purchase Order Workflow GET] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

async function replaceWorkflow(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = await getCompanyId(supabase, user.id)
  const body = await request.json()
  const validated = workflowSchema.parse(body)

  const desiredIsActive = validated.is_active ?? true

  const { data: existingWorkflows, error: existingError } = await (supabase.from('po_approval_workflows') as any)
    .select('id')
    .eq('company_id', companyId)

  if (existingError) throw new Error(existingError.message)

  const newWorkflowId = crypto.randomUUID()

  try {
    const { error: insertWorkflowError } = await (supabase.from('po_approval_workflows') as any).insert({
      id: newWorkflowId,
      company_id: companyId,
      name: validated.name,
      is_active: false,
    })

    if (insertWorkflowError) throw new Error(insertWorkflowError.message)

    const tierRows: any[] = []
    const stepRows: any[] = []

    for (const tier of validated.tiers) {
      const tierId = crypto.randomUUID()
      const minAmount = toBigIntCentsString(tier.min_amount)
      const maxAmount = tier.max_amount === null || tier.max_amount === undefined ? null : toBigIntCentsString(tier.max_amount)

      if (maxAmount !== null && BigInt(maxAmount) < BigInt(minAmount)) {
        throw new Error(`Tier "${tier.name}" max_amount must be >= min_amount`)
      }

      tierRows.push({
        id: tierId,
        workflow_id: newWorkflowId,
        name: tier.name,
        min_amount: minAmount,
        max_amount: maxAmount,
      })

      for (const step of tier.steps) {
        stepRows.push({
          id: crypto.randomUUID(),
          tier_id: tierId,
          step_order: step.step_order,
          step_label: step.step_label,
          approver_user_id: step.approver_user_id ?? null,
          approver_email: step.approver_email ?? null,
        })
      }
    }

    const { error: insertTiersError } = await (supabase.from('po_workflow_tiers') as any).insert(tierRows)
    if (insertTiersError) throw new Error(insertTiersError.message)

    if (stepRows.length > 0) {
      const { error: insertStepsError } = await (supabase.from('po_workflow_steps') as any).insert(stepRows)
      if (insertStepsError) throw new Error(insertStepsError.message)
    }

    const { error: deleteOldError } = await (supabase.from('po_approval_workflows') as any)
      .delete()
      .eq('company_id', companyId)
      .neq('id', newWorkflowId)

    if (deleteOldError) throw new Error(deleteOldError.message)

    const { error: activateError } = await (supabase.from('po_approval_workflows') as any)
      .update({ is_active: desiredIsActive })
      .eq('id', newWorkflowId)
      .eq('company_id', companyId)

    if (activateError) throw new Error(activateError.message)

    return NextResponse.json({
      workflow_id: newWorkflowId,
      replaced_workflow_ids: (existingWorkflows || []).map((row: any) => row.id),
    })
  } catch (error) {
    await (supabase.from('po_approval_workflows') as any).delete().eq('id', newWorkflowId).eq('company_id', companyId)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    return await replaceWorkflow(request)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[API Purchase Order Workflow POST] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    return await replaceWorkflow(request)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[API Purchase Order Workflow PUT] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
