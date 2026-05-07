import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ accountId: string }> }
) {
    const { accountId } = await params;
    const body = await request.json();
    const { reconciliation_id, cleared_line_ids, statement_ending_balance } = body;

    const supabase = await createClient();

    try {
        // 1. Fetch reconciliation record
        const { data: recon, error: reconError } = await (supabase
            .from('reconciliations') as any)
            .select('*')
            .limit(1)
            .maybeSingle();

        if (reconError || !recon) throw new Error('Reconciliation record not found');

        // 2. Fetch lines to validate and sum
        const { data: lines, error: linesError } = await (supabase
            .from('journal_entry_lines') as any)
            .select('id, debit, credit, account_id')
            .in('id', cleared_line_ids);

        if (linesError) throw linesError;

        // Security check: all lines must belong to this account
        if (lines.some((l: any) => l.account_id !== accountId)) {
            return NextResponse.json({ error: 'Security violation: lines do not belong to this account' }, { status: 403 });
        }

        // 3. Fetch account type for balance calculation
        const { data: account } = await (supabase.from('accounts') as any).select('type').eq('id', accountId).limit(1).maybeSingle();
        const isAsset = account?.type === 'asset';

        // 4. Calculate cleared balance accurately
        const clearedBalance = lines.reduce((sum: number, l: any) => {
            const debit = Number(l.debit || 0);
            const credit = Number(l.credit || 0);
            return isAsset ? sum + (debit - credit) : sum + (credit - debit);
        }, 0);

        // 5. Verify difference = statement_ending_balance - cleared_balance = 0
        const difference = Number(statement_ending_balance) - clearedBalance;
        if (difference !== 0) {
            return NextResponse.json({ error: 'Reconciliation does not balance' }, { status: 400 });
        }

        // 6. Calculate total book balance as of the statement date
        // Step 6a: get journal_entry_ids filtered by date
        const { data: jeIds, error: jeError } = await (supabase
            .from('journal_entries') as any)
            .select('id')
            .lte('date', recon.statement_date);

        if (jeError) throw jeError;

        const ids = (jeIds || []).map((j: any) => j.id);

        // Step 6b: fetch lines for this account within those entries
        const { data: allLinesAtDate, error: totalError } = await (supabase
            .from('journal_entry_lines') as any)
            .select('debit, credit')
            .eq('account_id', accountId)
            .in('journal_entry_id', ids);
        
        if (totalError) throw totalError;

        const bookBalanceAtDate = (allLinesAtDate || []).reduce((sum: number, l: any) => {
            const debit = Number(l.debit || 0);
            const credit = Number(l.credit || 0);
            return isAsset ? sum + (debit - credit) : sum + (credit - debit);
        }, 0);

        // 7. Perform updates within a single Postgres transaction via RPC
        const { data: completedRecon, error: rpcError } = await (supabase as any).rpc('complete_reconciliation', {
            p_reconciliation_id: reconciliation_id,
            p_cleared_line_ids: cleared_line_ids,
            p_cleared_balance: clearedBalance,
            p_book_balance: bookBalanceAtDate
        });

        if (rpcError) throw rpcError;

        return NextResponse.json(completedRecon);

    } catch (error: any) {
        console.error('Error in complete reconciliation API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
