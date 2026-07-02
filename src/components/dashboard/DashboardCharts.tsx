'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ChartProps {
    chartData: Array<{
        name: string
        revenue: number
        expenses: number
    }>
    expenseBreakdown: Array<{
        name: string
        value: number
    }>
    showRevenueChart?: boolean
    showExpenseChart?: boolean
}

function formatChartCurrency(value: unknown) {
    return formatCurrency((Number(value) || 0) * 100)
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#82ca9d']

export function DashboardCharts({ 
    chartData, 
    expenseBreakdown, 
    showRevenueChart = true, 
    showExpenseChart = true 
}: ChartProps) {
    if (!showRevenueChart && !showExpenseChart) return null;

    return (
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
            {showRevenueChart && (
                <Card className="min-w-0 overflow-hidden border-2 border-zinc-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black uppercase text-zinc-900 tracking-tight">Revenue vs Expenses</CardTitle>
                        <p className="text-sm text-zinc-400 font-medium">Monthly trend for the last 6 months</p>
                    </CardHeader>
                    <CardContent className="h-[400px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                    tickFormatter={(val) => `$${val}`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        fontWeight: 600,
                                        fontSize: '12px'
                                    }}
                                    formatter={(value) => [formatChartCurrency(value), '']}
                                />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    iconType="circle"
                                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 600 }}
                                />
                                <Bar
                                    dataKey="revenue"
                                    name="Revenue"
                                    fill="#10b981"
                                    radius={[6, 6, 0, 0]}
                                    barSize={32}
                                />
                                <Bar
                                    dataKey="expenses"
                                    name="Expenses"
                                    fill="#ef4444"
                                    radius={[6, 6, 0, 0]}
                                    barSize={32}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {showExpenseChart && (
                <Card className="min-w-0 overflow-hidden border-2 border-zinc-100 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black uppercase text-zinc-900 tracking-tight">Expense Breakdown</CardTitle>
                        <p className="text-sm text-zinc-400 font-medium">Account-wise expenses for current month</p>
                    </CardHeader>
                    <CardContent className="h-[400px] min-w-0">
                        {expenseBreakdown.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic font-medium">
                                <p>No expenses recorded this month.</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                    <Pie
                                        data={expenseBreakdown}
                                        cx="40%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
                                        stroke="#fff"
                                        strokeWidth={2}
                                    >
                                        {expenseBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            fontWeight: 600,
                                            fontSize: '12px'
                                        }}
                                        formatter={(value) => [formatChartCurrency(value), 'Amount']}
                                    />
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        iconType="circle"
                                        wrapperStyle={{
                                            paddingLeft: '30px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            lineHeight: '22px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
