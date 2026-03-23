'use client'

import { useState, useMemo } from 'react'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { MoreHorizontal, Plus, Search, Calendar as CalendarIcon, FilterX, Mail } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { formatCurrency, cn } from '@/lib/utils'
import { Database } from '@/types/database.types'

type Invoice = Database['public']['Tables']['invoices']['Row'] & {
    contacts: {
        name: string
    }
    sent_at: string | null
}

interface InvoiceTableProps {
    invoices: Invoice[]
}

export function StatusBadge({ status }: { status: Invoice['status'] }) {
    switch (status) {
        case 'draft':
            return <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none">Draft</Badge>
        case 'sent':
            return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Sent</Badge>
        case 'partially_paid':
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">Partially Paid</Badge>
        case 'paid':
            return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Paid</Badge>
        case 'overdue':
            return <Badge variant="destructive" className="border-none">Overdue</Badge>
        case 'void':
            return (
                <div className="relative flex items-center justify-center">
                    <Badge variant="outline" className="line-through bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                        Void
                    </Badge>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                </div>
            )
        default:
            return <Badge variant="outline">{status}</Badge>
    }
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showVoided, setShowVoided] = useState(false)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const filteredInvoices = useMemo(() => {
        return invoices
            .filter((invoice) => {
                const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
                const isVoided = invoice.status === 'void'
                
                // If "Show Voided" is OFF, hide voided records unless specifically filtered by status
                if (!showVoided && isVoided && statusFilter !== 'void') {
                    return false
                }

                const matchesSearch =
                    invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    invoice.contacts.name.toLowerCase().includes(searchQuery.toLowerCase())

                let matchesDate = true
                if (startDate || endDate) {
                    const invoiceDate = parseISO(invoice.issue_date)
                    const start = startDate ? parseISO(startDate) : new Date(0)
                    const end = endDate ? parseISO(endDate) : new Date(8640000000000000)
                    matchesDate = isWithinInterval(invoiceDate, { start, end })
                }

                return matchesStatus && matchesSearch && matchesDate
            })
            .sort((a, b) => {
                // Keep voided at the bottom
                if (a.status === 'void' && b.status !== 'void') return 1
                if (a.status !== 'void' && b.status === 'void') return -1
                // Default sort by date descending
                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
            })
    }, [invoices, statusFilter, searchQuery, startDate, endDate, showVoided])

    const resetFilters = () => {
        setStatusFilter('all')
        setSearchQuery('')
        setStartDate('')
        setEndDate('')
        setShowVoided(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-zinc-950 p-4 rounded-lg border shadow-sm">
                <div className="flex flex-1 items-center gap-2 max-w-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search invoices or customers..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="partially_paid">Partially Paid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="void">Void</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 rounded-md border p-1 bg-zinc-50 dark:bg-zinc-900">
                        <div className="flex items-center gap-1.5 px-2">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                type="date"
                                className="h-7 w-auto border-none bg-transparent p-0 text-xs focus-visible:ring-0"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <span className="text-muted-foreground">-</span>
                        <div className="flex items-center gap-1.5 px-2">
                            <Input
                                type="date"
                                className="h-7 w-auto border-none bg-transparent p-0 text-xs focus-visible:ring-0"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-zinc-50 dark:bg-zinc-900">
                        <label htmlFor="show-voided" className="text-xs font-medium cursor-pointer">Show Voided</label>
                        <input
                            id="show-voided"
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
                            checked={showVoided}
                            onChange={(e) => setShowVoided(e.target.checked)}
                        />
                    </div>

                    {(statusFilter !== 'all' || searchQuery || startDate || endDate || showVoided) && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2">
                            <FilterX className="h-4 w-4 mr-2" />
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                            <TableHead className="w-[120px] font-semibold">Invoice #</TableHead>
                            <TableHead className="font-semibold">Customer</TableHead>
                            <TableHead className="font-semibold">Issue Date</TableHead>
                            <TableHead className="font-semibold">Due Date</TableHead>
                            <TableHead className="text-right font-semibold">Total</TableHead>
                            <TableHead className="text-right font-semibold">Amount Due</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                    No invoices matched your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInvoices.map((invoice) => (
                                <TableRow
                                    key={invoice.id}
                                    className={cn(
                                        "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer relative overflow-hidden",
                                        invoice.status === 'void' && "bg-zinc-50/60 opacity-60 grayscale-[0.5]"
                                    )}
                                    onClick={() => window.location.href = `/invoices/${invoice.id}`}
                                >
                                    {invoice.status === 'void' && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                                            <span className="text-red-500/20 text-6xl font-black uppercase tracking-widest -rotate-12 border-8 border-red-500/20 px-8 py-2 rounded-xl">
                                                Voided
                                            </span>
                                        </div>
                                    )}
                                    <TableCell className="font-medium">
                                        <Link
                                            href={`/invoices/${invoice.id}`}
                                            className="text-primary hover:underline underline-offset-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {invoice.number}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{invoice.contacts.name}</TableCell>
                                    <TableCell>{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</TableCell>
                                    <TableCell>{format(new Date(invoice.due_date), 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(invoice.total)}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={invoice.amount_due > 0 ? "text-amber-600 dark:text-amber-500 font-medium" : "text-zinc-500"}>
                                            {formatCurrency(invoice.amount_due)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={invoice.status} />
                                            {invoice.sent_at && (
                                                <Mail className="h-4 w-4 text-indigo-500" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/invoices/${invoice.id}`} className="cursor-pointer">View Details</Link>
                                                </DropdownMenuItem>
                                                {invoice.status === 'draft' && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/invoices/${invoice.id}`} className="cursor-pointer">Edit Invoice</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/invoices/${invoice.id}`} className="cursor-pointer">Manage Payments</Link>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
