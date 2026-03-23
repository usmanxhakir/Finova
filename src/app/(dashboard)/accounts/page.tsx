import { createClient } from '@/lib/supabase/server'
import { AccountsClient } from './AccountsClient'

export const dynamic = 'force-dynamic'

export default async function ChartOfAccountsPage() {
    const supabase = await createClient()

    // 1. Fetch all accounts
    const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .order('code', { ascending: true })

    // 2. Fetch all journal entry lines to calculate balances
    const { data: linesData } = await supabase
        .from('journal_entry_lines')
        .select('account_id, debit, credit')

    // 3. Aggregate balances
    const balances: Record<string, number> = {}
    
    // Initialize common accounts with 0
    if (accountsData) {
        (accountsData as any[]).forEach(acc => {
            balances[acc.id] = 0
        })
    }

    if (linesData) {
        (linesData as any[]).forEach(line => {
            if (balances[line.account_id] !== undefined) {
                // We calculate raw (Debit - Credit) first
                // and adjust for "normal" balance in the UI or during aggregation
                balances[line.account_id] += (Number(line.debit || 0) - Number(line.credit || 0))
            }
        })
    }

    // 4. Map balances back to accounts and apply normal balance logic
    const accountsWithBalances = accountsData ? (accountsData as any[]).map(acc => {
        const rawBalance = balances[acc.id] || 0
        let balance = rawBalance

        // Adjust for "normal" balance
        // Asset/Expense: Debit - Credit (rawBalance is fine)
        // Liability/Equity/Revenue: Credit - Debit (flip rawBalance)
        if (acc.type === 'liability' || acc.type === 'equity' || acc.type === 'revenue') {
            balance = -rawBalance
        }

        return {
            ...acc,
            balance
        }
    }) : []

    return (
        <AccountsClient initialAccounts={accountsWithBalances} />
    )
}
