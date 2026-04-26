'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, FileText, Receipt, Users, Package, CreditCard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SearchResults {
    invoices: any[]
    bills: any[]
    expenses: any[]
    contacts: any[]
    items: any[]
}

export function SearchBar() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResults | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault()
                inputRef.current?.focus()
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (query.length < 2) {
            setResults(null)
            setIsOpen(false)
            return
        }

        const timer = setTimeout(async () => {
            setIsLoading(true)
            setIsOpen(true)
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
                const data = await res.json()
                setResults(data)
            } catch (error) {
                console.error('Search failed:', error)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const navigateTo = (path: string) => {
        router.push(path)
        setIsOpen(false)
        setQuery('')
    }

    const hasResults = results && (
        results.invoices.length > 0 ||
        results.bills.length > 0 ||
        results.expenses.length > 0 ||
        results.contacts.length > 0 ||
        results.items.length > 0
    )

    return (
        <div ref={containerRef} className="relative w-full max-w-[400px]">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    placeholder="Search anything... (/)"
                    className="pl-9 pr-12 h-9 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : (
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            /
                        </kbd>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 max-h-[480px] overflow-y-auto">
                    {query.length < 2 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                            Type at least 2 characters to search
                        </div>
                    ) : isLoading ? (
                        <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-xs">Searching...</span>
                        </div>
                    ) : !hasResults ? (
                        <div className="p-8 text-sm text-muted-foreground text-center">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div className="p-2 space-y-4">
                            {results.invoices.length > 0 && (
                                <section>
                                    <h3 className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoices</h3>
                                    {results.invoices.map(invoice => (
                                        <button
                                            key={invoice.id}
                                            onClick={() => navigateTo(`/invoices/${invoice.id}`)}
                                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium truncate">{invoice.number} · {invoice.contact_name}</span>
                                                    <span className="text-xs font-semibold">{formatCurrency(invoice.total)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 capitalize">{invoice.status}</Badge>
                                                    {invoice.notes && (
                                                        <span className="text-[10px] text-muted-foreground truncate">{invoice.notes}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )}

                            {results.bills.length > 0 && (
                                <section>
                                    <h3 className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bills</h3>
                                    {results.bills.map(bill => (
                                        <button
                                            key={bill.id}
                                            onClick={() => navigateTo(`/bills/${bill.id}`)}
                                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                                                <Receipt className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium truncate">{bill.number} · {bill.contact_name}</span>
                                                    <span className="text-xs font-semibold">{formatCurrency(bill.total)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 capitalize">{bill.status}</Badge>
                                                    {bill.reference_number && (
                                                        <span className="text-[10px] text-muted-foreground truncate">Ref: {bill.reference_number}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )}

                            {results.expenses.length > 0 && (
                                <section>
                                    <h3 className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expenses</h3>
                                    {results.expenses.map(expense => (
                                        <button
                                            key={expense.id}
                                            onClick={() => navigateTo(`/expenses`)}
                                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                                <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium truncate">{expense.payee || expense.description || 'Direct Expense'}</span>
                                                    <span className="text-xs font-semibold">{formatCurrency(expense.amount)}</span>
                                                </div>
                                                {expense.reference && (
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">Ref: {expense.reference}</div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )}

                            {results.contacts.length > 0 && (
                                <section>
                                    <h3 className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contacts</h3>
                                    {results.contacts.map(contact => (
                                        <button
                                            key={contact.id}
                                            onClick={() => navigateTo(`/contacts`)}
                                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <Users className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium truncate">{contact.name}</span>
                                                    <Badge variant="outline" className="text-[9px] h-3.5 py-0 px-1 capitalize">{contact.type}</Badge>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{contact.email}</div>
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )}

                            {results.items.length > 0 && (
                                <section>
                                    <h3 className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Items</h3>
                                    {results.items.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => navigateTo(`/items`)}
                                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-left transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <Package className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium truncate">{item.name}</span>
                                                    <Badge variant="outline" className="text-[9px] h-3.5 py-0 px-1 capitalize">{item.type}</Badge>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(item.default_rate)}</div>
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
