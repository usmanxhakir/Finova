
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, IndianRupee, CreditCard, Receipt, TrendingUp, TrendingDown } from 'lucide-react'

interface KPIProps {
    totalAR: number
    totalAP: number
    revenueThisMonth: number
    expensesThisMonth: number
}

export function DashboardKPIs({ totalAR, totalAP, revenueThisMonth, expensesThisMonth }: KPIProps) {
    const kpis = [
        {
            title: 'Total Outstanding A/R',
            value: totalAR,
            icon: Receipt,
            description: 'Unpaid customer invoices',
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            border: 'border-indigo-100'
        },
        {
            title: 'Total Outstanding A/P',
            value: totalAP,
            icon: CreditCard,
            description: 'Unpaid vendor bills',
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            border: 'border-rose-100'
        },
        {
            title: 'Revenue This Month',
            value: revenueThisMonth,
            icon: TrendingUp,
            description: 'Total sales this month',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100'
        },
        {
            title: 'Expenses This Month',
            value: expensesThisMonth,
            icon: TrendingDown,
            description: 'Total costs this month',
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-100'
        }
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi) => (
                <Card key={kpi.title} className={`border-2 ${kpi.border} shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">{kpi.title}</CardTitle>
                        <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform duration-300`}>
                            <kpi.icon className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-black tabular-nums ${kpi.color}`}>
                            {formatCurrency(kpi.value)}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">
                            {kpi.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
