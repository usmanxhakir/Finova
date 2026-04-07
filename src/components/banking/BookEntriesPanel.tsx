'use client'

import React from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { ReconcileLineRow } from './ReconcileLineRow'
import { formatCurrency } from '@/lib/utils'

interface BookEntriesPanelProps {
    lines: any[]
    selectedIds: Set<string>
    onToggleLine: (id: string) => void
    isLoading?: boolean
}

export function BookEntriesPanel({
    lines,
    selectedIds,
    onToggleLine,
    isLoading = false
}: BookEntriesPanelProps) {
    const selectedCount = selectedIds.size
    const totalSelected = lines
        .filter(l => selectedIds.has(l.id))
        .reduce((sum, l) => {
            // For bookkeeping: Debit (+) - Credit (-)
            // Wait, this is for the "Cleared Balance" calculation eventually.
            // But here the user just says "Total: $Y".
            // Usually this is the sum of amounts.
            // We'll calculate the sum of (Debit - Credit) to keep it consistent with the balance.
            return sum + (Number(l.debit || 0) - Number(l.credit || 0))
        }, 0)

    return (
        <Card className="flex flex-col h-full border-zinc-200/60 shadow-sm overflow-hidden min-h-[500px]">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-900">Book entries (uncleared)</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-zinc-200">
                {lines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <p className="text-zinc-400 text-sm italic">No transactions recorded for this account yet.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-zinc-50/30 sticky top-0 z-10">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Date</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Description</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ref</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Debit (+)</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Credit (-)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lines.map((line) => (
                                <ReconcileLineRow 
                                    key={line.id}
                                    line={line}
                                    isSelected={selectedIds.has(line.id)}
                                    onToggle={onToggleLine}
                                />
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
            <CardFooter className="bg-zinc-50/50 border-t border-zinc-100 py-3 px-4">
                <div className="flex items-center justify-between w-full text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <span>{selectedCount} items selected</span>
                    <span className="text-zinc-900 font-bold">
                        Total: {formatCurrency(Math.abs(totalSelected))} {totalSelected < 0 ? '(Cr)' : '(Dr)'}
                    </span>
                </div>
            </CardFooter>
        </Card>
    )
}
