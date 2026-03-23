'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportHeader } from '@/components/reports/ReportHeader'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loader2, CalendarIcon, ChevronRight, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format, startOfMonth, endOfMonth, subDays, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'

type AccountSummary = {
    id: string
    name: string
    code: string
    type: string
    sub_type: string
    currentPeriod: number
    priorPeriod: number
}

export default function ProfitLossPage() {
    const router = useRouter()
    const supabase = createClient()
    const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()))
    const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()))
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<AccountSummary[]>([])

    const loadData = async () => {
        setLoading(true)
        try {
            // Calculate Prior Period
            const daysDiff = differenceInDays(endDate, startDate) + 1
            const priorEndDate = subDays(startDate, 1)
            const priorStartDate = subDays(priorEndDate, daysDiff - 1)

            // 1. Fetch all Revenue and Expense accounts
            const { data: accData } = await supabase
                .from('accounts')
                .select('*')
                .in('type', ['revenue', 'expense'])
                .eq('is_active', true)

            // 2. Fetch journal entries for both periods
            const [currentLines, priorLines] = await Promise.all([
                supabase
                    .from('journal_entry_lines')
                    .select('account_id, debit, credit, journal_entries!inner(date)')
                    .gte('journal_entries.date', format(startDate, 'yyyy-MM-dd'))
                    .lte('journal_entries.date', format(endDate, 'yyyy-MM-dd')),
                supabase
                    .from('journal_entry_lines')
                    .select('account_id, debit, credit, journal_entries!inner(date)')
                    .gte('journal_entries.date', format(priorStartDate, 'yyyy-MM-dd'))
                    .lte('journal_entries.date', format(priorEndDate, 'yyyy-MM-dd'))
            ])

            // 3. Aggregate
            const map: Record<string, AccountSummary> = {}
            accData?.forEach((acc: any) => {
                map[acc.id] = {
                    id: acc.id,
                    name: acc.name,
                    code: acc.code,
                    type: acc.type,
                    sub_type: acc.sub_type,
                    currentPeriod: 0,
                    priorPeriod: 0
                }
            })

            currentLines.data?.forEach((line: any) => {
                if (map[line.account_id]) {
                    const acc = map[line.account_id]
                    const val = Number(line.credit) - Number(line.debit)
                    // For expenses, we show them as positive in their section, so we'll flip sign later
                    // For now, store raw (Credit - Debit) which is Income
                    acc.currentPeriod += val
                }
            })

            priorLines.data?.forEach((line: any) => {
                if (map[line.account_id]) {
                    const acc = map[line.account_id]
                    const val = Number(line.credit) - Number(line.debit)
                    acc.priorPeriod += val
                }
            })

            setAccounts(Object.values(map))
        } catch (error) {
            console.error('Error loading P&L data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [startDate, endDate])

    // Grouping for Display
    const { income, cogs, expenses } = useMemo(() => {
        const income = accounts.filter(a => a.type === 'revenue' && a.sub_type !== 'other_income')
        const cogs = accounts.filter(a => a.sub_type === 'cost_of_goods_sold')
        const expenses = accounts.filter(a => a.type === 'expense' && a.sub_type !== 'cost_of_goods_sold')

        return { income, cogs, expenses }
    }, [accounts])

    const calculateTotals = (items: AccountSummary[]) => {
        return items.reduce((acc, curr) => ({
            current: acc.current + curr.currentPeriod,
            prior: acc.prior + curr.priorPeriod
        }), { current: 0, prior: 0 })
    }

    const incomeTotals = calculateTotals(income)
    const cogsTotals = calculateTotals(cogs)
    const grossProfit = {
        current: incomeTotals.current + cogsTotals.current, // cogs values are negative in (C-D)
        prior: incomeTotals.prior + cogsTotals.prior
    }
    const expenseTotals = calculateTotals(expenses)
    const netIncome = {
        current: grossProfit.current + expenseTotals.current,
        prior: grossProfit.prior + expenseTotals.prior
    }

    const renderRows = (items: AccountSummary[], isExpenseSection = false) => {
        if (items.length === 0) return (
            <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm italic">
                    No accounts found for this section.
                </TableCell>
            </TableRow>
        )

        return items.map(acc => {
            // Expenses are stored as (Credit - Debit), so they will be negative.
            // We flip them to positive for display in the Expense section.
            const currentVal = isExpenseSection ? -acc.currentPeriod : acc.currentPeriod
            const priorVal = isExpenseSection ? -acc.priorPeriod : acc.priorPeriod

            const url = `/reports/transactions?account_id=${acc.id}&date_from=${format(startDate, 'yyyy-MM-dd')}&date_to=${format(endDate, 'yyyy-MM-dd')}&label=${encodeURIComponent(acc.name)}`

            return (
                <TableRow 
                    key={acc.id} 
                    onClick={() => router.push(url)}
                    className="hover:bg-blue-50/80 border-none group cursor-pointer transition-colors"
                    title="Click to view transactions"
                >
                    <TableCell className="pl-8 py-2 text-sm text-zinc-600">
                        <div className="flex items-center justify-between">
                            <span>{acc.code} - {acc.name}</span>
                            <ArrowRight className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mr-2" />
                        </div>
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums">
                        {formatCurrency(currentVal)}
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums text-muted-foreground group-hover:text-zinc-500 transition-colors">
                        {formatCurrency(priorVal)}
                    </TableCell>
                </TableRow>
            )
        })
    }

    return (
        <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
            <ReportHeader
                title="Profit & Loss Statement"
                description={`From ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')}`}
            />

            <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg print:hidden">
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[180px] justify-start text-left font-normal h-9">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(startDate, "MMM dd, yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[180px] justify-start text-left font-normal h-9">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(endDate, "MMM dd, yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-muted-foreground">Generating financial statement...</p>
                </div>
            ) : (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden p-8 print:p-0 print:border-none print:shadow-none">
                    <div className="text-center mb-10 hidden print:block">
                        <h2 className="text-2xl font-bold uppercase tracking-widest">Profit & Loss Statement</h2>
                        <p className="text-muted-foreground">For the period {format(startDate, 'PP')} - {format(endDate, 'PP')}</p>
                    </div>

                    <Table className="border-collapse">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b-2 border-zinc-200">
                                <TableHead className="w-full text-zinc-900 font-bold uppercase tracking-wider text-xs">Accounts</TableHead>
                                <TableHead className="text-right text-zinc-900 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Current Period</TableHead>
                                <TableHead className="text-right text-zinc-500 font-bold uppercase tracking-wider text-xs whitespace-nowrap">Prior Period</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* INCOME */}
                            <TableRow className="hover:bg-transparent border-none">
                                <TableCell className="pt-6 pb-2 font-bold text-zinc-900 uppercase text-xs" colSpan={3}>
                                    Income
                                </TableCell>
                            </TableRow>
                            {renderRows(income)}
                            <TableRow className="border-t border-zinc-100 font-semibold bg-zinc-50/50">
                                <TableCell className="pl-4 py-3">Total Income</TableCell>
                                <TableCell className="text-right py-3">{formatCurrency(incomeTotals.current)}</TableCell>
                                <TableCell className="text-right py-3 text-muted-foreground">{formatCurrency(incomeTotals.prior)}</TableCell>
                            </TableRow>

                            {/* COGS */}
                            <TableRow className="hover:bg-transparent border-none">
                                <TableCell className="pt-8 pb-2 font-bold text-zinc-900 uppercase text-xs" colSpan={3}>
                                    Cost of Goods Sold
                                </TableCell>
                            </TableRow>
                            {renderRows(cogs, true)}
                            <TableRow className="border-t border-zinc-100 font-semibold bg-zinc-50/50">
                                <TableCell className="pl-4 py-3">Total COGS</TableCell>
                                <TableCell className="text-right py-3">{formatCurrency(-cogsTotals.current)}</TableCell>
                                <TableCell className="text-right py-3 text-muted-foreground">{formatCurrency(-cogsTotals.prior)}</TableCell>
                            </TableRow>

                            {/* GROSS PROFIT */}
                            <TableRow className="border-t-2 border-zinc-200 bg-zinc-100/50 font-bold">
                                <TableCell className="py-4 text-zinc-900">GROSS PROFIT</TableCell>
                                <TableCell className="text-right py-4">{formatCurrency(grossProfit.current)}</TableCell>
                                <TableCell className="text-right py-4 text-muted-foreground">{formatCurrency(grossProfit.prior)}</TableCell>
                            </TableRow>

                            {/* EXPENSES */}
                            <TableRow className="hover:bg-transparent border-none">
                                <TableCell className="pt-10 pb-2 font-bold text-zinc-900 uppercase text-xs" colSpan={3}>
                                    Operating Expenses
                                </TableCell>
                            </TableRow>
                            {renderRows(expenses, true)}
                            <TableRow className="border-t border-zinc-100 font-semibold bg-zinc-50/50">
                                <TableCell className="pl-4 py-3">Total Expenses</TableCell>
                                <TableCell className="text-right py-3">{formatCurrency(-expenseTotals.current)}</TableCell>
                                <TableCell className="text-right py-3 text-muted-foreground">{formatCurrency(-expenseTotals.prior)}</TableCell>
                            </TableRow>

                            {/* NET INCOME */}
                            <TableRow className={cn(
                                "border-t-4 mt-4 font-black text-lg",
                                netIncome.current >= 0 ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700"
                            )}>
                                <TableCell className="py-6">NET INCOME</TableCell>
                                <TableCell className="text-right py-6">{formatCurrency(netIncome.current)}</TableCell>
                                <TableCell className="text-right py-6 opacity-60">{formatCurrency(netIncome.prior)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
