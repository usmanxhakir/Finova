import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type JournalSourceType = Database['public']['Enums']['journal_source_type']

// Explicit types to fix inference issues
type InvoiceWithLines = Database['public']['Tables']['invoices']['Row'] & {
    invoice_line_items: Database['public']['Tables']['invoice_line_items']['Row'][]
}

type BillWithLines = Database['public']['Tables']['bills']['Row'] & {
    bill_line_items: Database['public']['Tables']['bill_line_items']['Row'][]
}

type PaymentRecord = Database['public']['Tables']['payments']['Row']

/**
 * Automatically creates a balanced journal entry for a sent invoice.
 */
export async function createInvoiceJournalEntry(
    supabase: SupabaseClient<Database>,
    invoiceId: string,
    companyId: string
) {
    // 1. Fetch invoice data with line items
    const { data: rawInvoice, error: invoiceError } = await (supabase
        .from('invoices') as any)
        .select(`
            *,
            invoice_line_items (
                *
            )
        `)
        .eq('id', invoiceId)
        .single()

    if (invoiceError || !rawInvoice) {
        throw new Error(`Invoice not found: ${invoiceError?.message}`)
    }

    const invoice = rawInvoice as InvoiceWithLines

    if (invoice.status === 'draft' || invoice.status === 'void') {
        throw new Error(`Cannot create journal entry for invoice in status: ${invoice.status}`)
    }

    // 2. Get system accounts (scoped to this company via RLS)
    const { data: accounts, error: accountsError } = await (supabase
        .from('accounts') as any)
        .select('id, code')
        .eq('code', '1100') // A/R
        .single()

    if (accountsError || !accounts) {
        throw new Error(`System account 1100 (Accounts Receivable) not found: ${accountsError?.message}`)
    }

    const arAccountId = (accounts as any).id

    // 3. Prepare journal entry
    const { data: journalEntry, error: jeError } = await (supabase
        .from('journal_entries') as any)
        .insert({
            company_id: companyId,
            date: invoice.issue_date,
            reference: invoice.number,
            description: `Invoice ${invoice.number}`,
            is_system_generated: true,
            source_type: 'invoice',
            source_id: invoice.id
        })
        .select()
        .single()

    if (jeError || !journalEntry) {
        throw new Error(`Failed to create journal entry: ${jeError?.message}`)
    }

    const jeId = (journalEntry as any).id

    // 4. Prepare lines
    const lines: any[] = []

    // Debit A/R for the total
    lines.push({
        company_id: companyId,
        journal_entry_id: jeId,
        account_id: arAccountId,
        description: `Total for Invoice ${invoice.number}`,
        debit: invoice.total,
        credit: 0
    })

    // Credit revenue accounts for each line item
    invoice.invoice_line_items.forEach((item) => {
        lines.push({
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: item.account_id,
            description: item.description || `Line item for ${invoice.number}`,
            debit: 0,
            credit: item.amount
        })
    })

    // Handle tax if present
    if (invoice.tax_amount && invoice.tax_amount > 0) {
        const { data: taxAccount } = await (supabase
            .from('accounts') as any)
            .select('id')
            .ilike('name', '%Tax Payable%')
            .limit(1)
            .maybeSingle()

        if (taxAccount) {
            lines.push({
                company_id: companyId,
                journal_entry_id: jeId,
                account_id: (taxAccount as any).id,
                description: `Tax for Invoice ${invoice.number}`,
                debit: 0,
                credit: invoice.tax_amount
            })
        }
    }

    // 5. Validate Balances
    const totalDebits = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0)
    const totalCredits = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0)

    if (totalDebits !== totalCredits) {
        throw new Error(`Journal entry for invoice ${invoice.number} is unbalanced. Debits: ${totalDebits}, Credits: ${totalCredits}`)
    }

    // 6. Bulk insert lines
    const { error: linesError } = await (supabase
        .from('journal_entry_lines') as any)
        .insert(lines)

    if (linesError) {
        throw new Error(`Failed to create journal entry lines: ${linesError.message}`)
    }

    return journalEntry
}

export async function voidInvoiceJournalEntries(
    supabase: SupabaseClient<Database>,
    invoiceId: string,
    companyId: string
) {
    // 1. Fetch all journal entries for the invoice
    const { data: existingEntries, error: fetchError } = await (supabase
        .from('journal_entries') as any)
        .select('*')
        .eq('source_type', 'invoice')
        .eq('source_id', invoiceId)
        .eq('is_system_generated', true)

    if (fetchError) {
        throw new Error(`Failed to fetch journal entries: ${fetchError.message}`)
    }

    // 2. Fetch associated payment journal entries
    const { data: allocations } = await (supabase
        .from('payment_allocations') as any)
        .select('payment_id')
        .eq('invoice_id', invoiceId)

    const paymentIds = (allocations || []).map((a: any) => a.payment_id)
    let paymentEntries: any[] = []

    if (paymentIds.length > 0) {
        const { data: pEntries } = await (supabase
            .from('journal_entries') as any)
            .select('*')
            .eq('source_type', 'payment')
            .in('source_id', paymentIds)
            .eq('is_system_generated', true)

        if (pEntries) paymentEntries = pEntries
    }

    const allEntriesToReverse = [...(existingEntries || []), ...paymentEntries]

    // 3. Reverse each entry
    for (const entry of allEntriesToReverse) {
        const { data: lines, error: linesFetchError } = await (supabase
            .from('journal_entry_lines') as any)
            .select('*')
            .eq('journal_entry_id', entry.id)

        if (linesFetchError || !lines) {
            throw new Error(`Failed to fetch journal entry lines for entry ${entry.id}: ${linesFetchError?.message}`)
        }

        const { data: reversalEntry, error: reversalError } = await (supabase
            .from('journal_entries') as any)
            .insert({
                company_id: companyId,
                date: new Date().toISOString().split('T')[0],
                reference: entry.reference,
                description: `VOID REVERSAL: ${entry.description}`,
                is_system_generated: true,
                source_type: entry.source_type,
                source_id: entry.source_id
            })
            .select()
            .single()

        if (reversalError || !reversalEntry) {
            throw new Error(`Failed to create reversal entry for ${entry.id}: ${reversalError?.message}`)
        }

        const revEntryId = (reversalEntry as any).id

        const reversalLines: any[] = (lines as any[]).map(line => ({
            company_id: companyId,
            journal_entry_id: revEntryId,
            account_id: line.account_id,
            description: `REVERSAL: ${line.description}`,
            debit: line.credit,
            credit: line.debit
        }))

        const { error: linesError } = await (supabase
            .from('journal_entry_lines') as any)
            .insert(reversalLines)

        if (linesError) {
            throw new Error(`Failed to create reversal lines: ${linesError.message}`)
        }
    }

    // 4. Reset Invoice amounts and status
    const { error: invoiceUpdateError } = await (supabase
        .from('invoices') as any)
        .update({
            amount_paid: 0,
            amount_due: 0,
            status: 'void'
        })
        .eq('id', invoiceId)

    // Re-fetch total to set amount_due correctly
    const { data: invData } = await (supabase.from('invoices') as any).select('total').eq('id', invoiceId).single()
    if (invData) {
        await (supabase.from('invoices') as any).update({ amount_due: invData.total }).eq('id', invoiceId)
    }

    if (invoiceUpdateError) {
        throw new Error(`Failed to update invoice status: ${invoiceUpdateError.message}`)
    }
}

export async function createPaymentJournalEntry(
    supabase: SupabaseClient<Database>,
    paymentId: string,
    companyId: string
) {
    const { data, error: paymentError } = await (supabase
        .from('payments') as any)
        .select('*')
        .eq('id', paymentId)
        .single()

    if (paymentError || !data) {
        throw new Error(`Payment not found: ${paymentError?.message}`)
    }

    const payment = data as unknown as PaymentRecord

    const { data: arAccount } = await (supabase
        .from('accounts') as any)
        .select('id')
        .eq('code', '1100')
        .single()

    if (!arAccount) {
        throw new Error('System account 1100 (Accounts Receivable) not found')
    }

    const arAccountId = (arAccount as any).id

    const { data: journalEntry, error: jeError } = await (supabase
        .from('journal_entries') as any)
        .insert({
            company_id: companyId,
            date: payment.date,
            reference: payment.reference,
            description: `Payment ${payment.reference || payment.id}`,
            is_system_generated: true,
            source_type: 'payment',
            source_id: payment.id
        })
        .select()
        .single()

    if (jeError || !journalEntry) {
        throw new Error(`Failed to create journal entry: ${jeError?.message}`)
    }

    const jeId = (journalEntry as any).id

    const lines: any[] = [
        {
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: payment.account_id,
            description: `Payment received: ${payment.reference || ''}`,
            debit: payment.amount,
            credit: 0
        },
        {
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: arAccountId,
            description: `A/R reduction for payment: ${payment.reference || ''}`,
            debit: 0,
            credit: payment.amount
        }
    ]

    const { error: linesError } = await (supabase
        .from('journal_entry_lines') as any)
        .insert(lines)

    if (linesError) {
        throw new Error(`Failed to create payment journal lines: ${linesError.message}`)
    }

    return journalEntry
}

/**
 * Automatically creates a balanced journal entry for a finalized bill.
 */
export async function createBillJournalEntry(
    supabase: SupabaseClient<Database>,
    billId: string,
    companyId: string
) {
    // 1. Fetch bill data with line items
    const { data: rawBill, error: billError } = await (supabase
        .from('bills') as any)
        .select(`
            *,
            bill_line_items (
                *
            )
        `)
        .eq('id', billId)
        .single()

    if (billError || !rawBill) {
        throw new Error(`Bill not found: ${billError?.message}`)
    }

    const bill = rawBill as BillWithLines

    if (bill.status === 'draft' || bill.status === 'void') {
        throw new Error(`Cannot create journal entry for bill in status: ${bill.status}`)
    }

    // 2. Get system accounts (Accounts Payable - 2100), scoped by RLS
    const { data: accounts, error: accountsError } = await (supabase
        .from('accounts') as any)
        .select('id, code')
        .eq('code', '2100') // A/P
        .single()

    if (accountsError || !accounts) {
        throw new Error(`System account 2100 (Accounts Payable) not found: ${accountsError?.message}`)
    }

    const apAccountId = (accounts as any).id

    // 3. Prepare journal entry
    const { data: journalEntry, error: jeError } = await (supabase
        .from('journal_entries') as any)
        .insert({
            company_id: companyId,
            date: bill.issue_date,
            reference: bill.number,
            description: `Bill ${bill.number}`,
            is_system_generated: true,
            source_type: 'bill',
            source_id: bill.id
        })
        .select()
        .single()

    if (jeError || !journalEntry) {
        throw new Error(`Failed to create journal entry: ${jeError?.message}`)
    }

    const jeId = (journalEntry as any).id

    // 4. Prepare lines
    const lines: any[] = []

    // Debit expense accounts for each line item
    bill.bill_line_items.forEach((item) => {
        lines.push({
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: item.account_id,
            description: item.description || `Line item for ${bill.number}`,
            debit: item.amount,
            credit: 0
        })
    })

    // Handle tax if present
    if (bill.tax_amount && bill.tax_amount > 0) {
        const { data: taxAccount } = await (supabase
            .from('accounts') as any)
            .select('id')
            .ilike('name', '%Tax Payable%')
            .limit(1)
            .maybeSingle()

        if (taxAccount) {
            lines.push({
                company_id: companyId,
                journal_entry_id: jeId,
                account_id: (taxAccount as any).id,
                description: `Tax for Bill ${bill.number}`,
                debit: bill.tax_amount,
                credit: 0
            })
        }
    }

    // Credit A/P for the total
    lines.push({
        company_id: companyId,
        journal_entry_id: jeId,
        account_id: apAccountId,
        description: `Total for Bill ${bill.number}`,
        debit: 0,
        credit: bill.total
    })

    // 5. Validate Balances
    const totalDebits = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0)
    const totalCredits = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0)

    if (totalDebits !== totalCredits) {
        throw new Error(`Journal entry for bill ${bill.number} is unbalanced. Debits: ${totalDebits}, Credits: ${totalCredits}`)
    }

    // 6. Bulk insert lines
    const { error: linesError } = await (supabase
        .from('journal_entry_lines') as any)
        .insert(lines)

    if (linesError) {
        throw new Error(`Failed to create journal entry lines: ${linesError.message}`)
    }

    return journalEntry
}

export async function voidBillJournalEntries(
    supabase: SupabaseClient<Database>,
    billId: string,
    companyId: string
) {
    // 1. Fetch all journal entries for the bill
    const { data: existingEntries, error: fetchError } = await (supabase
        .from('journal_entries') as any)
        .select('*')
        .eq('source_type', 'bill')
        .eq('source_id', billId)
        .eq('is_system_generated', true)

    if (fetchError) {
        throw new Error(`Failed to fetch journal entries: ${fetchError.message}`)
    }

    // 2. Fetch associated payment journal entries
    const { data: allocations } = await (supabase
        .from('payment_allocations') as any)
        .select('payment_id')
        .eq('bill_id', billId)

    const paymentIds = (allocations || []).map((a: any) => a.payment_id)
    let paymentEntries: any[] = []

    if (paymentIds.length > 0) {
        const { data: pEntries } = await (supabase
            .from('journal_entries') as any)
            .select('*')
            .eq('source_type', 'payment')
            .in('source_id', paymentIds)
            .eq('is_system_generated', true)

        if (pEntries) paymentEntries = pEntries
    }

    const allEntriesToReverse = [...(existingEntries || []), ...paymentEntries]

    // 3. Reverse each entry
    for (const entry of allEntriesToReverse) {
        const { data: lines, error: linesFetchError } = await (supabase
            .from('journal_entry_lines') as any)
            .select('*')
            .eq('journal_entry_id', entry.id)

        if (linesFetchError || !lines) {
            throw new Error(`Failed to fetch journal entry lines for entry ${entry.id}: ${linesFetchError?.message}`)
        }

        const { data: reversalEntry, error: reversalError } = await (supabase
            .from('journal_entries') as any)
            .insert({
                company_id: companyId,
                date: new Date().toISOString().split('T')[0],
                reference: entry.reference,
                description: `VOID REVERSAL: ${entry.description}`,
                is_system_generated: true,
                source_type: entry.source_type,
                source_id: entry.source_id
            })
            .select()
            .single()

        if (reversalError || !reversalEntry) {
            throw new Error(`Failed to create reversal entry for ${entry.id}: ${reversalError?.message}`)
        }

        const revEntryId = (reversalEntry as any).id

        const reversalLines: any[] = (lines as any[]).map(line => ({
            company_id: companyId,
            journal_entry_id: revEntryId,
            account_id: line.account_id,
            description: `REVERSAL: ${line.description}`,
            debit: line.credit,
            credit: line.debit
        }))

        const { error: linesError } = await (supabase
            .from('journal_entry_lines') as any)
            .insert(reversalLines)

        if (linesError) {
            throw new Error(`Failed to create reversal lines: ${linesError.message}`)
        }
    }

    // 4. Reset Bill amounts and status
    const { error: billUpdateError } = await (supabase
        .from('bills') as any)
        .update({
            amount_paid: 0,
            amount_due: 0,
            status: 'void'
        })
        .eq('id', billId)

    // Re-fetch total to set amount_due correctly
    const { data: billData } = await (supabase.from('bills') as any).select('total').eq('id', billId).single()
    if (billData) {
        await (supabase.from('bills') as any).update({ amount_due: billData.total }).eq('id', billId)
    }

    if (billUpdateError) {
        throw new Error(`Failed to update bill status: ${billUpdateError.message}`)
    }
}

export async function createBillPaymentJournalEntry(
    supabase: SupabaseClient<Database>,
    paymentId: string,
    companyId: string
) {
    const { data, error: paymentError } = await (supabase
        .from('payments') as any)
        .select('*')
        .eq('id', paymentId)
        .single()

    if (paymentError || !data) {
        throw new Error(`Payment not found: ${paymentError?.message}`)
    }

    const payment = data as unknown as PaymentRecord

    const { data: apAccount } = await (supabase
        .from('accounts') as any)
        .select('id')
        .eq('code', '2100')
        .single()

    if (!apAccount) {
        throw new Error('System account 2100 (Accounts Payable) not found')
    }

    const apAccountId = (apAccount as any).id

    const { data: journalEntry, error: jeError } = await (supabase
        .from('journal_entries') as any)
        .insert({
            company_id: companyId,
            date: payment.date,
            reference: payment.reference,
            description: `Bill Payment ${payment.reference || payment.id}`,
            is_system_generated: true,
            source_type: 'payment',
            source_id: payment.id
        })
        .select()
        .single()

    if (jeError || !journalEntry) {
        throw new Error(`Failed to create journal entry: ${jeError?.message}`)
    }

    const jeId = (journalEntry as any).id

    const lines: any[] = [
        {
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: apAccountId,
            description: `A/P reduction for payment: ${payment.reference || ''}`,
            debit: payment.amount,
            credit: 0
        },
        {
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: payment.account_id,
            description: `Payment sent: ${payment.reference || ''}`,
            debit: 0,
            credit: payment.amount
        }
    ]

    const { error: linesError } = await (supabase
        .from('journal_entry_lines') as any)
        .insert(lines)

    if (linesError) {
        throw new Error(`Failed to create payment journal lines: ${linesError.message}`)
    }

    return journalEntry
}

/**
 * Automatically creates a balanced journal entry for a direct expense.
 */
export async function createExpenseJournalEntry(
    supabase: SupabaseClient<Database>,
    expenseId: string,
    companyId: string
) {
    // 1. Fetch expense data
    const { data: expense, error: expenseError } = await (supabase
        .from('expenses') as any)
        .select('*')
        .eq('id', expenseId)
        .single()

    if (expenseError || !expense) {
        throw new Error(`Expense not found: ${expenseError?.message}`)
    }

    if (expense.status === 'void') {
        throw new Error(`Cannot create journal entry for voided expense`)
    }

    // 2. Prepare journal entry
    const { data: journalEntry, error: jeError } = await (supabase
        .from('journal_entries') as any)
        .insert({
            company_id: companyId,
            date: expense.date,
            reference: `EXP-${expense.id.slice(0, 8)}`,
            description: `Expense: ${expense.payee}`,
            is_system_generated: true,
            source_type: 'expense',
            source_id: expense.id
        })
        .select()
        .single()

    if (jeError || !journalEntry) {
        throw new Error(`Failed to create journal entry: ${jeError?.message}`)
    }

    const jeId = (journalEntry as any).id

    // 3. Prepare lines
    const lines: any[] = [
        {
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: expense.expense_account_id,
            description: `Expense: ${expense.payee}`,
            debit: expense.amount,
            credit: 0
        },
        {
            company_id: companyId,
            journal_entry_id: jeId,
            account_id: expense.payment_account_id,
            description: `Payment for: ${expense.payee}`,
            debit: 0,
            credit: expense.amount
        }
    ]

    // 4. Validate Balances
    const totalDebits = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0)
    const totalCredits = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0)

    if (totalDebits !== totalCredits) {
        throw new Error(`Journal entry for expense ${expense.id} is unbalanced. Debits: ${totalDebits}, Credits: ${totalCredits}`)
    }

    // 5. Insert lines
    const { error: linesError } = await (supabase
        .from('journal_entry_lines') as any)
        .insert(lines)

    if (linesError) {
        throw new Error(`Failed to create journal entry lines: ${linesError.message}`)
    }

    return journalEntry
}
