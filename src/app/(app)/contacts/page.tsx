"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ContactTable } from "@/components/contacts/ContactTable";
import { ContactSheet, normalizeContactType } from "@/components/contacts/ContactSheet";
import { ImportDialog } from "@/components/ui/ImportDialog";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/types/database.types";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export default function ContactsPage() {
    const supabase = createClient();
    const { isViewer } = useUserRole();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    const fetchContacts = useCallback(async () => {
        try {
            setIsLoading(true);
            let query = supabase.from("contacts").select("*").order("name");

            if (typeFilter !== "all") {
                query = query.eq("type", typeFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setContacts(data || []);
        } catch (error: any) {
            toast.error(error.message || "Failed to fetch contacts");
        } finally {
            setIsLoading(false);
        }
    }, [supabase, typeFilter]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

    const filteredContacts = contacts.filter((contact) =>
        contact.name.toLowerCase().includes(search.toLowerCase()) ||
        contact.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (contact: Contact) => {
        setSelectedContact(contact);
        setIsSheetOpen(true);
    };

    const handleCreate = () => {
        setSelectedContact(null);
        setIsSheetOpen(true);
    };

    const handleImport = async (data: any[]) => {
        try {
            const contactsToInsert = data.map(row => ({
                name: row.name,
                type: normalizeContactType(row.type),
                email: row.email || null,
                phone: row.phone || null,
                website: row.website || null,
                billing_address: row.billing_address || row.address || null,
                billing_city: row.billing_city || row.city || null,
                billing_state: row.billing_state || row.state || null,
                billing_zip: row.billing_zip || row.zip || null,
                billing_country: row.billing_country || row.country || null,
                tax_number: row.tax_number || null,
                notes: row.notes || null,
                is_active: true
            }));

            const validContacts = contactsToInsert.filter(c => c.name);

            if (validContacts.length === 0) {
                throw new Error("No valid contacts found. Name is required.");
            }

            const { error } = await (supabase.from("contacts") as any).insert(validContacts);
            if (error) throw error;

            toast.success(`Successfully imported ${validContacts.length} contacts`);
            fetchContacts();
        } catch (error: any) {
            throw error;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Contacts</h2>
                    <p className="text-zinc-500">Manage your customers and vendors.</p>
                </div>
                {!isViewer && (
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import
                        </Button>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Contact
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                        placeholder="Search contacts..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-500" />
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="customer">Customers</SelectItem>
                            <SelectItem value="vendor">Vendors</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <ContactTable
                contacts={filteredContacts}
                onEdit={handleEdit}
                isLoading={isLoading}
            />

            <ContactSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                contact={selectedContact}
                onSuccess={fetchContacts}
            />

            <ImportDialog
                open={isImportOpen}
                onOpenChange={setIsImportOpen}
                title="Import Contacts"
                description="Upload a CSV file to import customers and vendors in bulk."
                sampleCsvUrl="/samples/contacts_sample.csv"
                fields={[
                    { key: "name", label: "Name", required: true },
                    { key: "type", label: "Type (Customer/Vendor/Both)" },
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone" },
                    { key: "website", label: "Website" },
                    { key: "billing_address", label: "Address" },
                    { key: "billing_city", label: "City" },
                    { key: "billing_state", label: "State" },
                    { key: "billing_zip", label: "Zip/Postal Code" },
                    { key: "billing_country", label: "Country" },
                    { key: "tax_number", label: "Tax Number" },
                    { key: "notes", label: "Notes" },
                ]}
                onImport={handleImport}
            />
        </div>
    );
}
