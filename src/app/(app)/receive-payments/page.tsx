import { createClient } from '@/lib/supabase/server'
import { ReceivePaymentsClient } from '@/components/receive-payments/ReceivePaymentsClient'

export const metadata = {
    title: 'Receive Payments | Finova',
}

export default async function ReceivePaymentsPage() {
    const supabase = await createClient()

    const [
        { data: accounts },
        { data: invoices }
    ] = await Promise.all([
        supabase
            .from('accounts')
            .select('id, name, code, sub_type')
            .in('sub_type', ['bank', 'cash'])
            .eq('is_active', true)
            .order('name'),
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/invoices/open`, { cache: 'no-store' })
            .then(res => res.json())
            .catch(() => [])
    ])

    return (
        <ReceivePaymentsClient 
            initialInvoices={invoices || []} 
            accounts={accounts || []} 
        />
    )
}
