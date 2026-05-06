'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { CalendarIcon, Check, ChevronsUpDown, ArrowLeft, Trash2, Plus, Lock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { updateJournalEntry } from './actions'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

interface Account {
    id: string
    code: string
    name: string
}

interface LineItem {
    id: string 
    account_id: string
    description: string
    debitInput: string 
    creditInput: string
}

function generateId() {
    return Math.random().toString(36).substring(2, 9)
}

export default function EditJournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const supabase = createClient()
    
    const [reference, setReference] = useState('Loading...')
    const [date, setDate] = useState<Date>(new Date())
    const [description, setDescription] = useState('')
    const [isSystemGenerated, setIsSystemGenerated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    
    const [accounts, setAccounts] = useState<Account[]>([])
    const [lines, setLines] = useState<LineItem[]>([])

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [balanceWarningOpen, setBalanceWarningOpen] = useState(false)

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch active accounts (filtering out 1100 and 2100)
                const { data: { session } } = await supabase.auth.getSession()
                const { data: profile } = await (supabase.from('profiles') as any).select('company_id').single()
                const companyId = profile?.company_id

                const { data: accData } = await (supabase
                    .from('accounts') as any)
                    .select('id, code, name')
                    .eq('is_active', true)
                    .eq('company_id', companyId)
                    .order('code')
                
                if (accData) {
                    const filteredAccounts = (accData as any[]).filter(a => a.code !== '1100' && a.code !== '2100')
                    setAccounts(filteredAccounts)
                }

                // Fetch entry data
                const { data: entry, error: entryError } = await (supabase
                    .from('journal_entries') as any)
                    .select(`
                        *,
                        journal_entry_lines (
                            *
                        )
                    `)
                    .eq('id', id)
                    .single()

                if (entryError || !entry) {
                    setError('Journal entry not found')
                    setIsLoading(false)
                    return
                }

                setReference(entry.reference || '')
                setDate(parseISO(entry.date))
                setDescription(entry.description || '')
                setIsSystemGenerated(entry.is_system_generated || false)

                if (entry.journal_entry_lines) {
                    const loadedLines = entry.journal_entry_lines.map((l: any) => ({
                        id: generateId(),
                        account_id: l.account_id,
                        description: l.description || '',
                        debitInput: l.debit > 0 ? (l.debit / 100).toString() : '',
                        creditInput: l.credit > 0 ? (l.credit / 100).toString() : ''
                    }))
                    
                    // Always have at least 2 lines
                    while (loadedLines.length < 2) {
                        loadedLines.push({ id: generateId(), account_id: '', description: '', debitInput: '', creditInput: '' })
                    }
                    
                    setLines(loadedLines)
                }

                setIsLoading(false)
            } catch (err) {
                console.error('Failed to load initial data', err)
                setError('Failed to load data')
                setIsLoading(false)
            }
        }
        fetchData()
    }, [id, supabase])

    const handleAddLine = () => {
        if (isSystemGenerated) return
        setLines([...lines, { id: generateId(), account_id: '', description: '', debitInput: '', creditInput: '' }])
    }

    const handleRemoveLine = (idToRemove: string) => {
        if (isSystemGenerated || lines.length <= 2) return
        setLines(lines.filter(l => l.id !== idToRemove))
    }

    const updateLine = (id: string, field: keyof LineItem, value: string) => {
        if (isSystemGenerated) return
        
        setLines(prevLines => {
            const newLines = [...prevLines]
            const index = newLines.findIndex(l => l.id === id)
            if (index === -1) return prevLines

            const currentLine = { ...newLines[index] }

            if (field === 'debitInput') {
                currentLine.debitInput = value
                if (value) currentLine.creditInput = '' 
            } else if (field === 'creditInput') {
                currentLine.creditInput = value
                if (value) currentLine.debitInput = '' 
            } else {
                currentLine[field] = value as any
            }

            newLines[index] = currentLine

            // Auto-fill logic
            if (field === 'debitInput' && value && !isNaN(Number(value))) {
                if (index + 1 < newLines.length) {
                    const nextLine = newLines[index + 1]
                    if (!nextLine.debitInput && !nextLine.creditInput && !nextLine.account_id) {
                        newLines[index + 1] = { ...nextLine, creditInput: value }
                    }
                }
            }

            if (field === 'creditInput' && value && !isNaN(Number(value))) {
                if (index + 1 < newLines.length) {
                    const nextLine = newLines[index + 1]
                    if (!nextLine.debitInput && !nextLine.creditInput && !nextLine.account_id) {
                        newLines[index + 1] = { ...nextLine, debitInput: value }
                    }
                }
            }

            return newLines
        })
    }

    const totalDebitsCents = lines.reduce((sum, line) => {
        const val = parseFloat(line.debitInput)
        return isNaN(val) ? sum : sum + Math.round(val * 100)
    }, 0)
    
    const totalCreditsCents = lines.reduce((sum, line) => {
        const val = parseFloat(line.creditInput)
        return isNaN(val) ? sum : sum + Math.round(val * 100)
    }, 0)

    const differenceCents = Math.abs(totalDebitsCents - totalCreditsCents)
    const isBalanced = totalDebitsCents === totalCreditsCents && totalDebitsCents > 0
    const hasAccounts = lines.some(l => l.account_id)

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSystemGenerated) return

        if (!isBalanced) {
            setBalanceWarningOpen(true)
            return
        }

        setIsSubmitting(true)
        setError(null)

        const formData = new FormData()
        formData.append('date', format(date, 'yyyy-MM-dd'))
        formData.append('description', description)

        const validLines = lines.filter(l => l.account_id && (l.debitInput || l.creditInput))
        formData.append('lineCount', validLines.length.toString())

        validLines.forEach((line, i) => {
            formData.append(`lines[${i}][account_id]`, line.account_id)
            formData.append(`lines[${i}][description]`, line.description)
            
            const debitCents = line.debitInput ? Math.round(parseFloat(line.debitInput) * 100) : 0
            const creditCents = line.creditInput ? Math.round(parseFloat(line.creditInput) * 100) : 0
            
            formData.append(`lines[${i}][debit]`, debitCents.toString())
            formData.append(`lines[${i}][credit]`, creditCents.toString())
        })

        const result = await updateJournalEntry(id, formData)
        
        if (result?.error) {
            setError(result.error)
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return <div className="p-8">Loading entry...</div>
    }

    return (
        <div className="flex-1 space-y-6 p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/journal-entries">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight text-[#2e1065]">
                        {isSystemGenerated ? 'View Journal Entry' : 'Edit Journal Entry'}
                    </h1>
                    {isSystemGenerated && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-sm font-medium border border-zinc-200">
                            <Lock className="h-3.5 w-3.5" /> System
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" asChild>
                        <Link href="/journal-entries">Back</Link>
                    </Button>
                    {!isSystemGenerated && (
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting || lines.length < 2 || !hasAccounts}
                            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            {isSystemGenerated && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    This entry was generated automatically by the system and cannot be edited.
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-violet-100 overflow-hidden">
                <div className="p-6 border-b border-violet-100 bg-violet-50/30">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <Label className="text-zinc-500 font-medium">Reference</Label>
                            <div className="text-lg font-semibold text-zinc-800 bg-white/50 px-3 py-2 rounded-lg border border-violet-100 inline-block min-w-40 opacity-70">
                                {reference}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-500 font-medium">Date</Label>
                            <Popover>
                                <PopoverTrigger asChild disabled={isSystemGenerated}>
                                    <Button
                                        variant={"outline"}
                                        disabled={isSystemGenerated}
                                        className={cn(
                                            "w-full justify-start text-left font-normal bg-white",
                                            !date && "text-muted-foreground",
                                            isSystemGenerated && "opacity-70 bg-zinc-50"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="mt-6 space-y-2">
                        <Label className="text-zinc-500 font-medium">Description</Label>
                        <Input 
                            placeholder="e.g. Monthly depreciation entry" 
                            className={cn("bg-white", isSystemGenerated && "opacity-70 bg-zinc-50")}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSystemGenerated}
                        />
                    </div>
                </div>

                <div className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50/50 border-b border-violet-100 text-zinc-500 font-medium">
                                <tr>
                                    <th className="px-6 py-3 w-1/3">Account</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3 w-32 text-right">Debit (DR)</th>
                                    <th className="px-6 py-3 w-32 text-right">Credit (CR)</th>
                                    <th className="px-6 py-3 w-16 text-center"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-violet-100">
                                {lines.map((line) => (
                                    <tr key={line.id} className="hover:bg-violet-50/30 transition-colors">
                                        <td className="px-6 py-2">
                                            <Popover>
                                                <PopoverTrigger asChild disabled={isSystemGenerated}>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        disabled={isSystemGenerated}
                                                        className={cn(
                                                            "w-full justify-between font-normal",
                                                            !line.account_id && "text-muted-foreground",
                                                            isSystemGenerated && "opacity-70 bg-zinc-50 border-transparent"
                                                        )}
                                                    >
                                                        {line.account_id
                                                            ? (accounts.find((a) => a.id === line.account_id)?.name || 'Unknown Account')
                                                            : "Select account"}
                                                        {!isSystemGenerated && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search account..." />
                                                        <CommandList>
                                                            <CommandEmpty>No account found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {accounts.map((acc) => (
                                                                    <CommandItem
                                                                        key={acc.id}
                                                                        value={`${acc.code} ${acc.name}`}
                                                                        onSelect={() => {
                                                                            updateLine(line.id, 'account_id', acc.id)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                line.account_id === acc.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <span className="font-mono text-zinc-500 mr-2">{acc.code}</span>
                                                                        {acc.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </td>
                                        <td className="px-6 py-2">
                                            <Input 
                                                placeholder={isSystemGenerated ? "" : "Line description"} 
                                                value={line.description}
                                                onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                                                disabled={isSystemGenerated}
                                                className={cn(
                                                    "border-transparent hover:border-violet-200 focus:border-violet-500 bg-transparent",
                                                    isSystemGenerated && "opacity-70 pointer-events-none"
                                                )}
                                            />
                                        </td>
                                        <td className="px-6 py-2">
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                placeholder="0.00"
                                                value={line.debitInput}
                                                onChange={(e) => updateLine(line.id, 'debitInput', e.target.value)}
                                                disabled={!!line.creditInput || isSystemGenerated}
                                                className={cn(
                                                    "text-right border-transparent hover:border-violet-200 focus:border-violet-500",
                                                    line.creditInput ? "bg-zinc-100 text-zinc-400" : "bg-transparent",
                                                    isSystemGenerated && "opacity-70 pointer-events-none"
                                                )}
                                            />
                                        </td>
                                        <td className="px-6 py-2">
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                placeholder="0.00"
                                                value={line.creditInput}
                                                onChange={(e) => updateLine(line.id, 'creditInput', e.target.value)}
                                                disabled={!!line.debitInput || isSystemGenerated}
                                                className={cn(
                                                    "text-right border-transparent hover:border-violet-200 focus:border-violet-500",
                                                    line.debitInput ? "bg-zinc-100 text-zinc-400" : "bg-transparent",
                                                    isSystemGenerated && "opacity-70 pointer-events-none"
                                                )}
                                            />
                                        </td>
                                        <td className="px-6 py-2 text-center">
                                            {!isSystemGenerated && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleRemoveLine(line.id)}
                                                    disabled={lines.length <= 2}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {!isSystemGenerated && (
                        <div className="p-4 border-t border-violet-100 bg-white">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleAddLine}
                                className="text-violet-600 border-violet-200 hover:bg-violet-50"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add Line
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="sticky bottom-6 bg-zinc-900 text-white rounded-2xl p-6 shadow-2xl flex items-center justify-between border border-zinc-800">
                <div className="flex gap-12">
                    <div>
                        <p className="text-zinc-400 text-sm font-medium mb-1">Total Debits</p>
                        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalDebitsCents)}</p>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-sm font-medium mb-1">Total Credits</p>
                        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(totalCreditsCents)}</p>
                    </div>
                    <div>
                        <p className="text-zinc-400 text-sm font-medium mb-1">Difference</p>
                        <p className={cn(
                            "text-2xl font-semibold tracking-tight",
                            differenceCents > 0 ? "text-amber-400" : "text-emerald-400"
                        )}>
                            {formatCurrency(differenceCents)}
                        </p>
                    </div>
                </div>
                <div>
                    {isBalanced ? (
                        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20 font-medium">
                            <Check className="h-5 w-5" /> Balanced
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-4 py-2 rounded-lg border border-amber-400/20 font-medium">
                            ⚠ Out of balance by {formatCurrency(differenceCents)}
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={balanceWarningOpen} onOpenChange={setBalanceWarningOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Out of Balance</DialogTitle>
                        <DialogDescription>
                            This entry is out of balance by {formatCurrency(differenceCents)}. 
                            Debits and credits must be equal before posting.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setBalanceWarningOpen(false)}>Okay</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
