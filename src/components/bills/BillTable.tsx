'use client'

import { useState, useMemo } from 'react'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { MoreHorizontal, Plus, Search, Calendar as CalendarIcon, FilterX } from 'lucide-react'
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
import { cn, formatCurrency } from '@/lib/utils'
import { Database } from '@/types/database.types'

type Bill = Database['public']['Tables']['bills']['Row'] & {
    contacts: {
        name: string
    }
}

interface BillTableProps {
    bills: Bill[]
}

export function StatusBadge({ status }: { status: Bill['status'] }) {
    switch (status) {
        case 'draft':
            return <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none">Draft</Badge>
        case 'received':
            return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Received</Badge>
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

export function BillTable({ bills }: BillTableProps) {
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showVoided, setShowVoided] = useState(false)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const filteredBills = useMemo(() => {
        return bills
            .filter((bill) => {
                const matchesStatus = statusFilter === 'all' || bill.status === statusFilter
                const isVoided = bill.status === 'void'

                // If "Show Voided" is OFF, hide voided records unless specifically filtered by status
                if (!showVoided && isVoided && statusFilter !== 'void') {
                    return false
                }

                const matchesSearch =
                    bill.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bill.contacts.name.toLowerCase().includes(searchQuery.toLowerCase())

                let matchesDate = true
                if (startDate || endDate) {
                    const billDate = parseISO(bill.issue_date)
                    const start = startDate ? parseISO(startDate) : new Date(0)
                    const end = endDate ? parseISO(endDate) : new Date(8640000000000000)
                    matchesDate = isWithinInterval(billDate, { start, end })
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
    }, [bills, statusFilter, searchQuery, startDate, endDate, showVoided])

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
                            placeholder="Search bills, reference, or vendors..."
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
                            <SelectItem value="received">Received</SelectItem>
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
                            <TableHead className="w-[120px] font-semibold">Bill #</TableHead>
                            <TableHead className="font-semibold">Vendor</TableHead>
                            <TableHead className="font-semibold">Issue Date</TableHead>
                            <TableHead className="font-semibold">Due Date</TableHead>
                            <TableHead className="text-right font-semibold">Total</TableHead>
                            <TableHead className="text-right font-semibold">Amount Due</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredBills.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    No bills matched your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredBills.map((bill) => (
                                <TableRow
                                    key={bill.id}
                                    className={cn(
                                        "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer relative overflow-hidden",
                                        bill.status === 'void' && "bg-zinc-50/60 opacity-60 grayscale-[0.5]"
                                    )}
                                    onClick={() => window.location.href = `/bills/${bill.id}`}
                                >
                                    {bill.status === 'void' && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                                            <span className="text-red-500/20 text-6xl font-black uppercase tracking-widest -rotate-12 border-8 border-red-500/20 px-8 py-2 rounded-xl">
                                                Voided
                                            </span>
                                        </div>
                                    )}
                                    <TableCell className="font-medium">
                                        <Link
                                            href={`/bills/${bill.id}`}
                                            className="text-primary hover:underline underline-offset-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {bill.number}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{bill.contacts.name}</TableCell>
                                    <TableCell>{format(new Date(bill.issue_date), 'MMM d, yyyy')}</TableCell>
                                    <TableCell>{format(new Date(bill.due_date), 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(bill.total)}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={bill.amount_due > 0 ? "text-amber-600 dark:text-amber-500 font-medium" : "text-zinc-500"}>
                                            {formatCurrency(bill.amount_due)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={bill.status} />
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
