'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { DashboardRecentActivity } from '@/components/dashboard/DashboardRecentActivity'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SlidersHorizontal } from 'lucide-react'

export default function DashboardPage() {
    const supabase = createClient()
    
    const [showRevenueChart, setShowRevenueChart] = useState(true)
    const [showExpenseChart, setShowExpenseChart] = useState(true)
    
    const [dashboardData, setDashboardData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Persist to localStorage
    useEffect(() => {
        const saved = localStorage.getItem('dashboard_chart_visibility')
        if (saved) {
            try {
                const { revenue, expense } = JSON.parse(saved)
                setShowRevenueChart(revenue ?? true)
                setShowExpenseChart(expense ?? true)
            } catch {}
        }
    }, [])

    useEffect(() => {
        localStorage.setItem('dashboard_chart_visibility', JSON.stringify({
            revenue: showRevenueChart,
            expense: showExpenseChart
        }))
    }, [showRevenueChart, showExpenseChart])

    useEffect(() => {
        async function fetchDashboardData() {
            setIsLoading(true)
            
            try {
                // 1. Fetch Outstanding A/R & A/P
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('amount_due')
                    .neq('status', 'void')

                const { data: bills } = await supabase
                    .from('bills')
                    .select('amount_due')
                    .neq('status', 'void')

                const totalAR = (invoices as any)?.reduce((sum: number, inv: any) => sum + (Number(inv.amount_due) || 0), 0) || 0
                const totalAP = (bills as any)?.reduce((sum: number, bill: any) => sum + (Number(bill.amount_due) || 0), 0) || 0

                // 2. Monthly Revenue & Expenses
                const now = new Date()
                const startOfCurrentMonth = format(startOfMonth(now), 'yyyy-MM-dd')
                const endOfCurrentMonth = format(endOfMonth(now), 'yyyy-MM-dd')

                const { data: monthLines } = await supabase
                    .from('journal_entry_lines')
                    .select(`
                        debit, 
                        credit, 
                        accounts!inner(type, name), 
                        journal_entries!inner(date)
                    `)
                    .gte('journal_entries.date', startOfCurrentMonth)
                    .lte('journal_entries.date', endOfCurrentMonth)

                let revenueThisMonth = 0
                let expensesThisMonth = 0
                const expenseBreakdownMap: Record<string, number> = {}

                monthLines?.forEach((line: any) => {
                    const debit = Number(line.debit) || 0
                    const credit = Number(line.credit) || 0

                    if (line.accounts.type === 'revenue') {
                        revenueThisMonth += (credit - debit)
                    } else if (line.accounts.type === 'expense') {
                        const val = debit - credit
                        expensesThisMonth += val
                        const accName = line.accounts.name
                        expenseBreakdownMap[accName] = (expenseBreakdownMap[accName] || 0) + val
                    }
                })

                const expenseBreakdown = Object.entries(expenseBreakdownMap)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)

                // 3. Last 6 Months Revenue vs Expenses
                const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')
                const { data: historicLines } = await supabase
                    .from('journal_entry_lines')
                    .select(`
                        debit, 
                        credit, 
                        accounts!inner(type), 
                        journal_entries!inner(date)
                    `)
                    .gte('journal_entries.date', sixMonthsAgo)
                    .lte('journal_entries.date', endOfCurrentMonth)

                const monthlyDataMap: Record<string, { revenue: number, expenses: number }> = {}

                // Initialize last 6 months
                for (let i = 5; i >= 0; i--) {
                    const m = format(subMonths(now, i), 'MMM yyyy')
                    monthlyDataMap[m] = { revenue: 0, expenses: 0 }
                }

                historicLines?.forEach((line: any) => {
                    const m = format(new Date(line.journal_entries.date + 'T12:00:00'), 'MMM yyyy')
                    if (!monthlyDataMap[m]) return

                    const debit = Number(line.debit) || 0
                    const credit = Number(line.credit) || 0

                    if (line.accounts.type === 'revenue') {
                        monthlyDataMap[m].revenue += (credit - debit)
                    } else if (line.accounts.type === 'expense') {
                        monthlyDataMap[m].expenses += (debit - credit)
                    }
                })

                const chartData = Object.entries(monthlyDataMap).map(([name, data]) => ({
                    name,
                    revenue: data.revenue / 100, // Show in dollars for chart
                    expenses: data.expenses / 100
                }))

                // 4. Recent Activity
                const { data: recentInvoices } = await supabase
                    .from('invoices')
                    .select('*, contacts(name)')
                    .neq('status', 'void')
                    .order('created_at', { ascending: false })
                    .limit(5)

                const { data: recentBills } = await supabase
                    .from('bills')
                    .select('*, contacts(name)')
                    .neq('status', 'void')
                    .order('created_at', { ascending: false })
                    .limit(5)

                setDashboardData({
                    totalAR,
                    totalAP,
                    revenueThisMonth,
                    expensesThisMonth,
                    expenseBreakdown,
                    chartData,
                    recentInvoices,
                    recentBills
                })
            } catch (err) {
                console.error("Dashboard data fetch error:", err)
            } finally {
                setIsLoading(false)
            }
        }
        
        fetchDashboardData()
    }, [])

    if (isLoading) {
        return (
            <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
                <div className="flex items-start justify-between mb-6">
                    <div className="space-y-2">
                        <div className="h-9 w-48 bg-zinc-100 rounded-lg animate-pulse" />
                        <div className="h-4 w-96 bg-zinc-50 rounded-lg animate-pulse" />
                    </div>
                    <div className="h-10 w-32 bg-zinc-100 rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-zinc-50 rounded-xl border-2 border-zinc-100 animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-[400px] bg-zinc-50 rounded-xl border-2 border-zinc-100 animate-pulse" />
                    <div className="h-[400px] bg-zinc-50 rounded-xl border-2 border-zinc-100 animate-pulse" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">Financial overview and key performance indicators.</p>
                </div>
                
                {/* Customize button — triggers a Popover */}
                <Popover>
                    <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
                        <SlidersHorizontal className="w-4 h-4" />
                        Customize
                    </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Dashboard Charts
                    </p>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showRevenueChart}
                            onChange={e => setShowRevenueChart(e.target.checked)}
                            className="w-4 h-4 rounded accent-violet-600"
                        />
                        <span className="text-sm text-gray-700">Revenue vs Expenses</span>
                        </label>
                        <label className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showExpenseChart}
                            onChange={e => setShowExpenseChart(e.target.checked)}
                            className="w-4 h-4 rounded accent-violet-600"
                        />
                        <span className="text-sm text-gray-700">Expense Breakdown</span>
                        </label>
                    </div>
                    </PopoverContent>
                </Popover>
            </div>

            <DashboardKPIs
                totalAR={dashboardData.totalAR}
                totalAP={dashboardData.totalAP}
                revenueThisMonth={dashboardData.revenueThisMonth}
                expensesThisMonth={dashboardData.expensesThisMonth}
            />

            <DashboardCharts
                chartData={dashboardData.chartData}
                expenseBreakdown={dashboardData.expenseBreakdown.map((e: any) => ({ ...e, value: e.value / 100 }))}
                showRevenueChart={showRevenueChart}
                showExpenseChart={showExpenseChart}
            />

            <DashboardRecentActivity
                invoices={dashboardData.recentInvoices || []}
                bills={dashboardData.recentBills || []}
            />
        </div>
    )
}
