'use client'

import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExpenseTable } from '@/components/expenses/ExpenseTable'
import { ExpenseSheet } from '@/components/expenses/ExpenseSheet'
import { useUserRole } from '@/hooks/useUserRole'

export default function ExpensesPage() {
    const supabase = createClient()
    const { isViewer } = useUserRole()
    const [expenses, setExpenses] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedExpense, setSelectedExpense] = useState<any>(null)

    const loadData = async () => {
        setLoading(true)
        try {
            const [
                { data: expData },
                { data: accData }
            ] = await Promise.all([
                supabase
                    .from('expenses')
                    .select('*')
                    .order('date', { ascending: false }),
                supabase
                    .from('accounts')
                    .select('id, name, code, sub_type')
                    .eq('is_active', true)
            ])

            setExpenses(expData || [])
            setAccounts(accData || [])
        } catch (error) {
            console.error('Error loading expenses:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [supabase])

    const handleNewExpense = () => {
        setSelectedExpense(null)
        setIsSheetOpen(true)
    }

    const handleEditExpense = (expense: any) => {
        setSelectedExpense(expense)
        setIsSheetOpen(true)
    }

    const handleSheetOpenChange = (open: boolean) => {
        setIsSheetOpen(open)
        if (!open) {
            setSelectedExpense(null)
            loadData() // Reload on close to catch any changes
        }
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
                    <p className="text-muted-foreground">
                        Record and manage direct business expenses.
                    </p>
                </div>
                {!isViewer && (
                    <Button onClick={handleNewExpense}>
                        <Plus className="mr-2 h-4 w-4" /> New Expense
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading expenses...</div>
            ) : (
                <ExpenseTable
                    expenses={expenses}
                    accounts={accounts}
                    onRowClick={handleEditExpense}
                />
            )}

            <ExpenseSheet
                key={selectedExpense?.id || 'new'} // Force re-render on new/edit switch
                open={isSheetOpen}
                onOpenChange={handleSheetOpenChange}
                expense={selectedExpense}
                accounts={accounts}
            />
        </div>
    )
}
