'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    BarChart3,
    FileText,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Scale,
    Clock,
    BookOpenCheck,
    ListOrdered
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const reports = [
    {
        name: "Profit & Loss",
        description: "Review your income, expenses, and net profit over a specific period.",
        href: "/reports/pl",
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50"
    },
    {
        name: "Balance Sheet",
        description: "A snapshot of your financial position: assets, liabilities, and equity.",
        href: "/reports/balance-sheet",
        icon: Scale,
        color: "text-blue-600",
        bgColor: "bg-blue-50"
    },
    {
        name: "A/R Aging",
        description: "Summary of unpaid customer invoices and how long they've been outstanding.",
        href: "/reports/ar-aging",
        icon: Clock,
        color: "text-orange-600",
        bgColor: "bg-orange-50"
    },
    {
        name: "A/P Aging",
        description: "Summary of unpaid vendor bills and how long they've been outstanding.",
        href: "/reports/ap-aging",
        icon: Clock,
        color: "text-red-600",
        bgColor: "bg-red-50"
    },
    {
        name: "Transaction List",
        description: "A detailed list of all transactions within a specified period.",
        href: "/reports/transactions",
        icon: ListOrdered,
        color: "text-teal-600",
        bgColor: "bg-teal-50"
    }
]

export default function ReportsHubPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
                <p className="text-muted-foreground">
                    Get insights into your business's financial performance.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                    <Card key={report.name} className="hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className={`p-3 rounded-lg ${report.bgColor}`}>
                                <report.icon className={`h-6 w-6 ${report.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <CardTitle className="flex items-center gap-2 flex-wrap">
                                    {report.name}
                                </CardTitle>
                                <CardDescription className="line-clamp-2 mt-1">{report.description}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                            <Button asChild variant="outline" className="w-full">
                                <Link href={report.href}>View Report</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
