'use client'

import React from 'react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ReconcileLineRowProps {
    line: {
        id: string
        journal_entries: {
            date: string
            description: string | null
            reference: string | null
        }
        debit: number
        credit: number
        is_cleared: boolean
        reconciliation_id?: string | null
    }
    isSelected?: boolean
    onToggle?: (id: string) => void
    isReadOnly?: boolean
    isPrior?: boolean
}

export function ReconcileLineRow({ 
    line, 
    isSelected, 
    onToggle, 
    isReadOnly = false,
    isPrior = false
}: ReconcileLineRowProps) {
    const debit = Number(line.debit || 0)
    const credit = Number(line.credit || 0)

    return (
        <TableRow className={cn(
            "transition-colors",
            isSelected && "bg-indigo-50/50",
            isPrior && "opacity-60 bg-zinc-50/50"
        )}>
            <TableCell className="w-12 text-center p-2">
                {!isReadOnly ? (
                    <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => onToggle?.(line.id)}
                        className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                ) : (
                    <div className="flex justify-center">
                        {isPrior && <Badge variant="outline" className="text-[9px] uppercase tracking-tighter px-1 h-4 bg-zinc-100 text-zinc-500 border-zinc-200">Prior</Badge>}
                        {!isPrior && <div className="w-4 h-4 rounded-sm border border-zinc-200 bg-zinc-50" />}
                    </div>
                )}
            </TableCell>
            <TableCell className="py-2 text-xs font-medium text-zinc-600">
                {formatDate(line.journal_entries.date)}
            </TableCell>
            <TableCell className="py-2 text-xs max-w-[200px] truncate" title={line.journal_entries.description || ''}>
                {line.journal_entries.description}
            </TableCell>
            <TableCell className="py-2 text-xs text-zinc-400 font-mono">
                {line.journal_entries.reference || '-'}
            </TableCell>
            <TableCell className="py-2 text-xs text-right font-medium text-zinc-700">
                {debit > 0 ? formatCurrency(debit) : '-'}
            </TableCell>
            <TableCell className="py-2 text-xs text-right font-medium text-rose-600">
                {credit > 0 ? `(${formatCurrency(credit)})` : '-'}
            </TableCell>
        </TableRow>
    )
}
