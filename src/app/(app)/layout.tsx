/* eslint-disable @typescript-eslint/no-explicit-any */
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let role: string | null = null;
    let plan: string | null = null;

    if (user) {
        const { data: profile } = await (supabase
            .from('profiles') as any)
            .select('role, company_id')
            .eq('id', user.id)
            .maybeSingle();

        role = profile?.role ?? null;

        if (profile?.company_id) {
            const { data: company } = await (supabase
                .from('companies') as any)
                .select('plan')
                .eq('id', profile.company_id)
                .maybeSingle();
            plan = company?.plan ?? null;
        }
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar role={role} plan={plan} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto bg-zinc-50/50 p-6 dark:bg-zinc-900/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
