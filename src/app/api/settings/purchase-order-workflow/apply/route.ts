import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { applyWorkflowToPO } from '@/lib/purchase-orders/apply-workflow'

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
    const result = await applyWorkflowToPO(supabase, validated.po_id, companyId)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to apply workflow' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('[API Purchase Order Workflow APPLY] error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
