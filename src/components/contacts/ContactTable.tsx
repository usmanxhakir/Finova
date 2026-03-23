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
import { cn } from "@/lib/utils";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface ContactTableProps {
    contacts: Contact[];
    onEdit: (contact: Contact) => void;
    isLoading?: boolean;
}

export function ContactTable({ contacts, onEdit, isLoading }: ContactTableProps) {
    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (contacts.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                <p className="text-zinc-500">No contacts found</p>
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
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {contacts.map((contact) => (
                        <TableRow
                            key={contact.id}
                            className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            onClick={() => onEdit(contact)}
                        >
                            <TableCell className="font-medium">{contact.name}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className="capitalize">
                                    {contact.type}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-zinc-500">{contact.email || "-"}</TableCell>
                            <TableCell className="text-zinc-500">{contact.phone || "-"}</TableCell>
                            <TableCell>
                                <Badge
                                    variant={contact.is_active ? "default" : "secondary"}
                                    className={cn(
                                        contact.is_active
                                            ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400"
                                    )}
                                >
                                    {contact.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
