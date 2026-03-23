
'use client'

import { Button } from '@/components/ui/button'
import { Plus, Receipt, CreditCard, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ExpenseSheet } from '@/components/expenses/ExpenseSheet'
import { useUserRole } from '@/hooks/useUserRole'

interface ActionProps {
    accounts: any[]
}

export function DashboardActions({ accounts }: ActionProps) {
    const { isViewer } = useUserRole()
    const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false)

    if (isViewer) return null

    return (
        <>
            <div className="flex items-center gap-3">
                <Button asChild variant="outline" className="border-2 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600 font-bold transition-all duration-300">
                    <Link href="/invoices/new">
                        <Receipt className="mr-2 h-4 w-4" /> New Invoice
                    </Link>
                </Button>
                <Button asChild variant="outline" className="border-2 border-rose-100 hover:bg-rose-50 hover:text-rose-600 font-bold transition-all duration-300">
                    <Link href="/bills/new">
                        <CreditCard className="mr-2 h-4 w-4" /> New Bill
                    </Link>
                </Button>
                <Button
                    onClick={() => setIsExpenseSheetOpen(true)}
                    variant="outline"
                    className="border-2 border-amber-100 hover:bg-amber-50 hover:text-amber-600 font-bold transition-all duration-300"
                >
                    <Wallet className="mr-2 h-4 w-4" /> New Expense
                </Button>
            </div>

            <ExpenseSheet
                open={isExpenseSheetOpen}
                onOpenChange={setIsExpenseSheetOpen}
                accounts={accounts}
            />
        </>
    )
}
