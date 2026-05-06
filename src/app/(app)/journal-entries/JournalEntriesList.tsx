'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, Lock, Search, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface JournalEntry {
    id: string
    date: string
    reference: string | null
    description: string | null
    is_system_generated: boolean
    source_type: string
    journal_entry_lines: { debit: number, credit: number }[]
}

interface Props {
    initialEntries: JournalEntry[]
    showSystem: boolean
    from?: string
    to?: string
}

export function JournalEntriesList({ initialEntries, showSystem, from, to }: Props) {
    const router = useRouter()
    
    const [searchQuery, setSearchQuery] = useState('')
    const [dateFrom, setDateFrom] = useState<Date | undefined>(from ? parseISO(from) : undefined)
    const [dateTo, setDateTo] = useState<Date | undefined>(to ? parseISO(to) : undefined)

    const updateFilters = (newShowSystem: boolean, newFrom?: Date, newTo?: Date) => {
        const params = new URLSearchParams()
        if (newShowSystem) params.set('showSystem', 'true')
        if (newFrom) params.set('from', format(newFrom, 'yyyy-MM-dd'))
        if (newTo) params.set('to', format(newTo, 'yyyy-MM-dd'))
        
        router.push(`/journal-entries?${params.toString()}`)
    }

    const handleClearDates = () => {
        setDateFrom(undefined)
        setDateTo(undefined)
        updateFilters(showSystem, undefined, undefined)
    }

    const filteredEntries = initialEntries.filter(entry => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            (entry.reference?.toLowerCase().includes(q)) ||
            (entry.description?.toLowerCase().includes(q))
        )
    })

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
    }

    return (
        <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#2e1065]">Journal Entries</h1>
                    <p className="text-zinc-500 mt-1">Manage and view your manual and system journal entries.</p>
                </div>
                <Button asChild className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl shadow-lg shadow-violet-200/50 transition-all duration-300 hover:-translate-y-0.5">
                    <Link href="/journal-entries/new">
                        <Plus className="mr-2 h-4 w-4" /> New Entry
                    </Link>
                </Button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input 
                            placeholder="Search reference or description..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-zinc-50 border-transparent focus:bg-white focus:border-violet-200 focus:ring-violet-200 transition-all rounded-xl"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[140px] justify-start text-left font-normal rounded-xl border-violet-100",
                                        !dateFrom && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : <span>From</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={dateFrom}
                                    onSelect={(d) => {
                                        setDateFrom(d)
                                        if (d && dateTo) updateFilters(showSystem, d, dateTo)
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <span className="text-zinc-400">-</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[140px] justify-start text-left font-normal rounded-xl border-violet-100",
                                        !dateTo && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateTo ? format(dateTo, "MMM d, yyyy") : <span>To</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={dateTo}
                                    onSelect={(d) => {
                                        setDateTo(d)
                                        if (dateFrom && d) updateFilters(showSystem, dateFrom, d)
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        
                        {(dateFrom || dateTo) && (
                            <Button variant="ghost" size="icon" onClick={handleClearDates} className="text-zinc-400 hover:text-red-500">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer bg-violet-50/50 px-4 py-2 rounded-xl border border-violet-100">
                    <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={showSystem}
                        onChange={(e) => updateFilters(e.target.checked, dateFrom, dateTo)}
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[10px] after:left-[18px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                    <span className="ml-3 text-sm font-medium text-violet-900">Show system entries</span>
                </label>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-violet-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50/80 border-b border-violet-100 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Reference</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Source</th>
                                <th className="px-6 py-4 text-center">Lines</th>
                                <th className="px-6 py-4 text-right">Debit Total</th>
                                <th className="px-6 py-4 text-right">Credit Total</th>
                                <th className="px-6 py-4 text-center">Type</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-violet-50">
                            {filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
                                        No journal entries found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map((entry) => {
                                    const debitTotal = entry.journal_entry_lines.reduce((sum, l) => sum + (l.debit || 0), 0)
                                    const creditTotal = entry.journal_entry_lines.reduce((sum, l) => sum + (l.credit || 0), 0)
                                    const lineCount = entry.journal_entry_lines.length
                                    
                                    const isSystem = entry.is_system_generated
                                    
                                    return (
                                        <tr 
                                            key={entry.id} 
                                            onClick={() => !isSystem && router.push(`/journal-entries/${entry.id}`)}
                                            className={cn(
                                                "transition-colors group",
                                                !isSystem ? "cursor-pointer hover:bg-violet-50/50" : "bg-zinc-50/30"
                                            )}
                                        >
                                            <td className="px-6 py-4 font-medium text-zinc-900 whitespace-nowrap">
                                                {entry.reference}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-600 whitespace-nowrap">
                                                {format(parseISO(entry.date), 'MMM d, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-600 max-w-xs truncate">
                                                {entry.description}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-600 capitalize">
                                                {entry.source_type}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center bg-zinc-100 text-zinc-600 text-xs font-semibold px-2 py-1 rounded-full min-w-6">
                                                    {lineCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-zinc-700">
                                                {formatCurrency(debitTotal)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-zinc-700">
                                                {formatCurrency(creditTotal)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isSystem ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium border border-zinc-200">
                                                        <Lock className="h-3 w-3" /> System
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                                                        Manual
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
