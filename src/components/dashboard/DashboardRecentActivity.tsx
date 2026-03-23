
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface ActivityProps {
    invoices: any[]
    bills: any[]
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
        case 'sent':
        case 'open': return 'bg-blue-50 text-blue-700 border-blue-100'
        case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-100'
        case 'void': return 'bg-zinc-100 text-zinc-500 border-zinc-200'
        default: return 'bg-zinc-50 text-zinc-600 border-zinc-100'
    }
}

export function DashboardRecentActivity({ invoices, bills }: ActivityProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* RECENT INVOICES */}
            <Card className="border-2 border-zinc-100 shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="text-lg font-black uppercase text-zinc-900 tracking-tight">Recent Invoices</CardTitle>
                        <p className="text-sm text-zinc-400 font-medium">Last 5 invoices issued</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50">
                                <TableHead className="pl-6 font-bold text-xs uppercase tracking-wider text-zinc-500">Invoice #</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-zinc-500">Customer</TableHead>
                                <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-zinc-500">Amount</TableHead>
                                <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-zinc-500">Status</TableHead>
                                <TableHead className="pr-6 font-bold text-xs uppercase tracking-wider text-zinc-500 text-right">Due Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-zinc-400 italic">No invoices found.</TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <TableRow key={inv.id} className="group cursor-pointer hover:bg-zinc-50/50 transition-colors">
                                        <TableCell className="pl-6 py-4 font-bold text-zinc-900 text-sm">
                                            <Link href={`/invoices/${inv.id}`} className="flex items-center gap-2 hover:text-indigo-600">
                                                {inv.number}
                                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 font-medium">{inv.contacts?.name}</TableCell>
                                        <TableCell className="text-right font-black text-sm text-zinc-900">{formatCurrency(inv.total)}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`font-bold uppercase text-[10px] px-2 py-0 border-2 ${getStatusColor(inv.status)}`}>
                                                {inv.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-6 py-4 text-sm text-zinc-500 font-medium text-right">
                                            {formatDate(inv.due_date)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* RECENT BILLS */}
            <Card className="border-2 border-zinc-100 shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="text-lg font-black uppercase text-zinc-900 tracking-tight">Recent Bills</CardTitle>
                        <p className="text-sm text-zinc-400 font-medium">Last 5 bills received</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50">
                                <TableHead className="pl-6 font-bold text-xs uppercase tracking-wider text-zinc-500">Bill #</TableHead>
                                <TableHead className="font-bold text-xs uppercase tracking-wider text-zinc-500">Vendor</TableHead>
                                <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-zinc-500">Amount</TableHead>
                                <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-zinc-500">Status</TableHead>
                                <TableHead className="pr-6 font-bold text-xs uppercase tracking-wider text-zinc-500 text-right">Due Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bills.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-zinc-400 italic">No bills found.</TableCell>
                                </TableRow>
                            ) : (
                                bills.map((bill) => (
                                    <TableRow key={bill.id} className="group cursor-pointer hover:bg-zinc-50/50 transition-colors">
                                        <TableCell className="pl-6 py-4 font-bold text-zinc-900 text-sm">
                                            <Link href={`/bills/${bill.id}`} className="flex items-center gap-2 hover:text-indigo-600">
                                                {bill.number}
                                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 font-medium">{bill.contacts?.name}</TableCell>
                                        <TableCell className="text-right font-black text-sm text-zinc-900">{formatCurrency(bill.total)}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`font-bold uppercase text-[10px] px-2 py-0 border-2 ${getStatusColor(bill.status)}`}>
                                                {bill.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-6 py-4 text-sm text-zinc-500 font-medium text-right">
                                            {formatDate(bill.due_date)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
