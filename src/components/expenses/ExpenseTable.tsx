'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FileText, MoreHorizontal } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface ExpenseTableProps {
    expenses: any[]
    accounts: any[]
    onRowClick: (expense: any) => void
}

export function ExpenseTable({ expenses, accounts, onRowClick }: ExpenseTableProps) {
    const getAccountName = (id: string) => {
        const account = accounts.find((a) => a.id === id)
        return account ? `${account.code} - ${account.name}` : 'Unknown'
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead>Expense Account</TableHead>
                        <TableHead>Payment Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {expenses.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                No expenses found. Record your first direct expense.
                            </TableCell>
                        </TableRow>
                    ) : (
                        expenses.map((expense) => (
                            <TableRow
                                key={expense.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onRowClick(expense)}
                            >
                                <TableCell className="font-medium">
                                    {formatDate(expense.date)}
                                </TableCell>
                                <TableCell>{expense.payee}</TableCell>
                                <TableCell>{getAccountName(expense.expense_account_id)}</TableCell>
                                <TableCell>{getAccountName(expense.payment_account_id)}</TableCell>
                                <TableCell className="text-right">
                                    {formatCurrency(expense.amount)}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={expense.status === 'void' ? 'destructive' : 'secondary'}>
                                        {expense.status || 'finalized'}
                                    </Badge>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    {expense.receipt_url && (
                                        <a
                                            href={expense.receipt_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground"
                                            title="View Receipt"
                                        >
                                            <FileText className="h-4 w-4" />
                                        </a>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
