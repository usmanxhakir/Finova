import { createClient } from '@/lib/supabase/server'
import { PayBillsClient } from '@/components/pay-bills/PayBillsClient'

export const metadata = {
    title: 'Pay Bills | Finova',
}

export default async function PayBillsPage() {
    const supabase = await createClient()

    const [
        { data: accounts },
        { data: vendors }
    ] = await Promise.all([
        supabase
            .from('accounts')
            .select('id, name, code, sub_type')
            .in('sub_type', ['bank', 'cash', 'credit_card'])
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('contacts')
            .select('id, name')
            .in('type', ['vendor', 'both'])
            .eq('is_active', true)
            .order('name')
    ])

    return (
        <PayBillsClient 
            vendors={vendors || []} 
            accounts={accounts || []} 
        />
    )
}
