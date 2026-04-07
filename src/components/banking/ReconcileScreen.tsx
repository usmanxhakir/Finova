'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useReconciliationLines, useStartReconciliation, useCompleteReconciliation } from '@/hooks/useReconciliation'
import { ReconcileSummaryBar } from './ReconcileSummaryBar'
import { BookEntriesPanel } from './BookEntriesPanel'
import { ClearedEntriesPanel } from './ClearedEntriesPanel'
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ReconcileScreenProps {
    accountId: string
    account: any // Account details passed from page
}

export function ReconcileScreen({ accountId, account }: ReconcileScreenProps) {
    const router = useRouter()
    
    // State
    const [statementEndingBalance, setStatementEndingBalance] = useState(0)
    const [clearedLineIds, setClearedLineIds] = useState<Set<string>>(new Set())
    const [reconciliation, setReconciliation] = useState<any>(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isInitialLoading, setIsInitialLoading] = useState(true)

    // Hooks
    const { lines, isLoading: isLoadingLines, refetch: refetchLines } = useReconciliationLines(accountId)
    const { start, isLoading: isStarting } = useStartReconciliation()
    const { complete, isLoading: isCompleting } = useCompleteReconciliation()

    // Initialize reconciliation session
    useEffect(() => {
        const init = async () => {
            try {
                // We'll use a standard statement date for new sessions (today)
                // or the API handles existing session
                const recon = await start(accountId, {
                    statement_date: new Date().toISOString().split('T')[0],
                    statement_ending_balance: 0 // Will be updated by user
                })
                setReconciliation(recon)
                setStatementEndingBalance(Number(recon.statement_ending_balance || 0))
            } catch (err) {
                console.error(err)
            } finally {
                setIsInitialLoading(false)
            }
        }
        init()
    }, [accountId, start])

    // Derived Data
    const unclearedLines = useMemo(() => lines.filter(l => !l.is_cleared), [lines])
    const clearedLines = useMemo(() => lines.filter(l => l.is_cleared), [lines])

    const clearedBalance = useMemo(() => {
        const isAsset = account?.type === 'asset'
        const selectedLinesRaw = unclearedLines.filter(l => clearedLineIds.has(l.id))
        
        let sum = 0
        selectedLinesRaw.forEach(l => {
            if (isAsset) {
                sum += (Number(l.debit || 0) - Number(l.credit || 0))
            } else {
                sum += (Number(l.credit || 0) - Number(l.debit || 0))
            }
        })
        return sum
    }, [unclearedLines, clearedLineIds, account])

    const difference = useMemo(() => {
        return statementEndingBalance - clearedBalance
    }, [statementEndingBalance, clearedBalance])

    // Handlers
    const handleToggleLine = (id: string) => {
        setClearedLineIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleComplete = async () => {
        if (!reconciliation) return
        try {
            await complete(accountId, {
                reconciliation_id: reconciliation.id,
                cleared_line_ids: Array.from(clearedLineIds)
            })
            router.push('/banking')
        } catch (err) {
            // Error handled in hook toast
        } finally {
            setIsConfirmOpen(false)
        }
    }

    if (isInitialLoading || !account) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <p className="text-zinc-500 animate-pulse font-medium font-mono uppercase tracking-widest text-xs">Initializing Session...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.back()}
                        className="rounded-full hover:bg-white hover:shadow-sm"
                    >
                        <ArrowLeft className="h-5 w-5 text-zinc-600" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 italic">Reconcile: {account.name}</h1>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest font-mono">Banking / {accountId.slice(0, 8)}</p>
                    </div>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchLines()}
                    disabled={isLoadingLines}
                    className="bg-white"
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingLines && "animate-spin")} />
                    Refresh Items
                </Button>
            </div>

            {/* Summary Bar */}
            <ReconcileSummaryBar 
                statementEndingBalance={statementEndingBalance}
                clearedBalance={clearedBalance}
                difference={difference}
                onStatementBalanceChange={setStatementEndingBalance}
                onComplete={() => setIsConfirmOpen(true)}
                isCompleting={isCompleting}
                accountName={account.name}
            />

            {/* Main Content: Two Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-start">
                <BookEntriesPanel 
                    lines={unclearedLines}
                    selectedIds={clearedLineIds}
                    onToggleLine={handleToggleLine}
                    isLoading={isLoadingLines}
                />
                <ClearedEntriesPanel 
                    lines={clearedLines}
                    currentReconciliationId={reconciliation?.id}
                    isLoading={isLoadingLines}
                />
            </div>

            {/* Confirmation Dialog */}
            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent className="bg-white rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-zinc-900 italic">Ready to finish?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-500">
                            You are about to complete the reconciliation for <span className="font-bold text-zinc-900">{account.name}</span>. 
                            This will mark {clearedLineIds.size} transactions as cleared. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="rounded-xl border-zinc-200">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleComplete}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md border-none"
                        >
                            Complete Reconciliation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
