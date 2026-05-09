'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { 
    CreditCard, 
    Receipt, 
    TrendingUp, 
    TrendingDown,
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createClient } from '@/lib/supabase/client'

// Date range helper
function getDateRange(period: string): { start: string; end: string; label: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (period) {
    case 'this_month':
      return {
        start: new Date(year, month, 1).toISOString().split('T')[0],
        end: new Date(year, month + 1, 0).toISOString().split('T')[0],
        label: 'THIS MONTH'
      }
    case 'last_month':
      return {
        start: new Date(year, month - 1, 1).toISOString().split('T')[0],
        end: new Date(year, month, 0).toISOString().split('T')[0],
        label: 'LAST MONTH'
      }
    case 'last_quarter': {
      const qEnd = new Date(year, month, 0)
      const qStart = new Date(year, month - 3, 1)
      return {
        start: qStart.toISOString().split('T')[0],
        end: qEnd.toISOString().split('T')[0],
        label: 'LAST QUARTER'
      }
    }
    case 'last_6_months': {
      const start = new Date(year, month - 6, 1)
      return {
        start: start.toISOString().split('T')[0],
        end: new Date(year, month + 1, 0).toISOString().split('T')[0],
        label: 'LAST 6 MONTHS'
      }
    }
    case 'this_year':
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: 'THIS YEAR'
      }
    default:
      return getDateRange('this_month')
  }
}

interface KPIProps {
    totalAR: number
    totalAP: number
    revenueThisMonth: number
    expensesThisMonth: number
}

export function DashboardKPIs({ totalAR, totalAP, revenueThisMonth, expensesThisMonth }: KPIProps) {
    const supabase = createClient()
    
    const [revenuePeriod, setRevenuePeriod] = useState('this_month')
    const [expensePeriod, setExpensePeriod] = useState('this_month')
    
    const [revenueValue, setRevenueValue] = useState(revenueThisMonth)
    const [expenseValue, setExpenseValue] = useState(expensesThisMonth)
    
    const [isRevenueLoading, setIsRevenueLoading] = useState(false)
    const [isExpenseLoading, setIsExpenseLoading] = useState(false)

    // Fetch Revenue
    useEffect(() => {
        // Skip initial fetch if matching default
        if (revenuePeriod === 'this_month' && revenueValue === revenueThisMonth) return;
        
        async function fetchRevenue() {
            setIsRevenueLoading(true)
            const { start, end } = getDateRange(revenuePeriod)
            
            const { data } = await supabase
                .from('journal_entry_lines')
                .select(`
                    debit, 
                    credit, 
                    accounts!inner(type), 
                    journal_entries!inner(date)
                `)
                .eq('accounts.type', 'revenue')
                .gte('journal_entries.date', start)
                .lte('journal_entries.date', end)
            
            let total = 0
            data?.forEach((line: any) => {
                const debit = Number(line.debit) || 0
                const credit = Number(line.credit) || 0
                total += (credit - debit)
            })
            setRevenueValue(total)
            setIsRevenueLoading(false)
        }
        fetchRevenue()
    }, [revenuePeriod])

    // Fetch Expenses
    useEffect(() => {
        // Skip initial fetch if matching default
        if (expensePeriod === 'this_month' && expenseValue === expensesThisMonth) return;
        
        async function fetchExpenses() {
            setIsExpenseLoading(true)
            const { start, end } = getDateRange(expensePeriod)
            
            const { data } = await supabase
                .from('journal_entry_lines')
                .select(`
                    debit, 
                    credit, 
                    accounts!inner(type), 
                    journal_entries!inner(date)
                `)
                .eq('accounts.type', 'expense')
                .gte('journal_entries.date', start)
                .lte('journal_entries.date', end)
            
            let total = 0
            data?.forEach((line: any) => {
                const debit = Number(line.debit) || 0
                const credit = Number(line.credit) || 0
                total += (debit - credit)
            })
            setExpenseValue(total)
            setIsExpenseLoading(false)
        }
        fetchExpenses()
    }, [expensePeriod])

    const revRange = getDateRange(revenuePeriod)
    const expRange = getDateRange(expensePeriod)

    const kpis = [
        {
            title: 'Total Outstanding A/R',
            value: totalAR,
            icon: Receipt,
            description: 'Unpaid customer invoices',
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            border: 'border-indigo-100',
            type: 'ar'
        },
        {
            title: 'Total Outstanding A/P',
            value: totalAP,
            icon: CreditCard,
            description: 'Unpaid vendor bills',
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            border: 'border-rose-100',
            type: 'ap'
        },
        {
            title: `Revenue ${revRange.label}`,
            value: revenueValue,
            icon: TrendingUp,
            description: `Total sales ${revRange.label.toLowerCase()}`,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
            type: 'revenue',
            period: revenuePeriod,
            setPeriod: setRevenuePeriod,
            loading: isRevenueLoading
        },
        {
            title: `Expenses ${expRange.label}`,
            value: expenseValue,
            icon: TrendingDown,
            description: `Total costs ${expRange.label.toLowerCase()}`,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
            type: 'expense',
            period: expensePeriod,
            setPeriod: setExpensePeriod,
            loading: isExpenseLoading
        }
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi) => (
                <Card key={kpi.title} className={`border-2 ${kpi.border} shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">{kpi.title}</CardTitle>
                        <div className="flex items-center gap-2">
                            {(kpi.type === 'revenue' || kpi.type === 'expense') && (
                                <Select value={kpi.period} onValueChange={kpi.setPeriod}>
                                    <SelectTrigger className="h-7 w-[110px] text-[10px] font-bold bg-white border-zinc-200 focus:ring-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="this_month" className="text-xs">This Month</SelectItem>
                                        <SelectItem value="last_month" className="text-xs">Last Month</SelectItem>
                                        <SelectItem value="last_quarter" className="text-xs">Last Quarter</SelectItem>
                                        <SelectItem value="last_6_months" className="text-xs">Last 6 Months</SelectItem>
                                        <SelectItem value="this_year" className="text-xs">This Year</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform duration-300`}>
                                <kpi.icon className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {kpi.loading ? (
                            <div className="animate-pulse bg-gray-100 rounded h-8 w-32 my-1" />
                        ) : (
                            <div className={`text-2xl font-black tabular-nums ${kpi.color}`}>
                                {formatCurrency(kpi.value)}
                            </div>
                        )}
                        <p className="text-xs text-zinc-400 mt-1 font-medium">
                            {kpi.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
