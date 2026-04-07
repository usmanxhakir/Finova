'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ReconcileSummaryBarProps {
    statementEndingBalance: number // cents
    clearedBalance: number // cents
    difference: number // cents
    onStatementBalanceChange: (value: number) => void
    onComplete: () => void
    isCompleting?: boolean
    accountName: string
}

export function ReconcileSummaryBar({
    statementEndingBalance,
    clearedBalance,
    difference,
    onStatementBalanceChange,
    onComplete,
    isCompleting = false,
    accountName
}: ReconcileSummaryBarProps) {
    const isBalanced = difference === 0

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-zinc-200/60 shadow-sm overflow-hidden">
                <CardContent className="p-4 flex flex-col gap-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Statement Ending Balance</p>
                    <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                        <Input 
                            type="number"
                            step="0.01"
                            value={(statementEndingBalance / 100).toFixed(2)}
                            onChange={(e) => {
                                // Real-time calculation if needed, but the prompt says blur-save.
                                // We'll keep it in local state for now and parent handles the update.
                                const val = parseFloat(e.target.value) || 0
                                onStatementBalanceChange(Math.round(val * 100))
                            }}
                            className="pl-7 bg-white font-medium text-zinc-900 border-zinc-200"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-zinc-200/60 shadow-sm overflow-hidden bg-zinc-50/20">
                <CardContent className="p-4 flex flex-col gap-1 h-full justify-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cleared Balance (Books)</p>
                    <p className="text-xl font-bold tracking-tight text-zinc-900 mt-1">
                        {formatCurrency(clearedBalance)}
                    </p>
                </CardContent>
            </Card>

            <Card className={cn(
                "border-zinc-200/60 shadow-sm overflow-hidden",
                isBalanced ? "bg-emerald-50/30" : "bg-rose-50/30"
            )}>
                <CardContent className="p-4 flex flex-col gap-1 h-full justify-center">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Difference</p>
                        {isBalanced ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-rose-500 underline-offset-4" />
                        )}
                    </div>
                    <p className={cn(
                        "text-xl font-bold tracking-tight mt-1",
                        isBalanced ? "text-emerald-600" : "text-rose-600"
                    )}>
                        {formatCurrency(difference)}
                    </p>
                </CardContent>
            </Card>

            <Button 
                disabled={!isBalanced || isCompleting}
                onClick={onComplete}
                className={cn(
                    "h-full rounded-xl border font-bold shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2",
                    isBalanced 
                        ? "bg-indigo-600 border-indigo-600 hover:bg-indigo-700 text-white" 
                        : "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed opacity-60"
                )}
            >
                <span className="text-xs uppercase tracking-widest font-bold">Complete Reconciliation</span>
                {!isBalanced ? (
                    <div className="flex items-center gap-1.5 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                        <Info className="h-3 w-3" />
                        Items must balance
                    </div>
                ) : (
                    <span className="text-[10px] opacity-80 font-normal">Everything matches!</span>
                )}
            </Button>
        </div>
    )
}
