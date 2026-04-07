import { createClient } from '@/lib/supabase/server'
import { ReconcileScreen } from '@/components/banking/ReconcileScreen'
import { notFound } from 'next/navigation'

interface ReconcileAccountPageProps {
    params: Promise<{ accountId: string }>
}

export default async function ReconcileAccountPage({ params }: ReconcileAccountPageProps) {
    const { accountId } = await params
    const supabase = await createClient()

    // 1. Fetch account details
    const { data: account, error } = await (supabase
        .from('accounts') as any)
        .select('*')
        .eq('id', accountId)
        .single()

    if (error || !account) {
        notFound()
    }

    // 2. Security Check: Only Bank/Cash/Credit Card accounts
    const isEligible = ['bank', 'cash', 'credit_card'].includes(account.sub_type)
    if (!isEligible) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
                <div className="p-4 bg-rose-50 rounded-full">
                    <span className="text-rose-600 font-bold text-2xl">!</span>
                </div>
                <h1 className="text-xl font-bold text-zinc-900 italic">Account not eligible for reconciliation</h1>
                <p className="text-zinc-500 max-w-md text-center">
                    Only accounts of sub-type <span className="font-bold">Bank, Cash, or Credit Card</span> 
                    can be reconciled in this screen.
                </p>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen animate-in fade-in duration-700">
            <ReconcileScreen accountId={accountId} account={account} />
        </div>
    )
}
