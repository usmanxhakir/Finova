'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
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
import { formatCurrency, formatDate, getAgingBucket } from '@/lib/utils'
import { ChevronDown, ChevronRight, Loader2, CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AgingBill {
    id: string
    number: string
    due_date: string
    amount_due: number
    bucket: string
}

interface AgingVendor {
    contactId: string
    contactName: string
    current: number
    '1-30': number
    '31-60': number
    '61-90': number
    '90+': number
    total: number
    bills: AgingBill[]
}

export default function APAgingPage() {
    const supabase = createClient()
    const [asOfDate, setAsOfDate] = useState<Date>(new Date())
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<AgingVendor[]>([])
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [companySettings, setCompanySettings] = useState<any>(null)

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('company_settings').select('*').single()
            if (data) setCompanySettings(data)
        }
        fetchSettings()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // Fetch all bills that are not paid or void
            const { data: bills, error } = await supabase
                .from('bills')
                .select('id, number, contact_id, due_date, amount_due, contacts(name)')
                .not('status', 'in', '("paid","void")')
                .gt('amount_due', 0)

            if (error) throw error

            const vendorMap: Record<string, AgingVendor> = {}

            bills?.forEach((bill: any) => {
                const contactId = bill.contact_id
                const contactName = bill.contacts?.name || 'Unknown'
                const bucket = getAgingBucket(bill.due_date, asOfDate)
                const amount = bill.amount_due

                if (!vendorMap[contactId]) {
                    vendorMap[contactId] = {
                        contactId,
                        contactName,
                        current: 0,
                        '1-30': 0,
                        '31-60': 0,
                        '61-90': 0,
                        '90+': 0,
                        total: 0,
                        bills: []
                    }
                }

                const b = bucket as keyof AgingVendor
                if (typeof vendorMap[contactId][b] === 'number') {
                    ; (vendorMap[contactId][b] as number) += amount
                }
                vendorMap[contactId].total += amount
                vendorMap[contactId].bills.push({
                    id: bill.id,
                    number: bill.number,
                    due_date: bill.due_date,
                    amount_due: amount,
                    bucket
                })
            })

            setData(Object.values(vendorMap).sort((a, b) => b.total - a.total) as AgingVendor[])
        } catch (error) {
            console.error('Error loading A/P Aging data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [asOfDate])

    const toggleRow = (id: string) => {
        const next = new Set(expandedRows)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setExpandedRows(next)
    }

    const totals = useMemo(() => {
        return data.reduce((acc, curr) => ({
            current: acc.current + curr.current,
            '1-30': acc['1-30'] + curr['1-30'],
            '31-60': acc['31-60'] + curr['31-60'],
            '61-90': acc['61-90'] + curr['61-90'],
            '90+': acc['90+'] + curr['90+'],
            total: acc.total + curr.total
        }), { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 })
    }, [data])

    const getBucketColor = (bucket: string) => {
        switch (bucket) {
            case 'current': return 'text-green-600 font-medium'
            case '1-30': return 'text-yellow-600 font-medium'
            case '31-60': return 'text-orange-600 font-medium'
            case '61-90': return 'text-red-600 font-medium'
            case '90+': return 'text-red-800 font-bold'
            default: return ''
        }
    }

    const handlePdfExport = () => {
        const headers = ['Vendor', 'Current', '1-30', '31-60', '61-90', '90+', 'Total']
        const rows: any[][] = []

        data.forEach(vendor => {
            rows.push([
                vendor.contactName,
                formatCurrency(vendor.current),
                formatCurrency(vendor['1-30']),
                formatCurrency(vendor['31-60']),
                formatCurrency(vendor['61-90']),
                formatCurrency(vendor['90+']),
                formatCurrency(vendor.total)
            ])
        })

        rows.push([
            { content: 'TOTAL', styles: { fontStyle: 'bold' } },
            { content: formatCurrency(totals.current), styles: { fontStyle: 'bold' } },
            { content: formatCurrency(totals['1-30']), styles: { fontStyle: 'bold' } },
            { content: formatCurrency(totals['31-60']), styles: { fontStyle: 'bold' } },
            { content: formatCurrency(totals['61-90']), styles: { fontStyle: 'bold' } },
            { content: formatCurrency(totals['90+']), styles: { fontStyle: 'bold' } },
            { content: formatCurrency(totals.total), styles: { fontStyle: 'bold', textColor: [67, 56, 202] } }
        ])

        reportExport.toPDF({
            title: 'A/P Aging Summary',
            companyName: companySettings?.name || 'Finova',
            dateRange: `As of ${format(asOfDate, 'MMMM dd, yyyy')}`,
            headers,
            rows,
            filename: 'AP-Aging-Report'
        })
    }

    const handleExcelExport = () => {
        const exportData = data.map(vendor => ({
            Vendor: vendor.contactName,
            Current: vendor.current,
            '1-30 Days': vendor['1-30'],
            '31-60 Days': vendor['31-60'],
            '61-90 Days': vendor['61-90'],
            '90+ Days': vendor['90+'],
            Total: vendor.total
        }))

        // Add totals row
        exportData.push({
            Vendor: 'TOTAL',
            Current: totals.current,
            '1-30 Days': totals['1-30'],
            '31-60 Days': totals['31-60'],
            '61-90 Days': totals['61-90'],
            '90+ Days': totals['90+'],
            Total: totals.total
        })

        reportExport.toExcel(exportData, 'AP-Aging-Report')
    }

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
            <ReportHeader
                title="A/P Aging Report"
                description="Summary of outstanding vendor bills grouped by age."
                onPdf={handlePdfExport}
                onExcel={handleExcelExport}
            />

            <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg print:hidden">
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">As of Date</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[240px] justify-start text-left font-normal",
                                    !asOfDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {asOfDate ? format(asOfDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={asOfDate}
                                onSelect={(date) => date && setAsOfDate(date)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-muted-foreground">Calculating aging buckets...</p>
                </div>
            ) : (
                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zinc-50">
                            <TableRow>
                                <TableHead className="w-[30px]"></TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">1-30</TableHead>
                                <TableHead className="text-right">31-60</TableHead>
                                <TableHead className="text-right">61-90</TableHead>
                                <TableHead className="text-right">90+</TableHead>
                                <TableHead className="text-right font-bold">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        No outstanding payables found as of this date.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {data.map((row) => (
                                        <Fragment key={row.contactId}>
                                            <TableRow
                                                className="cursor-pointer hover:bg-zinc-50 group"
                                                onClick={() => toggleRow(row.contactId)}
                                            >
                                                <TableCell className="p-2">
                                                    {expandedRows.has(row.contactId) ? (
                                                        <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">{row.contactName}</TableCell>
                                                <TableCell className={`text-right ${getBucketColor('current')}`}>{formatCurrency(row.current)}</TableCell>
                                                <TableCell className={`text-right ${getBucketColor('1-30')}`}>{formatCurrency(row['1-30'])}</TableCell>
                                                <TableCell className={`text-right ${getBucketColor('31-60')}`}>{formatCurrency(row['31-60'])}</TableCell>
                                                <TableCell className={`text-right ${getBucketColor('61-90')}`}>{formatCurrency(row['61-90'])}</TableCell>
                                                <TableCell className={`text-right ${getBucketColor('90+')}`}>{formatCurrency(row['90+'])}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(row.total)}</TableCell>
                                            </TableRow>

                                            {expandedRows.has(row.contactId) && (
                                                row.bills.map((bill) => (
                                                    <TableRow key={bill.id} className="bg-zinc-50/50">
                                                        <TableCell></TableCell>
                                                        <TableCell className="pl-8 text-sm text-muted-foreground">
                                                            Bill {bill.number} (Due: {formatDate(bill.due_date)})
                                                        </TableCell>
                                                        <TableCell className={`text-right text-sm ${bill.bucket === 'current' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                            {bill.bucket === 'current' ? formatCurrency(bill.amount_due) : '-'}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-sm ${bill.bucket === '1-30' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                            {bill.bucket === '1-30' ? formatCurrency(bill.amount_due) : '-'}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-sm ${bill.bucket === '31-60' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                            {bill.bucket === '31-60' ? formatCurrency(bill.amount_due) : '-'}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-sm ${bill.bucket === '61-90' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                            {bill.bucket === '61-90' ? formatCurrency(bill.amount_due) : '-'}
                                                        </TableCell>
                                                        <TableCell className={`text-right text-sm ${bill.bucket === '90+' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                                            {bill.bucket === '90+' ? formatCurrency(bill.amount_due) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm font-medium text-zinc-600">
                                                            {formatCurrency(bill.amount_due)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </Fragment>
                                    ))}
                                    <TableRow className="bg-zinc-100 font-bold border-t-2 border-zinc-200">
                                        <TableCell></TableCell>
                                        <TableCell>TOTAL</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totals.current)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totals['1-30'])}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totals['31-60'])}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totals['61-90'])}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totals['90+'])}</TableCell>
                                        <TableCell className="text-right text-indigo-700">{formatCurrency(totals.total)}</TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}
