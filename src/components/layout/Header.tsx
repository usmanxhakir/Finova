"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

import { SearchBar } from "./SearchBar";

export function Header() {
    const router = useRouter();
    const supabase = createClient();
    const [companyName, setCompanyName] = useState("My Company");

    useEffect(() => {
        async function getCompany() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await (supabase
                .from('profiles') as any)
                .select('company_id')
                .eq('id', user.id)
                .single()

            if (!profile?.company_id) return

            const { data, error } = await (supabase
                .from('companies') as any)
                .select('name')
                .eq('id', profile.company_id)
                .single()

            if (data && !error) {
                setCompanyName(data.name)
            }
        }
        getCompany();
    }, [supabase]);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error("Error signing out");
        } else {
            router.push("/login");
            router.refresh();
            toast.success("Signed out successfully");
        }
    };

    return (
        <header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    {companyName}
                </h1>
            </div>

            <div className="flex-1 flex justify-center px-4">
                <SearchBar />
            </div>

            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </header>
    );
}
