import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = await createClient()
    const companyId = await getCompanyId()

    const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('code', 'in', '("1100","2100")')
        .order('code')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ accounts: data })
}
