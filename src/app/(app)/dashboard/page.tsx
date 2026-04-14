
import { createClient } from '@/lib/supabase/server'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { DashboardRecentActivity } from '@/components/dashboard/DashboardRecentActivity'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export default async function DashboardPage() {
    const supabase = await createClient()

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
    const startOfCurrentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const endOfCurrentMonth = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const { data: monthLines } = await supabase
        .from('journal_entry_lines')
        .select(`
            debit, 
            credit, 
            account_id, 
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
    const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd')
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
        const m = format(subMonths(new Date(), i), 'MMM yyyy')
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

    return (
        <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900">Dashboard</h1>
                    <p className="text-zinc-500 mt-1 font-medium">Financial overview and key performance indicators.</p>
                </div>
            </div>

            <DashboardKPIs
                totalAR={totalAR}
                totalAP={totalAP}
                revenueThisMonth={revenueThisMonth}
                expensesThisMonth={expensesThisMonth}
            />

            <DashboardCharts
                chartData={chartData}
                expenseBreakdown={expenseBreakdown.map(e => ({ ...e, value: e.value / 100 }))}
            />

            <DashboardRecentActivity
                invoices={recentInvoices || []}
                bills={recentBills || []}
            />
        </div>
    )
}
