'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Landmark, Wallet, CreditCard, History } from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface BankingAccountCardProps {
    account: {
        id: string
        name: string
        sub_type: string
        book_balance: number
        unreconciled_count: number
        last_reconciled_date: string | null
        status_badge: 'up_to_date' | 'needs_attention' | 'overdue'
    }
    isActive?: boolean
    onSelect?: (id: string) => void
}

export function BankingAccountCard({ account, isActive, onSelect }: BankingAccountCardProps) {
    const getIcon = () => {
        switch (account.sub_type) {
            case 'bank': return <Landmark className="h-5 w-5 text-blue-600" />
            case 'cash': return <Wallet className="h-5 w-5 text-emerald-600" />
            case 'credit_card': return <CreditCard className="h-5 w-5 text-purple-600" />
            default: return <Landmark className="h-5 w-5 text-zinc-600" />
        }
    }

    const getStatusBadge = () => {
        switch (account.status_badge) {
            case 'up_to_date':
                return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Up to date</Badge>
            case 'needs_attention':
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Needs attention</Badge>
            case 'overdue':
                return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Overdue</Badge>
            default:
                return null
        }
    }

    return (
        <Card 
            onClick={() => onSelect?.(account.id)}
            className={cn(
                "hover:shadow-md transition-all duration-200 border-zinc-200/60 overflow-hidden flex flex-col h-full cursor-pointer group",
                isActive && "ring-2 ring-indigo-500 shadow-lg border-transparent px-4 py-2 mt-[-8px] mb-[-8px]",
            )}
        >
            <CardHeader className="pb-3 border-b border-zinc-50 bg-zinc-50/30">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border border-zinc-100 shadow-sm group-hover:scale-110 transition-transform">
                            {getIcon()}
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold text-zinc-900">{account.name}</CardTitle>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{account.sub_type.replace('_', ' ')}</span>
                        </div>
                    </div>
                    {getStatusBadge()}
                </div>
            </CardHeader>
            <CardContent className="pt-5 pb-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Book Balance</p>
                        <p className={cn(
                            "text-lg font-bold tracking-tight",
                            account.book_balance < 0 ? "text-rose-600" : "text-zinc-900"
                        )}>
                            {formatCurrency(account.book_balance)}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Uncleared</p>
                        <p className={cn(
                            "text-lg font-bold tracking-tight",
                            account.unreconciled_count > 0 ? "text-amber-600" : "text-zinc-900"
                        )}>
                            {account.unreconciled_count} <span className="text-xs font-normal text-zinc-500 font-mono">items</span>
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500 font-mono">
                    <History className="h-3.5 w-3.5" />
                    <span>Last reconciled: {account.last_reconciled_date ? formatDate(account.last_reconciled_date) : 'Never'}</span>
                </div>
            </CardContent>
        </Card>
    )
}
