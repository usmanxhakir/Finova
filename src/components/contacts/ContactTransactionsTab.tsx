"use client";

import TransactionListClient from "@/app/(app)/reports/transactions/TransactionListClient";

interface ContactTransactionsTabProps {
    transactions: any[];
}

export function ContactTransactionsTab({ transactions }: ContactTransactionsTabProps) {
    return (
        <div className="mt-4">
            <TransactionListClient 
                initialTransactions={transactions} 
            />
        </div>
    );
}
