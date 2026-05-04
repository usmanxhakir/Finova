import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) {
      return Response.json({ error: 'Company not found for user' }, { status: 404 })
    }
    const companyId = profile.company_id

    const body = await request.json()
    const { name, type, default_rate, income_account_id, expense_account_id, is_active } = body

    const { data: item, error } = await (supabase.from('items') as any)
      .insert({
        company_id: companyId,
        name,
        type,
        default_rate, // already cents
        income_account_id,
        expense_account_id,
        is_active: is_active ?? true
      })
      .select()
      .limit(1)
      .maybeSingle()

    if (error || !item) {
      console.error('[API Items] insert error:', error)
      throw new Error(error?.message || 'Failed to create item')
    }

    return Response.json({ id: item.id })
  } catch (error: any) {
    console.error('[API Items] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
