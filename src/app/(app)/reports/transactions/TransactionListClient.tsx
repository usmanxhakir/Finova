'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Printer, Search, X, Info, FileText, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { reportExport } from '@/lib/report-export'
import { ReportHeader } from '@/components/reports/ReportHeader'
import { createClient } from '@/lib/supabase/client'

type TransactionDetails = {
    id: string
    date: string
    type: 'Invoice' | 'Bill' | 'Expense' | 'Payment'
    reference: string
    contactName: string
    accountName: string
    amount: number
    status: string
    entityId: string | null
}

export default function TransactionListClient({
    initialTransactions,
    preAppliedFilters
}: {
    initialTransactions: TransactionDetails[]
    preAppliedFilters?: {
        accountId?: string
        dateFrom?: string
        dateTo?: string
        accountLabel?: string
    }
}) {
    const router = useRouter()
    const supabase = createClient()
    const [companySettings, setCompanySettings] = useState<any>(null)

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('company_settings').select('*').single()
            if (data) setCompanySettings(data)
        }
        fetchSettings()
    }, [])

    // Filters
    const [startDate, setStartDate] = useState(
        preAppliedFilters?.accountId && !preAppliedFilters?.dateFrom 
            ? "" 
            : (preAppliedFilters?.dateFrom || format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    )
    const [endDate, setEndDate] = useState(preAppliedFilters?.dateTo || format(endOfMonth(new Date()), 'yyyy-MM-dd'))
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTypes, setSelectedTypes] = useState({
        Invoice: true,
        Bill: true,
        Expense: true,
        Payment: true
    })

    const handleTypeChange = (type: string, checked: boolean) => {
        setSelectedTypes(prev => ({ ...prev, [type]: checked }))
    }

    const clearFilters = () => {
        setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
        setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
        setSearchTerm('')
        setSelectedTypes({
            Invoice: true,
            Bill: true,
            Expense: true,
            Payment: true
        })
        if (preAppliedFilters?.accountId) {
            router.push('/reports/transactions')
        }
    }

    const filteredTransactions = useMemo(() => {
        return initialTransactions.filter(t => {
            // Type filter
            if (!selectedTypes[t.type as keyof typeof selectedTypes]) return false

            // Date filter
            if (startDate && endDate) {
                const tDate = parseISO(t.date)
                const sDate = parseISO(startDate)
                const eDate = parseISO(endDate)
                if (!isWithinInterval(tDate, { start: sDate, end: eDate })) {
                    return false
                }
            }

            // Search filter
            if (searchTerm) {
                const lowerSearch = searchTerm.toLowerCase()
                if (
                    !t.contactName.toLowerCase().includes(lowerSearch) &&
                    !t.reference.toLowerCase().includes(lowerSearch) &&
                    !t.accountName.toLowerCase().includes(lowerSearch)
                ) {
                    return false
                }
            }

            return true
        })
    }, [initialTransactions, startDate, endDate, searchTerm, selectedTypes])

    const totals = useMemo(() => {
        return filteredTransactions.reduce(
            (acc, t) => {
                if (t.status === 'void') return acc; // Exclude voided from totals
                switch (t.type) {
                    case 'Invoice': acc.invoiced += t.amount; break;
                    case 'Bill': acc.billed += t.amount; break;
                    case 'Expense': acc.expenses += t.amount; break;
                    case 'Payment': acc.payments += t.amount; break;
                }
                return acc
            },
            { invoiced: 0, billed: 0, expenses: 0, payments: 0 }
        )
    }, [filteredTransactions])


    const handleRowClick = (t: TransactionDetails) => {
        if (t.type === 'Invoice') {
            router.push(`/invoices/${t.entityId}`)
        } else if (t.type === 'Bill') {
            router.push(`/bills/${t.entityId}`)
        } else if (t.type === 'Expense') {
            router.push(`/expenses`) // Sheet needs to be opened, routing to list for now
        } else if (t.type === 'Payment' && t.entityId) {
             // For simplicity, we don't know if it's bill or invoice payment without checking the related entity's table
             // But we can guess or provide a generic link. The instructions say:
             // Payment row -> the invoice or bill it was applied to (/invoices/[id] or /bills/[id])
             // If we didn't fetch the type of entity it was applied to, we might have to pass that from server
             // Let's pass it from server if possible, OR if it has INV- in reference vs BILL-
             if (t.reference.includes('INV') || t.reference.includes('REC')) {
                router.push(`/invoices/${t.entityId}`)
             } else if (t.reference.includes('BILL')) {
                 router.push(`/bills/${t.entityId}`)
             } else {
                 // Fallback if we can't determine
                  router.push(`/invoices/${t.entityId}`)
             }
        }
    }

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case 'Invoice': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            case 'Bill': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
            case 'Expense': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
            case 'Payment': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            default: return 'bg-gray-100 text-gray-800'
        }
    }
    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'paid': return 'success'
            case 'overdue': return 'destructive'
            case 'draft': return 'secondary'
            case 'sent': case 'received': return 'default'
            case 'partially_paid': return 'warning'
            case 'void': return 'outline'
            case 'Recorded': return 'secondary' // Custom for expenses/payments
            default: return 'outline'
        }
    }

    const handlePdfExport = () => {
        const headers = ['Date', 'Type', 'Reference', 'Contact', 'Account', 'Amount', 'Status']
        const rows = filteredTransactions.map(t => [
            formatDate(t.date),
            t.type,
            t.reference,
            t.contactName,
            t.accountName,
            formatCurrency(t.amount),
            t.status
        ])

        reportExport.toPDF({
            title: 'Transaction List',
            companyName: companySettings?.name || 'Finova',
            dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
            headers,
            rows,
            filename: 'Transaction-Report'
        })
    }

    const handleExcelExport = () => {
        const exportData = filteredTransactions.map(t => ({
            Date: t.date,
            Type: t.type,
            Reference: t.reference,
            Contact: t.contactName,
            Account: t.accountName,
            Amount: t.amount,
            Status: t.status
        }))

        reportExport.toExcel(exportData, 'Transaction-Report')
    }

    return (
        <div className="flex flex-col gap-6 p-6 print:p-0">
            <ReportHeader
                title="Transaction List"
                description={`All financial transactions for ${startDate && endDate ? `${formatDate(startDate)} to ${formatDate(endDate)}` : 'all time'}`}
                onPdf={handlePdfExport}
                onExcel={handleExcelExport}
            />

            {/* Drill-down Info Banner */}
            {preAppliedFilters?.accountId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between text-blue-800 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <Info className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">
                                Showing transactions for: {preAppliedFilters.accountLabel || 'Selected Account'}
                            </p>
                            <p className="text-xs text-blue-600/80">
                                Period: {preAppliedFilters.dateFrom ? formatDate(preAppliedFilters.dateFrom) : 'All history'} to {formatDate(preAppliedFilters.dateTo || endDate)}
                            </p>
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearFilters}
                        className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 font-medium whitespace-nowrap"
                    >
                        Clear Filter
                    </Button>
                </div>
            )}

            {/* Filters */}
            <Card className="print:hidden">
                <CardContent className="p-4 grid gap-4 grid-cols-1 md:grid-cols-4 lg:grid-cols-5">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">End Date</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2 lg:col-span-1">
                         <label className="text-xs font-medium text-muted-foreground">Contact/Payee/Ref #</label>
                         <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                         </div>
                    </div>

                    <div className="space-y-1 col-span-1 md:col-span-4 lg:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground flex justify-between">
                            <span>Transaction Type</span>
                            <button onClick={clearFilters} className="text-indigo-600 hover:underline flex items-center">
                                Clear Filters <X className="ml-1 h-3 w-3" />
                            </button>
                        </label>
                        <div className="flex flex-wrap gap-4 pt-2">
                            {Object.entries(selectedTypes).map(([type, checked]) => (
                                <div key={type} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`type-${type}`}
                                        checked={checked}
                                        onCheckedChange={(c) => handleTypeChange(type, c as boolean)}
                                    />
                                    <label
                                        htmlFor={`type-${type}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        {type}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <div className="rounded-md border bg-white dark:bg-zinc-950 print:border-none print:shadow-none min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-900 border-b uppercase print:bg-transparent">
                            <tr>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Reference #</th>
                                <th className="px-4 py-3 font-medium">Contact / Payee</th>
                                <th className="px-4 py-3 font-medium">Account</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                        No transactions found matching the current filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t) => (
                                    <tr
                                        key={t.id}
                                        onClick={() => handleRowClick(t)}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(t.type)}`}>
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">{t.reference}</td>
                                        <td className="px-4 py-3">{t.contactName}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{t.accountName}</td>
                                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(t.amount)}</td>
                                        <td className="px-4 py-3">
                                            {t.status === 'void' ? (
                                                <span className="text-muted-foreground line-through decoration-muted-foreground">VOID</span>
                                            ) : (
                                                 <Badge variant={getStatusBadgeVariant(t.status) as any} className="capitalize font-normal text-xs">
                                                    {t.status.replace('_', ' ')}
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-zinc-50 dark:bg-zinc-900 border-t font-semibold print:bg-transparent text-sm">
                            <tr>
                                <td colSpan={5} className="px-4 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                                        <span>Total Invoiced:</span>
                                        <span>Total Billed:</span>
                                        <span>Total Expenses:</span>
                                        <span>Total Payments:</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1 font-medium text-foreground">
                                        <span>{formatCurrency(totals.invoiced)}</span>
                                        <span>{formatCurrency(totals.billed)}</span>
                                        <span>{formatCurrency(totals.expenses)}</span>
                                        <span>{formatCurrency(totals.payments)}</span>
                                    </div>
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    )
}
