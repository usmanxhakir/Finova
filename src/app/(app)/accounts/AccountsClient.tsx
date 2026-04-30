'use client'

import { useState, useMemo, Fragment } from 'react'
import { formatCurrency } from '@/lib/utils'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Lock, Pencil, ChevronRight, ChevronDown, Upload } from 'lucide-react'
import { AccountSheet } from '@/components/accounts/AccountSheet'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useUserRole } from '@/hooks/useUserRole'
import { ImportDialog } from '@/components/ui/ImportDialog'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type Account = {
    id: string
    code: string
    name: string
    type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
    sub_type: string
    balance: number
    is_active: boolean
    is_system: boolean
    parent_account_id: string | null
    description: string | null
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const
const TYPE_CONFIG = {
    asset: { label: 'Assets', color: 'bg-blue-600', textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
    liability: { label: 'Liabilities', color: 'bg-red-600', textColor: 'text-red-600', bgColor: 'bg-red-50' },
    equity: { label: 'Equity', color: 'bg-purple-600', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
    revenue: { label: 'Revenue', color: 'bg-green-600', textColor: 'text-green-600', bgColor: 'bg-green-50' },
    expense: { label: 'Expenses', color: 'bg-orange-600', textColor: 'text-orange-600', bgColor: 'bg-orange-50' },
}

export function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
    const supabase = createClient()
    const router = useRouter()
    const { isViewer } = useUserRole()
    const [sheetOpen, setSheetOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<Account | undefined>()

    const groupedAccounts = useMemo(() => {
        const groups: Record<string, Account[]> = {
            asset: [],
            liability: [],
            equity: [],
            revenue: [],
            expense: [],
        }

        // Separate top-level and children
        const topLevel = initialAccounts.filter(a => !a.parent_account_id)
        const children = initialAccounts.filter(a => a.parent_account_id)

        // Group top-level accounts and sort them by code
        topLevel.forEach(acc => {
            groups[acc.type].push(acc)
        })

        Object.keys(groups).forEach(type => {
            groups[type].sort((a, b) => a.code.localeCompare(b.code))
        })

        // Build the final flat list with indentation markers
        const result: Record<string, (Account & { depth: number })[]> = {
            asset: [],
            liability: [],
            equity: [],
            revenue: [],
            expense: [],
        }

        TYPE_ORDER.forEach(type => {
            const sortedTop = groups[type]
            sortedTop.forEach(parent => {
                // Add active parents first, then inactive ones later? 
                // Instruction says: "Inactive accounts shown grayed out at the bottom of their group"
                // Let's filter top level into active/inactive
            })
        })

        // Simple approach: Group by type, sort by code, then sort inactive to bottom
        TYPE_ORDER.forEach(type => {
            const typeAccounts = initialAccounts.filter(a => a.type === type)
            
            // Build tree
            const roots = typeAccounts.filter(a => !a.parent_account_id).sort((a, b) => a.code.localeCompare(b.code))
            const childrenMap: Record<string, Account[]> = {}
            typeAccounts.forEach(a => {
                if (a.parent_account_id) {
                    if (!childrenMap[a.parent_account_id]) childrenMap[a.parent_account_id] = []
                    childrenMap[a.parent_account_id].push(a)
                }
            })

            const flattened: (Account & { depth: number })[] = []
            
            const traverse = (acc: Account, depth: number) => {
                flattened.push({ ...acc, depth })
                const sub = childrenMap[acc.id] || []
                sub.sort((a, b) => a.code.localeCompare(b.code))
                sub.forEach(s => traverse(s, depth + 1))
            }

            // Separate active and inactive roots
            const activeRoots = roots.filter(r => r.is_active)
            const inactiveRoots = roots.filter(r => !r.is_active)

            activeRoots.forEach(r => traverse(r, 0))
            inactiveRoots.forEach(r => traverse(r, 0))

            result[type] = flattened
        })

        return result
    }, [initialAccounts])

    const handleEdit = (account: Account) => {
        setSelectedAccount(account)
        setSheetOpen(true)
    }

    const handleNew = () => {
        setSelectedAccount(undefined)
        setSheetOpen(true)
    }

    const handleImport = async (data: any[]) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user!.id)
                .single() as { data: { company_id: string } | null, error: any };

            if (!profile?.company_id) throw new Error('Could not resolve company.');
            const company_id = profile.company_id;

            const accountsToInsert = data.map(row => ({
                company_id,
                code: row.code?.toString().trim(),
                name: row.name?.toString().trim(),
                type: row.type?.toString().trim().toLowerCase(),
                sub_type: row.sub_type?.toString().trim().toLowerCase(),
                description: row.description || null,
                is_active: true,
                is_system: false,
                parent_account_id: null,
            }));

            const validAccounts = accountsToInsert.filter(a => a.code && a.name && a.type && a.sub_type);

            if (validAccounts.length === 0) {
                throw new Error('No valid accounts found. code, name, type, and sub_type are required.');
            }

            const { error } = await (supabase.from('accounts') as any).insert(validAccounts);
            if (error) throw error;

            toast.success(`Successfully imported ${validAccounts.length} accounts`);
            setImportOpen(false);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || 'Import failed');
        }
    };

    const sampleCsvUrl = useMemo(() => {
        const headers = ["code", "name", "type", "sub_type", "description"];
        const exampleRow = ["6100", "Office Supplies", "expense", "expense", "Office and stationery expenses"];
        const content = [headers.join(","), exampleRow.join(",")].join("\n");
        return `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
    }, []);

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
                    <p className="text-muted-foreground">Manage your organization's financial accounts and balances.</p>
                </div>
                {!isViewer && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" /> Import
                        </Button>
                        <Button onClick={handleNew}>
                            <Plus className="mr-2 h-4 w-4" /> New Account
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-b">
                            <TableHead className="w-[120px]">Code</TableHead>
                            <TableHead>Account Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Sub-type</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="w-[100px] text-center">Status</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {TYPE_ORDER.map((type) => (
                            <Fragment key={type}>
                                {/* Group Header Row */}
                                <TableRow className={cn("hover:bg-transparent border-none", TYPE_CONFIG[type].bgColor)}>
                                    <TableCell colSpan={7} className={cn("py-3 px-4 font-bold uppercase tracking-wider text-[10px]", TYPE_CONFIG[type].textColor)}>
                                        {TYPE_CONFIG[type].label}
                                    </TableCell>
                                </TableRow>

                                {groupedAccounts[type].map((account) => (
                                    <TableRow 
                                        key={account.id} 
                                        className={cn(
                                            "group cursor-pointer transition-colors",
                                            !account.is_active ? "opacity-50" : "hover:bg-zinc-50"
                                        )}
                                        onClick={() => handleEdit(account)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-1">
                                                {account.is_system && <Lock className="h-3 w-3 text-zinc-400" />}
                                                {account.code}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center" style={{ paddingLeft: `${account.depth * 20}px` }}>
                                                {account.depth > 0 && <ChevronRight className="h-3 w-3 text-zinc-300 mr-2" />}
                                                {account.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="capitalize text-xs text-muted-foreground">
                                            {account.type}
                                        </TableCell>
                                        <TableCell className="capitalize text-xs text-muted-foreground">
                                            {account.sub_type.replace(/_/g, ' ')}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold">
                                            <span className={cn(
                                                account.balance < 0 ? "text-red-500" : ""
                                            )}>
                                                {formatCurrency(account.balance)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={account.is_active ? "secondary" : "outline"} className="text-[10px] py-0 px-2 h-5">
                                                {account.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {groupedAccounts[type].length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm italic">
                                            No {type} accounts found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <AccountSheet 
                open={sheetOpen} 
                onOpenChange={setSheetOpen} 
                account={selectedAccount}
                accounts={initialAccounts}
                onSuccess={() => router.refresh()}
            />

            <ImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                title="Import Accounts"
                description="Upload a CSV file to import accounts in bulk."
                sampleCsvUrl={sampleCsvUrl}
                fields={[
                    { key: "code", label: "Account Code", required: true },
                    { key: "name", label: "Account Name", required: true },
                    { key: "type", label: "Type (asset/liability/equity/revenue/expense)", required: true },
                    { key: "sub_type", label: "Sub-type", required: true },
                    { key: "description", label: "Description" },
                ]}
                onImport={handleImport}
            />
        </div>
    )
}
