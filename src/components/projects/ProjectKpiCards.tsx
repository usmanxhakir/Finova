import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDollarSign, TrendingUp, Wallet } from "lucide-react";

interface ProjectKpiCardsProps {
    revenue: number;
    costs: number;
    budget: number;
}

export function ProjectKpiCards({ revenue, costs, budget }: ProjectKpiCardsProps) {
    const profit = revenue - costs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const budgetUtilization = budget > 0 ? (costs / budget) * 100 : 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Revenue
                    </CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(revenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Invoiced amount
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Costs
                    </CardTitle>
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(costs)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Bills & Expenses
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Net Profit
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(profit)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {margin.toFixed(1)}% margin
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Budget Utilization
                    </CardTitle>
                    <Wallet className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(budget)}</div>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                            {budgetUtilization.toFixed(1)}% used
                        </p>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full ${budgetUtilization > 100 ? 'bg-red-500' : 'bg-orange-500'}`}
                                style={{ width: `${Math.min(100, budgetUtilization)}%` }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
