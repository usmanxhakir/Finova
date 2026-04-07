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

interface ClearedEntriesPanelProps {
    lines: any[]
    currentReconciliationId: string | null
    isLoading?: boolean
}

export function ClearedEntriesPanel({
    lines,
    currentReconciliationId,
    isLoading = false
}: ClearedEntriesPanelProps) {
    const totalCleared = lines
        .reduce((sum, l) => sum + (Number(l.debit || 0) - Number(l.credit || 0)), 0)

    return (
        <Card className="flex flex-col h-full border-zinc-200/60 shadow-sm overflow-hidden min-h-[500px]">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-900">Previously cleared / statement reference</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-zinc-200">
                {lines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <p className="text-zinc-400 text-sm italic">No cleared transactions for this account yet.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-zinc-50/30 sticky top-0 z-10">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-12 text-center text-[10px] uppercase font-bold text-zinc-400 font-mono">P</TableHead>
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
                                    isSelected={true}
                                    isReadOnly={true}
                                    isPrior={line.reconciliation_id !== currentReconciliationId && line.reconciliation_id !== null}
                                />
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
            <CardFooter className="bg-zinc-50/50 border-t border-zinc-100 py-3 px-4">
                <div className="flex items-center justify-between w-full text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <span>{lines.length} items cleared</span>
                    <span className="text-zinc-900 font-bold">
                        Cleared Total: {formatCurrency(Math.abs(totalCleared))} {totalCleared < 0 ? '(Cr)' : '(Dr)'}
                    </span>
                </div>
            </CardFooter>
        </Card>
    )
}
