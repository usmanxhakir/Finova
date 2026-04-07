import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { format, differenceInDays } from 'date-fns';

export async function GET() {
    const supabase = await createClient();

    try {
        // 1. Fetch eligible accounts
        const { data: accounts, error: accError } = await (supabase
            .from('accounts') as any)
            .select('*')
            .in('sub_type', ['bank', 'cash', 'credit_card'])
            .eq('is_active', true);

        if (accError) throw accError;

        // 2. Fetch all journal entry lines for these accounts to calculate balances and counts
        const accountIds = (accounts || []).map((a: any) => a.id);
        
        const { data: lines, error: linesError } = await (supabase
            .from('journal_entry_lines') as any)
            .select('account_id, debit, credit, is_cleared')
            .in('account_id', accountIds);

        if (linesError) throw linesError;

        // 3. Fetch last completed reconciliation for each account
        const { data: lastRecons, error: reconError } = await (supabase
            .from('reconciliations') as any)
            .select('account_id, statement_date, status')
            .in('account_id', accountIds)
            .eq('status', 'completed')
            .order('statement_date', { ascending: false });

        if (reconError) throw reconError;

        // Group last reconciliations by account
        const lastReconMap: Record<string, any> = {};
        (lastRecons || []).forEach((r: any) => {
            if (!lastReconMap[r.account_id]) {
                lastReconMap[r.account_id] = r;
            }
        });

        // 4. Process data
        const results = (accounts || []).map((acc: any) => {
            const accLines = (lines || []).filter((l: any) => l.account_id === acc.id);
            
            // Calculate book balance
            let bookBalance = 0;
            accLines.forEach((l: any) => {
                const debit = Number(l.debit || 0);
                const credit = Number(l.credit || 0);
                
                // Asset (bank, cash): D - C
                // Liability (credit_card): C - D
                if (acc.type === 'asset') {
                    bookBalance += (debit - credit);
                } else {
                    bookBalance += (credit - debit);
                }
            });

            // Calculate unreconciled count
            const unreconciledCount = accLines.filter((l: any) => !l.is_cleared).length;

            // Get last reconciliation info
            const lastRecon = lastReconMap[acc.id];
            const lastDate = lastRecon ? lastRecon.statement_date : null;
            
            // Determine status
            let statusBadge = 'up_to_date';
            let daysSince = lastDate ? differenceInDays(new Date(), new Date(lastDate)) : 999;

            if (daysSince > 90 || !lastDate) {
                statusBadge = 'overdue';
            } else if (daysSince > 35 || unreconciledCount > 0) {
                statusBadge = 'needs_attention';
            }

            return {
                ...acc,
                book_balance: bookBalance,
                unreconciled_count: unreconciledCount,
                last_reconciled_date: lastDate,
                status_badge: statusBadge
            };
        });

        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Error in reconciliation accounts API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
