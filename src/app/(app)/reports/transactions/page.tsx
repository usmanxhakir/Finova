import { createClient } from '@/lib/supabase/server'
import TransactionListClient from './TransactionListClient'
import { getAgingBucket } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TransactionListReportPage(props: { 
    searchParams: Promise<{ 
        account_id?: string, 
        date_from?: string, 
        date_to?: string, 
        label?: string 
    }> 
}) {
    const searchParams = await props.searchParams;
    const accountId = searchParams.account_id;
    const dateFrom = searchParams.date_from;
    const dateTo = searchParams.date_to;
    const accountLabel = searchParams.label;

    const supabase = await createClient()

    // 1. Fetch Invoices
    let invQuery = supabase
        .from('invoices')
        .select(`
            id,
            number,
            issue_date,
            total,
            status,
            contact:contacts(id, name)
            ${accountId ? ', invoice_line_items!inner(account_id)' : ''}
        `);
    
    if (accountId) invQuery = invQuery.eq('invoice_line_items.account_id', accountId);
    if (dateFrom) invQuery = invQuery.gte('issue_date', dateFrom);
    if (dateTo) invQuery = invQuery.lte('issue_date', dateTo);

    const { data: invoicesData } = await invQuery;

    // 2. Fetch Bills
    let billQuery = supabase
        .from('bills')
        .select(`
            id,
            number,
            issue_date,
            total,
            status,
            contact:contacts(id, name)
            ${accountId ? ', bill_line_items!inner(account_id)' : ''}
        `);

    if (accountId) billQuery = billQuery.eq('bill_line_items.account_id', accountId);
    if (dateFrom) billQuery = billQuery.gte('issue_date', dateFrom);
    if (dateTo) billQuery = billQuery.lte('issue_date', dateTo);

    const { data: billsData } = await billQuery;

    // 3. Fetch Expenses
    let expQuery = supabase
        .from('expenses')
        .select(`
            id,
            date,
            amount,
            payee,
            expense_account:accounts!expense_account_id(name),
            status
        `);

    if (accountId) expQuery = expQuery.eq('expense_account_id', accountId);
    if (dateFrom) expQuery = expQuery.gte('date', dateFrom);
    if (dateTo) expQuery = expQuery.lte('date', dateTo);

    const { data: expensesData } = await expQuery;

    // 4. Fetch Payments
    let pmtQuery = supabase
        .from('payments')
        .select(`
            id,
            date,
            amount,
            reference,
            type,
            contact:contacts(id, name),
            account:accounts(name),
            payment_allocations(invoice_id, bill_id)
        `);

    if (accountId) pmtQuery = pmtQuery.eq('payment_account_id', accountId);
    if (dateFrom) pmtQuery = pmtQuery.gte('date', dateFrom);
    if (dateTo) pmtQuery = pmtQuery.lte('date', dateTo);

    const { data: paymentsData } = await pmtQuery;

    // 5. Normalize and Combine
    const transactions: any[] = []

    if (invoicesData) {
        for (const inv of invoicesData as any[]) {
            transactions.push({
                id: inv.id,
                date: inv.issue_date,
                type: 'Invoice',
                reference: inv.number,
                contactName: (inv.contact as any)?.name || 'Unknown',
                accountName: 'Accounts Receivable', // Simplified for list
                amount: inv.total,
                status: inv.status,
                entityId: inv.id
            })
        }
    }

    if (billsData) {
        for (const bill of billsData as any[]) {
            transactions.push({
                id: bill.id,
                date: bill.issue_date,
                type: 'Bill',
                reference: bill.number,
                contactName: (bill.contact as any)?.name || 'Unknown',
                accountName: 'Accounts Payable', // Simplified for list
                amount: bill.total,
                status: bill.status,
                entityId: bill.id
            })
        }
    }

    if (expensesData) {
        for (const exp of expensesData as any[]) {
            // Ignore voided expenses for this report unless we specifically want them
            transactions.push({
                id: exp.id,
                date: exp.date,
                type: 'Expense',
                reference: `EXP-${exp.id.substring(0, 6)}`,
                contactName: exp.payee || 'Unknown Payee',
                accountName: (exp.expense_account as any)?.name || 'Expense',
                amount: exp.amount,
                status: exp.status === 'void' ? 'void' : 'Recorded',
                entityId: exp.id
            })
        }
    }

    if (paymentsData) {
        for (const pmt of paymentsData as any[]) {
            // Determine where a click should go based on allocations
            let relatedEntityId = null;
            if (pmt.payment_allocations && pmt.payment_allocations.length > 0) {
                const alloc = pmt.payment_allocations[0] as any;
                relatedEntityId = alloc.invoice_id || alloc.bill_id;
            }

            transactions.push({
                id: pmt.id,
                date: pmt.date,
                type: 'Payment',
                reference: pmt.reference || `PMT-${pmt.id.substring(0, 6)}`,
                contactName: (pmt.contact as any)?.name || 'Unknown',
                accountName: (pmt.account as any)?.name || 'Bank',
                amount: pmt.amount,
                status: 'Recorded', // Payments don't really have a status in DB other than just existing
                entityId: relatedEntityId // Where to link to
            })
        }
    }

    // Sort newest first by default
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return (
        <TransactionListClient 
            initialTransactions={transactions} 
            preAppliedFilters={{
                accountId,
                dateFrom,
                dateTo,
                accountLabel
            }}
        />
    )
}
