'use client'

import { useState, useEffect } from 'react'
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
import { formatCurrency, cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

interface ChartProps {
    chartData: any[]
    expenseBreakdown: any[]
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#82ca9d']

export function DashboardCharts({ chartData, expenseBreakdown }: ChartProps) {
    const [showRevenueChart, setShowRevenueChart] = useState(true)
    const [showExpenseChart, setShowExpenseChart] = useState(true)
    const [isLoaded, setIsLoaded] = useState(false)

    // On mount, read from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('dashboard_chart_visibility')
        if (saved) {
            try {
                const { revenue, expense } = JSON.parse(saved)
                setShowRevenueChart(revenue ?? true)
                setShowExpenseChart(expense ?? true)
            } catch (e) {
                console.error("Failed to parse chart visibility", e)
            }
        }
        setIsLoaded(true)
    }, [])

    // On change, save to localStorage
    useEffect(() => {
        if (!isLoaded) return
        localStorage.setItem('dashboard_chart_visibility', JSON.stringify({
            revenue: showRevenueChart,
            expense: showExpenseChart
        }))
    }, [showRevenueChart, showExpenseChart, isLoaded])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className={cn(
                "border-2 border-zinc-100 shadow-sm overflow-hidden transition-all duration-300",
                !showRevenueChart ? "h-14" : ""
            )}>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div>
                        <CardTitle className="text-lg font-black uppercase text-zinc-900 tracking-tight">Revenue vs Expenses</CardTitle>
                        {showRevenueChart && <p className="text-sm text-zinc-400 font-medium">Monthly trend for the last 6 months</p>}
                    </div>
                    <button 
                        onClick={() => setShowRevenueChart(!showRevenueChart)}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {showRevenueChart ? <Eye size={18} /> : (
                            <div className="flex items-center gap-1.5 px-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Show</span>
                                <EyeOff size={16} />
                            </div>
                        )}
                    </button>
                </CardHeader>
                <CardContent className={cn("h-[400px] transition-all", !showRevenueChart && "hidden")}>
                    <ResponsiveContainer width="100%" height="100%">
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
                                formatter={(value: any) => [formatCurrency((Number(value) || 0) * 100), '']}
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

            <Card className={cn(
                "border-2 border-zinc-100 shadow-sm overflow-hidden transition-all duration-300",
                !showExpenseChart ? "h-14" : ""
            )}>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                    <div>
                        <CardTitle className="text-lg font-black uppercase text-zinc-900 tracking-tight">Expense Breakdown</CardTitle>
                        {showExpenseChart && <p className="text-sm text-zinc-400 font-medium">Account-wise expenses for current month</p>}
                    </div>
                    <button 
                        onClick={() => setShowExpenseChart(!showExpenseChart)}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {showExpenseChart ? <Eye size={18} /> : (
                            <div className="flex items-center gap-1.5 px-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Show</span>
                                <EyeOff size={16} />
                            </div>
                        )}
                    </button>
                </CardHeader>
                <CardContent className={cn("h-[400px] transition-all", !showExpenseChart && "hidden")}>
                    {expenseBreakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400 italic font-medium">
                            <p>No expenses recorded this month.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
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
                                    formatter={(value: any) => [formatCurrency((Number(value) || 0) * 100), 'Amount']}
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
        </div>
    )
}
