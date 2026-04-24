'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportHeader } from '@/components/reports/ReportHeader'
import { reportExport } from '@/lib/report-export'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loader2, CalendarIcon, AlertCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

type BSAccount = {
    id: string
    name: string
    code: string
    type: string
    sub_type: string
    balance: number
}

export default function BalanceSheetPage() {
    const router = useRouter()
    const supabase = createClient()
    const [asOfDate, setAsOfDate] = useState<Date>(new Date())
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<BSAccount[]>([])
    const [companySettings, setCompanySettings] = useState<any>(null)

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('companies').select('*').single()
            if (data) setCompanySettings(data)
        }
        fetchSettings()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // 1. Fetch all accounts
            const { data: accData } = await supabase
                .from('accounts')
                .select('*')
                .eq('is_active', true)

            // 2. Fetch all journal entry lines up to date
            const { data: lines } = await (supabase
                .from('journal_entry_lines')
                .select('account_id, debit, credit, journal_entries!inner(date)')
                .lte('journal_entries.date', format(asOfDate, 'yyyy-MM-dd')) as any)

            // 3. Aggregate
            const map: Record<string, BSAccount> = {}
            if (accData) {
                (accData as any[]).forEach((acc: any) => {
                    map[acc.id] = {
                        id: acc.id,
                        name: acc.name,
                        code: acc.code,
                        type: acc.type,
                        sub_type: acc.sub_type,
                        balance: 0
                    }
                })
            }

            if (lines) {
                (lines as any[]).forEach((line: any) => {
                    const acc = map[line.account_id]
                    if (acc) {
                        const debit = Number(line.debit || 0)
                        const credit = Number(line.credit || 0)

                        // Normal Balance logic as per user instructions:
                        // Asset/Expense: Debit - Credit
                        // Liability/Equity/Revenue: Credit - Debit
                        if (acc.type === 'asset' || acc.type === 'expense') {
                            acc.balance += (debit - credit)
                        } else {
                            // Liability, Equity, Revenue
                            acc.balance += (credit - debit)
                        }
                    }
                })
            }

            setAccounts(Object.values(map))
        } catch (error) {
            console.error('Error loading Balance Sheet data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [asOfDate])

    // Grouping
    const { assets, liabilities, equity, netIncomeValue } = useMemo(() => {
        const assetAccounts = accounts.filter(a => a.type === 'asset')
        const liabilityAccounts = accounts.filter(a => a.type === 'liability')
        const equityAccounts = accounts.filter(a => a.type === 'equity')

        // Net Income (Retained Earnings) is Revenue - Expenses
        // Since revenue and expense accounts already have their "normal" balance (C-D and D-C respectively),
        // we can just sum them to get the net effect on equity.
        const totalRevenue = accounts.filter(a => a.type === 'revenue').reduce((sum, a) => sum + a.balance, 0)
        const totalExpenses = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.balance, 0)
        const netIncomeValue = totalRevenue - totalExpenses

        return { assets: assetAccounts, liabilities: liabilityAccounts, equity: equityAccounts, netIncomeValue }
    }, [accounts])

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0)
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0)
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0) + netIncomeValue

    const diff = totalAssets - (totalLiabilities + totalEquity)
    const isBalanced = Math.abs(diff) < 1
    const isUnbalanced = !isBalanced

    const renderRows = (items: BSAccount[], hideEmpty?: boolean) => {
        const filtered = items.filter(a => Math.abs(a.balance) > 0)
        if (filtered.length === 0) {
            if (hideEmpty) return null
            return (
                <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-sm italic border-none">
                        No active accounts in this category.
                    </TableCell>
                </TableRow>
            )
        }

        return filtered.map(acc => {
            const url = `/reports/transactions?account_id=${acc.id}&date_to=${format(asOfDate, 'yyyy-MM-dd')}&label=${encodeURIComponent(acc.name)}`
            
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
                    <TableCell className="text-right py-2 tabular-nums font-medium">
                        {formatCurrency(acc.balance)}
                    </TableCell>
                </TableRow>
            )
        })
    }

    const handlePdfExport = () => {
        const headers = ['Account', 'Amount']
        const rows: any[][] = []

        // ASSETS
        rows.push([{ content: 'ASSETS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }])
        assets.filter(a => Math.abs(a.balance) > 0).forEach(acc => {
            rows.push([`${acc.code} - ${acc.name}`, formatCurrency(acc.balance)])
        })
        rows.push([{ content: 'Total Assets', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalAssets), styles: { fontStyle: 'bold' } }])

        rows.push(['', ''])

        // LIABILITIES
        rows.push([{ content: 'LIABILITIES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }])
        liabilities.filter(a => Math.abs(a.balance) > 0).forEach(acc => {
            rows.push([`${acc.code} - ${acc.name}`, formatCurrency(acc.balance)])
        })
        rows.push([{ content: 'Total Liabilities', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalLiabilities), styles: { fontStyle: 'bold' } }])

        rows.push(['', ''])

        // EQUITY
        rows.push([{ content: 'EQUITY', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }])
        equity.filter(a => Math.abs(a.balance) > 0).forEach(acc => {
            rows.push([`${acc.code} - ${acc.name}`, formatCurrency(acc.balance)])
        })
        rows.push(['Net Income / Retained Earnings', formatCurrency(netIncomeValue)])
        rows.push([{ content: 'Total Equity', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalEquity), styles: { fontStyle: 'bold' } }])

        rows.push(['', ''])

        // TOTAL L+E
        rows.push([{ 
            content: 'Total Liabilities + Equity', 
            styles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: [0, 0, 0] } 
        }, { 
            content: formatCurrency(totalLiabilities + totalEquity), 
            styles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: [0, 0, 0] } 
        }])

        reportExport.toPDF({
            title: 'Balance Sheet',
            companyName: companySettings?.name || 'Finova',
            dateRange: `As of ${format(asOfDate, 'MMMM dd, yyyy')}`,
            headers,
            rows,
            filename: 'Balance-Sheet'
        })
    }

    const handleExcelExport = () => {
        const data: any[] = []
        
        data.push({ Account: 'ASSETS' })
        assets.filter(a => Math.abs(a.balance) > 0).forEach(acc => {
            data.push({ Account: `${acc.code} - ${acc.name}`, Amount: acc.balance })
        })
        data.push({ Account: 'Total Assets', Amount: totalAssets })
        data.push({})

        data.push({ Account: 'LIABILITIES' })
        liabilities.filter(a => Math.abs(a.balance) > 0).forEach(acc => {
            data.push({ Account: `${acc.code} - ${acc.name}`, Amount: acc.balance })
        })
        data.push({ Account: 'Total Liabilities', Amount: totalLiabilities })
        data.push({})

        data.push({ Account: 'EQUITY' })
        equity.filter(a => Math.abs(a.balance) > 0).forEach(acc => {
            data.push({ Account: `${acc.code} - ${acc.name}`, Amount: acc.balance })
        })
        data.push({ Account: 'Net Income / Retained Earnings', Amount: netIncomeValue })
        data.push({ Account: 'Total Equity', Amount: totalEquity })
        data.push({})

        data.push({ Account: 'Total Liabilities + Equity', Amount: totalLiabilities + totalEquity })

        reportExport.toExcel(data, 'Balance-Sheet')
    }

    return (
        <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
            <ReportHeader
                title="Balance Sheet"
                description={`As of ${format(asOfDate, 'MMMM dd, yyyy')}`}
                onPdf={handlePdfExport}
                onExcel={handleExcelExport}
            />

            <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg print:hidden">
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">As of Date</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(asOfDate, "PPP")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={asOfDate} onSelect={(d) => d && setAsOfDate(d)} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-muted-foreground">Compiling assets and liabilities...</p>
                </div>
            ) : (
                <div className="bg-white border rounded-xl shadow-sm overflow-hidden p-8 print:p-0 print:border-none print:shadow-none">
                    <div className="text-center mb-10 hidden print:block">
                        <h2 className="text-2xl font-bold uppercase tracking-widest">Balance Sheet</h2>
                        <p className="text-muted-foreground">As of {format(asOfDate, 'PP')}</p>
                    </div>

                    <Table className="border-collapse">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b-2 border-zinc-200">
                                <TableHead className="w-full text-zinc-900 font-bold uppercase tracking-wider text-xs">Accounts</TableHead>
                                <TableHead className="text-right text-zinc-900 font-bold uppercase tracking-wider text-xs">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* ASSETS */}
                            <TableRow className="hover:bg-transparent border-none">
                                <TableCell className="pt-6 pb-2 font-bold text-zinc-900 uppercase text-xs" colSpan={2}>
                                    Assets
                                </TableCell>
                            </TableRow>
                            {renderRows(assets)}

                            <TableRow className="border-t border-zinc-100 font-bold bg-zinc-50/50">
                                <TableCell className="pl-4 py-3">Total Assets</TableCell>
                                <TableCell className="text-right py-3 text-indigo-700">{formatCurrency(totalAssets)}</TableCell>
                            </TableRow>

                            {/* LIABILITIES */}
                            <TableRow className="hover:bg-transparent border-none">
                                <TableCell className="pt-10 pb-2 font-bold text-zinc-900 uppercase text-xs" colSpan={2}>
                                    Liabilities
                                </TableCell>
                            </TableRow>
                            {renderRows(liabilities)}
                            <TableRow className="border-t border-zinc-100 font-bold bg-zinc-50/50">
                                <TableCell className="pl-4 py-3">Total Liabilities</TableCell>
                                <TableCell className="text-right py-3">{formatCurrency(totalLiabilities)}</TableCell>
                            </TableRow>

                            {/* EQUITY */}
                            <TableRow className="hover:bg-transparent border-none">
                                <TableCell className="pt-10 pb-2 font-bold text-zinc-900 uppercase text-xs" colSpan={2}>
                                    Equity
                                </TableCell>
                            </TableRow>
                            {renderRows(equity, true)}
                            <TableRow className="hover:bg-zinc-50/50 border-none">
                                <TableCell className="pl-8 py-2 text-sm text-zinc-600 italic">Net Income / Retained Earnings</TableCell>
                                <TableCell className="text-right py-2 tabular-nums font-medium">{formatCurrency(netIncomeValue)}</TableCell>
                            </TableRow>
                            <TableRow className="border-t border-zinc-100 font-bold bg-zinc-50/50">
                                <TableCell className="pl-4 py-3">Total Equity</TableCell>
                                <TableCell className="text-right py-3">{formatCurrency(totalEquity)}</TableCell>
                            </TableRow>

                            {/* L + E TOTAL */}
                            <TableRow className="border-t-4 border-zinc-900 bg-zinc-900 hover:bg-zinc-900 text-white font-black uppercase tracking-tighter">
                                <TableCell className="py-6 px-4">Total Liabilities + Equity</TableCell>
                                <TableCell className="text-right py-6 px-4 font-black">{formatCurrency(totalLiabilities + totalEquity)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
