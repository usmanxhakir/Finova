import { createClient } from '@/lib/supabase/server'
import { PayBillsClient } from '@/components/pay-bills/PayBillsClient'

export const metadata = {
    title: 'Pay Bills | Finova',
}

export default async function PayBillsPage() {
    const supabase = await createClient()

    const [
        { data: accounts },
        { data: bills }
    ] = await Promise.all([
        supabase
            .from('accounts')
            .select('id, name, code, sub_type')
            .in('sub_type', ['bank', 'cash', 'credit_card'])
            .eq('is_active', true)
            .order('name'),
        // We can fetch initial bills here or let the client fetch them. 
        // User requested: "Server component: fetch open bills and accounts"
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/bills/open`, { cache: 'no-store' })
            .then(res => res.json())
            .catch(() => [])
    ])

    return (
        <PayBillsClient 
            initialBills={bills || []} 
            accounts={accounts || []} 
        />
    )
}
