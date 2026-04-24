import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type PrefixType = 'invoice_prefix' | 'bill_prefix' | 'expense_prefix'
type TableType = 'invoices' | 'bills' | 'expenses'

async function generateNumber(
    supabase: SupabaseClient<Database>,
    table: TableType,
    prefixKey: PrefixType
): Promise<string> {
    // 1. Fetch prefix from companies
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select(prefixKey)
        .single()

    if (companyError || !company) {
        throw new Error(`Failed to fetch company prefix: ${companyError?.message}`)
    }

    const prefix = (company as any)[prefixKey] || (prefixKey === 'invoice_prefix' ? 'INV-' : prefixKey === 'bill_prefix' ? 'BILL-' : 'EXP-')

    // 2. Query table for highest existing number with this prefix
    // We fetch the numbers and do the parsing in JS because complex regex/substring in SQL is harder across Supabase/Postgres via JS client for this specific case
    const { data: records, error: recordsError } = await supabase
        .from(table)
        .select('number')
        .like('number', `${prefix}%`)

    if (recordsError) {
        throw new Error(`Failed to fetch existing numbers from ${table}: ${recordsError.message}`)
    }

    let maxSuffix = 0
    if (records && records.length > 0) {
        records.forEach((record: any) => {
            const suffixStr = record.number.replace(prefix, '')
            const suffix = parseInt(suffixStr, 10)
            if (!isNaN(suffix) && suffix > maxSuffix) {
                maxSuffix = suffix
            }
        })
    }

    const nextSuffix = maxSuffix + 1
    return `${prefix}${nextSuffix.toString().padStart(4, '0')}`
}

export async function generateInvoiceNumber(supabase: SupabaseClient<Database>): Promise<string> {
    return generateNumber(supabase, 'invoices', 'invoice_prefix')
}

export async function generateBillNumber(supabase: SupabaseClient<Database>): Promise<string> {
    return generateNumber(supabase, 'bills', 'bill_prefix')
}

export async function generateExpenseNumber(supabase: SupabaseClient<Database>): Promise<string> {
    return generateNumber(supabase, 'expenses', 'expense_prefix')
}
