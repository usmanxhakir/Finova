import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/supabase/get-company-id'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const companyId = await getCompanyId()
        
        const { searchParams } = new URL(req.url)
        const q = searchParams.get('q')

        if (!q || q.length < 2) {
            return NextResponse.json({
                invoices: [],
                bills: [],
                expenses: [],
                contacts: [],
                items: []
            })
        }

        const query = `%${q}%`

        const [
            { data: invoices },
            { data: bills },
            { data: expenses },
            { data: contacts },
            { data: items }
        ] = await Promise.all([
            supabase
                .from('invoices')
                .select(`
                    id, number, customer_reference, total, status, issue_date,
                    contacts ( name )
                `)
                .eq('company_id', companyId)
                .or(`number.ilike.${query},customer_reference.ilike.${query}`)
                .limit(5),
            supabase
                .from('bills')
                .select(`
                    id, number, reference_number, total, status, issue_date,
                    contacts ( name )
                `)
                .eq('company_id', companyId)
                .or(`number.ilike.${query},reference_number.ilike.${query}`)
                .limit(5),
            supabase
                .from('expenses')
                .select(`id, number, reference, description, amount, date`)
                .eq('company_id', companyId)
                .or(`number.ilike.${query},reference.ilike.${query},payee.ilike.${query},notes.ilike.${query}`)
                .limit(5),
            supabase
                .from('contacts')
                .select(`id, name, type, email`)
                .eq('company_id', companyId)
                .or(`name.ilike.${query},email.ilike.${query}`)
                .limit(5),
            supabase
                .from('items')
                .select(`id, name, type, default_rate`)
                .eq('company_id', companyId)
                .or(`name.ilike.${query},description.ilike.${query}`)
                .limit(5)
        ])

        return NextResponse.json({
            invoices: (invoices || []).map((i: any) => ({
                ...i,
                contact_name: i.contacts?.name || 'Unknown'
            })),
            bills: (bills || []).map((b: any) => ({
                ...b,
                contact_name: b.contacts?.name || 'Unknown'
            })),
            expenses: expenses || [],
            contacts: contacts || [],
            items: items || []
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
