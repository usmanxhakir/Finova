"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/types/database.types";
import { cn, formatCurrency } from "@/lib/utils";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

interface ItemTableProps {
    items: Item[];
    accounts: Account[];
    onEdit: (item: Item) => void;
    isLoading?: boolean;
}

export function ItemTable({ items, accounts, onEdit, isLoading }: ItemTableProps) {
    const accountMap = accounts.reduce((acc, account) => {
        acc[account.id] = account.name;
        return acc;
    }, {} as Record<string, string>);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                <p className="text-zinc-500">No items found</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-white dark:bg-zinc-950">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Default Rate</TableHead>
                        <TableHead>Income Account</TableHead>
                        <TableHead>Expense Account</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            onClick={() => onEdit(item)}
                        >
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span>{item.name}</span>
                                    <span className="text-xs text-zinc-500 truncate max-w-[200px]">{item.description}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="capitalize">
                                    {item.type}
                                </Badge>
                            </TableCell>
                            <TableCell>{item.unit || "-"}</TableCell>
                            <TableCell className="text-right font-mono">
                                {formatCurrency(item.default_rate || 0)}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-500">
                                {item.income_account_id ? accountMap[item.income_account_id] || "Unknown" : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-500">
                                {item.expense_account_id ? accountMap[item.expense_account_id] || "Unknown" : "-"}
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={item.is_active ? "default" : "secondary"}
                                    className={cn(
                                        item.is_active
                                            ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400"
                                    )}
                                >
                                    {item.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
