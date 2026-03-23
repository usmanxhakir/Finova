"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemTable } from "@/components/items/ItemTable";
import { ItemSheet } from "@/components/items/ItemSheet";
import { ImportDialog } from "@/components/ui/ImportDialog";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database.types";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveAccount } from "@/lib/utils/import-utils";

type Item = Database["public"]["Tables"]["items"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export default function ItemsPage() {
    const supabase = createClient();
    const { isViewer } = useUserRole();
    const [items, setItems] = useState<Item[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            const [itemsRes, accountsRes] = await Promise.all([
                supabase.from("items").select("*").order("name"),
                supabase.from("accounts").select("*")
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (accountsRes.error) throw accountsRes.error;

            setItems(itemsRes.data || []);
            setAccounts(accountsRes.data || []);
        } catch (error: any) {
            toast.error(error.message || "Failed to fetch data");
        } finally {
            setIsLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredItems = items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (item: Item) => {
        setSelectedItem(item);
        setIsSheetOpen(true);
    };

    const handleCreate = () => {
        setSelectedItem(null);
        setIsSheetOpen(true);
    };

    const handleImport = async (data: any[]) => {
        try {
            const itemsToInsert = await Promise.all(data.map(async (row) => {
                const incomeAccountId = await resolveAccount(row.income_account_id);
                const expenseAccountId = await resolveAccount(row.expense_account_id);
                
                return {
                    name: row.name,
                    description: row.description,
                    type: (row.type?.toLowerCase() === "product" ? "product" : "service") as "product" | "service",
                    unit: row.unit || "hrs",
                    default_rate: Math.round((parseFloat(row.default_rate) || 0) * 100),
                    income_account_id: incomeAccountId,
                    expense_account_id: expenseAccountId,
                    is_active: true
                };
            }));

            // Filter out rows with missing required fields or unresolved accounts
            const validItems = itemsToInsert.filter(item => 
                item.name && item.income_account_id && item.expense_account_id
            );

            if (validItems.length === 0) {
                throw new Error("No valid items found. Please check account names and required fields.");
            }

            const { error } = await (supabase.from("items") as any).insert(validItems);
            if (error) throw error;

            toast.success(`Successfully imported ${validItems.length} items`);
            if (validItems.length < itemsToInsert.length) {
                toast.warning(`${itemsToInsert.length - validItems.length} rows were skipped due to errors.`);
            }
            fetchData();
        } catch (error: any) {
            throw error;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Items</h2>
                    <p className="text-zinc-500">Manage your products and services.</p>
                </div>
                {!isViewer && (
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import
                        </Button>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Item
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                        placeholder="Search items..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <ItemTable
                items={filteredItems}
                accounts={accounts}
                onEdit={handleEdit}
                isLoading={isLoading}
            />

            <ItemSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                item={selectedItem}
                accounts={accounts}
                onSuccess={fetchData}
            />

            <ImportDialog
                open={isImportOpen}
                onOpenChange={setIsImportOpen}
                title="Import Items"
                description="Upload a CSV file to import products and services in bulk."
                sampleCsvUrl="/samples/items_sample.csv"
                fields={[
                    { key: "name", label: "Name", required: true },
                    { key: "description", label: "Description" },
                    { key: "type", label: "Type (Product/Service)" },
                    { key: "unit", label: "Unit (hrs, pcs, etc.)" },
                    { key: "default_rate", label: "Default Rate" },
                    { key: "income_account_id", label: "Income Account", required: true },
                    { key: "expense_account_id", label: "Expense Account", required: true },
                ]}
                onImport={handleImport}
            />
        </div>
    );
}
