'use client'

import React from 'react'
import Link from 'next/link'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Loader2, ExternalLink } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useReconciliationLines } from '@/hooks/useReconciliation'

interface BankingTransactionListProps {
    accountId: string
    accountName: string
}

export function BankingTransactionList({ accountId, accountName }: BankingTransactionListProps) {
    const { lines, isLoading, error } = useReconciliationLines(accountId)

    // Only show uncleared lines as per requirement "show that account's uncleared transactions"
    const unclearedLines = lines.filter(l => !l.is_cleared)

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 border border-zinc-100 rounded-2xl bg-zinc-50/10">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-sm text-zinc-500 font-medium font-mono">Fetching transactions...</p>
            </div>
        )
    }

    return (
        <div className="mt-8 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between px-2">
                <div>
                    <h3 className="text-lg font-bold text-zinc-900 italic">Review Transactions</h3>
                    <p className="text-xs text-zinc-500 font-medium font-mono">Showing {unclearedLines.length} uncleared items for {accountName}</p>
                </div>
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg border-none px-6">
                    <Link href={`/banking/${accountId}`}>
                        Reconcile this account
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>

            <div className="rounded-2xl border border-zinc-200/60 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-zinc-50/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Date</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Description</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Reference</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Debit</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Credit</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-center">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {unclearedLines.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-zinc-400 text-sm italic">
                                    No uncleared transactions found for this account.
                                </TableCell>
                            </TableRow>
                        ) : (
                            unclearedLines.map((line) => (
                                <TableRow key={line.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <TableCell className="py-3 text-xs font-medium text-zinc-600">
                                        {formatDate(line.journal_entries.date)}
                                    </TableCell>
                                    <TableCell className="py-3 text-xs text-zinc-900 font-semibold max-w-[250px] truncate">
                                        {line.journal_entries.description}
                                    </TableCell>
                                    <TableCell className="py-3 text-[10px] text-zinc-400 font-mono">
                                        {line.journal_entries.reference || '-'}
                                    </TableCell>
                                    <TableCell className="py-3 text-xs text-right font-bold text-zinc-700">
                                        {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                    </TableCell>
                                    <TableCell className="py-3 text-xs text-right font-bold text-rose-600">
                                        {line.credit > 0 ? `(${formatCurrency(line.credit)})` : '-'}
                                    </TableCell>
                                    <TableCell className="py-3 text-center">
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase tracking-tighter">Uncleared</Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <div className="flex justify-center mt-2">
                <Button variant="ghost" size="sm" asChild className="text-zinc-400 hover:text-indigo-600">
                    <Link href={`/reports/transactions?account_id=${accountId}`}>
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Full Transaction Report
                    </Link>
                </Button>
            </div>
        </div>
    )
}
