'use client'

import React, { useState } from 'react'
import { useReconciliationAccounts } from '@/hooks/useReconciliation'
import { BankingAccountCard } from '@/components/banking/BankingAccountCard'
import { BankingTransactionList } from '@/components/banking/BankingTransactionList'
import { Loader2, Plus, Landmark, PiggyBank } from 'lucide-react'

export default function BankingPage() {
    const { accounts, isLoading, error } = useReconciliationAccounts()
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

    const selectedAccount = accounts.find(a => a.id === selectedAccountId)

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <p className="text-zinc-500 animate-pulse font-medium font-mono">Opening your vault...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 p-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Landmark className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 bg-gradient-to-r from-zinc-900 to-zinc-500 bg-clip-text text-transparent italic">
                            Banking
                        </h1>
                        <p className="text-zinc-500 font-medium font-mono uppercase tracking-widest text-[10px]">Review and reconcile your finances</p>
                    </div>
                </div>
            </div>

            {/* Account Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center text-center gap-4 bg-white rounded-3xl border border-dashed border-zinc-200 shadow-sm">
                        <div className="p-4 bg-zinc-50 rounded-full">
                            <Plus className="h-8 w-8 text-zinc-300" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-bold text-zinc-900">No banking accounts found</p>
                            <p className="text-zinc-500 text-sm max-w-xs font-mono">Create an asset account with sub-type 'Bank' or 'Cash' to get started.</p>
                        </div>
                    </div>
                ) : (
                    accounts.map((account) => (
                        <BankingAccountCard 
                            key={account.id} 
                            account={account} 
                            isActive={selectedAccountId === account.id}
                            onSelect={setSelectedAccountId}
                        />
                    ))
                )}
            </div>

            {/* Inline Transaction List */}
            {selectedAccountId ? (
                <BankingTransactionList 
                    key={selectedAccountId}
                    accountId={selectedAccountId} 
                    accountName={selectedAccount?.name || ''} 
                />
            ) : accounts.length > 0 && (
                <div className="mt-12 flex flex-col items-center justify-center py-24 rounded-[2rem] bg-zinc-50/50 border border-dashed border-zinc-200">
                    <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                        <PiggyBank className="h-10 w-10 text-indigo-200 animate-bounce" />
                    </div>
                    <p className="text-zinc-400 text-sm italic font-medium px-8 text-center">Select your main checking or cash account to review uncleared transactions.</p>
                </div>
            )}
        </div>
    )
}
