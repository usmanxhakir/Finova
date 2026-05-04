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
    const { name, type, email, phone, is_active } = body

    const { data: contact, error } = await (supabase.from('contacts') as any)
      .insert({
        company_id: companyId,
        name,
        type,
        email,
        phone,
        is_active: is_active ?? true
      })
      .select()
      .limit(1)
      .maybeSingle()

    if (error || !contact) {
      console.error('[API Contacts] insert error:', error)
      throw new Error(error?.message || 'Failed to create contact')
    }

    return Response.json({ id: contact.id })
  } catch (error: any) {
    console.error('[API Contacts] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
