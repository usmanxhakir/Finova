import { createClient } from '@/lib/supabase/server'
import { ReceivePaymentsClient } from '@/components/receive-payments/ReceivePaymentsClient'

export const metadata = {
    title: 'Receive Payments | Finova',
}

export default async function ReceivePaymentsPage() {
    const supabase = await createClient()

    const [
        { data: accounts },
        { data: customers }
    ] = await Promise.all([
        supabase
            .from('accounts')
            .select('id, name, code, sub_type')
            .in('sub_type', ['bank', 'cash'])
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('contacts')
            .select('id, name')
            .in('type', ['customer', 'both'])
            .eq('is_active', true)
            .order('name')
    ])

    return (
        <ReceivePaymentsClient 
            customers={customers || []} 
            accounts={accounts || []} 
        />
    )
}
