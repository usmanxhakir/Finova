"use client";

import { createClient } from "@/lib/supabase/client";
import { Settings, Building2 } from "lucide-react";
import { useEffect, useState } from "react";

import Link from "next/link";
import { SearchBar } from "./SearchBar";

export function Header() {
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
                <Link
                    href="/settings"
                    className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
                >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                </Link>
            </div>
        </header>
    );
}
