"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    FileText,
    Receipt,
    CreditCard,
    Users,
    Package,
    BookOpen,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ArrowRightLeft,
    ClipboardList,
    Landmark,
    Plus,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Invoices", href: "/invoices", icon: FileText },
    { name: "Bills", href: "/bills", icon: Receipt },
    { name: "Expenses", href: "/expenses", icon: CreditCard },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "Items", href: "/items", icon: Package },
];

const reportSubItems = [
    { name: "Profit & Loss", href: "/reports/pl" },
    { name: "Balance Sheet", href: "/reports/balance-sheet" },
    { name: "A/R Aging", href: "/reports/ar-aging" },
    { name: "A/P Aging", href: "/reports/ap-aging" },
    { name: "Transaction List", href: "/reports/transactions" },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [reportsExpanded, setReportsExpanded] = useState(false);

    // Dynamic badge for reconciliation
    const [hasUnreconciled, setHasUnreconciled] = useState(false);

    useEffect(() => {
        async function checkUnreconciled() {
            try {
                const res = await fetch('/api/reconciliation/accounts');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setHasUnreconciled(data.some((a: any) => a.unreconciled_count > 0));
                }
            } catch (err) {
                console.error('Failed to check unreconciled accounts', err);
            }
        }
        checkUnreconciled();
    }, []);

    return (
        <aside
            className={cn(
                "flex flex-col border-r bg-white/60 backdrop-blur-2xl border-violet-200/20 transition-all duration-300",
                collapsed ? "w-16" : "w-64"
            )}
        >
            <div className="flex h-16 items-center border-b border-violet-200/20 px-4">
                <Link 
                    href="/dashboard" 
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                    <img 
                        src="/finova-icon.png" 
                        alt="Finova Logo" 
                        className="h-8 w-8 min-w-[32px] rounded-lg object-cover"
                    />
                    {!collapsed && (
                        <span className="text-xl font-bold tracking-tight text-[#7c3aed]">
                            Finova
                        </span>
                    )}
                </Link>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("ml-auto", collapsed && "mx-auto")}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </Button>
            </div>
            <div className="p-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            className={cn(
                                "w-full justify-start gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-lg shadow-violet-200/50 transition-all duration-300",
                                collapsed ? "px-0 justify-center h-10 w-10 mx-auto rounded-full" : "h-11 px-4 rounded-xl"
                            )}
                        >
                            <Plus size={collapsed ? 22 : 18} className={cn("transition-transform", collapsed ? "" : "mr-1")} />
                            {!collapsed && <span className="font-semibold text-sm">New</span>}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={collapsed ? "center" : "start"} className="w-56 p-2 rounded-xl border-violet-100 shadow-xl" side={collapsed ? "right" : "bottom"}>
                        <Link href="/invoices/new">
                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 py-2.5">
                                <FileText className="mr-2 h-4 w-4 text-zinc-400" />
                                <span>New Invoice</span>
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/bills/new">
                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 py-2.5">
                                <Receipt className="mr-2 h-4 w-4 text-zinc-400" />
                                <span>New Bill</span>
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/expenses">
                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 py-2.5">
                                <CreditCard className="mr-2 h-4 w-4 text-zinc-400" />
                                <span>New Expense</span>
                            </DropdownMenuItem>
                        </Link>
                        <div className="h-px bg-zinc-100 my-1 mx-1" />
                        <Link href="/pay-bills">
                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 py-2.5">
                                <ArrowRightLeft className="mr-2 h-4 w-4 text-zinc-400" />
                                <span>Pay Bills</span>
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/receive-payments">
                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 py-2.5">
                                <Landmark className="mr-2 h-4 w-4 text-zinc-400" />
                                <span>Receive Payment</span>
                            </DropdownMenuItem>
                        </Link>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <nav className="flex-1 space-y-1 p-2 overflow-y-auto w-full">
                {navItems.map((item: any) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-violet-50 text-[#6d28d9] border border-violet-100/50"
                                    : "text-zinc-600 hover:bg-violet-50/50 hover:text-[#7c3aed]",
                                collapsed && "justify-center px-2"
                            )}
                            title={collapsed ? item.name : ""}
                        >
                            <item.icon
                                size={20}
                                className={cn(
                                    isActive ? "text-[#6d28d9]" : "text-zinc-500"
                                )}
                            />
                            {!collapsed && <span className="ml-3">{item.name}</span>}
                        </Link>
                    );
                })}

                {/* Accounting Section */}
                <div className="pt-4 pb-2 px-3">
                    {!collapsed && (
                        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Accounting
                        </p>
                    )}
                    <Link
                        href="/accounts"
                        className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            pathname === "/accounts" || pathname.startsWith("/accounts/")
                                ? "bg-violet-50 text-[#6d28d9] border border-violet-100/50"
                                : "text-zinc-600 hover:bg-violet-50/50 hover:text-[#7c3aed]",
                            collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? "Chart of Accounts" : ""}
                    >
                        <BookOpen
                            size={20}
                            className={cn(
                                (pathname === "/accounts" || pathname.startsWith("/accounts/")) ? "text-[#6d28d9]" : "text-zinc-500"
                            )}
                        />
                        {!collapsed && <span className="ml-3">Chart of Accounts</span>}
                    </Link>

                    <Link
                        href="/journal-entries"
                        className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            pathname === "/journal-entries" || pathname.startsWith("/journal-entries/")
                                ? "bg-violet-50 text-[#6d28d9] border border-violet-100/50"
                                : "text-zinc-600 hover:bg-violet-50/50 hover:text-[#7c3aed]",
                            collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? "Journal Entries" : ""}
                    >
                        <ClipboardList
                            size={20}
                            className={cn(
                                (pathname === "/journal-entries" || pathname.startsWith("/journal-entries/")) ? "text-[#6d28d9]" : "text-zinc-500"
                            )}
                        />
                        {!collapsed && <span className="ml-3">Journal Entries</span>}
                    </Link>

                    <Link
                        href="/banking"
                        className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
                            pathname === "/banking" || pathname.startsWith("/banking/")
                                ? "bg-violet-50 text-[#6d28d9] border border-violet-100/50"
                                : "text-zinc-600 hover:bg-violet-50/50 hover:text-[#7c3aed]",
                            collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? "Banking" : ""}
                    >
                        <div className="relative">
                            <Landmark
                                size={20}
                                className={cn(
                                    (pathname === "/banking" || pathname.startsWith("/banking/")) ? "text-[#6d28d9]" : "text-zinc-500"
                                )}
                            />
                            {hasUnreconciled && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-rose-500" />
                            )}
                        </div>
                        {!collapsed && <span className="ml-3">Banking</span>}
                    </Link>
                </div>

                {/* Reports Accordion */}
                <div className="w-full">
                    {!collapsed && (
                        <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Analysis
                        </p>
                    )}
                    <div className="flex w-full items-center">
                        <Link
                            href="/reports"
                            className={cn(
                                "flex flex-1 items-center rounded-l-lg px-3 py-2 text-sm font-medium transition-all",
                                (pathname === "/reports" || pathname.startsWith("/reports/"))
                                    ? "bg-violet-50 text-[#6d28d9] border-y border-l border-violet-100/50"
                                    : "text-zinc-600 hover:bg-violet-50/50 hover:text-[#7c3aed]",
                                collapsed && "justify-center px-2 rounded-lg border-y border-x"
                            )}
                            title={collapsed ? "Reports" : ""}
                        >
                            <BarChart3
                                size={20}
                                className={cn(
                                    (pathname === "/reports" || pathname.startsWith("/reports/")) ? "text-[#6d28d9]" : "text-zinc-500"
                                )}
                            />
                            {!collapsed && <span className="ml-3 flex-1 text-left">Reports</span>}
                        </Link>
                        {!collapsed && (
                            <button
                                onClick={() => setReportsExpanded(!reportsExpanded)}
                                className={cn(
                                    "flex items-center justify-center rounded-r-lg px-3 py-2 transition-all border-y border-r border-transparent",
                                    (pathname === "/reports" || pathname.startsWith("/reports/"))
                                        ? "bg-violet-50 text-[#6d28d9] border-violet-100/50"
                                        : "text-zinc-500 hover:bg-violet-50/50 hover:text-[#7c3aed]"
                                )}
                            >
                                <ChevronDown
                                    size={16}
                                    className={cn(
                                        "transition-transform duration-200",
                                        reportsExpanded ? "rotate-180" : ""
                                    )}
                                />
                            </button>
                        )}
                    </div>
                    {!collapsed && reportsExpanded && (
                        <div className="mt-1 space-y-1 w-full">
                            {reportSubItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ml-6",
                                            isActive
                                                ? "text-[#6d28d9] bg-violet-50/50"
                                                : "text-zinc-600 hover:text-[#7c3aed] hover:bg-violet-50/30"
                                        )}
                                        onClick={(e) => {
                                            if (item.href === "#") {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                    <Link
                        href="/settings"
                        className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors mt-2",
                            pathname === "/settings" || pathname.startsWith("/settings/")
                                ? "bg-violet-50 text-[#6d28d9] border border-violet-100/50"
                                : "text-zinc-600 hover:bg-violet-50/50 hover:text-[#7c3aed]",
                            collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? "Settings" : ""}
                    >
                        <Settings
                            size={20}
                            className={cn(
                                pathname === "/settings" || pathname.startsWith("/settings/") ? "text-[#6d28d9]" : "text-zinc-500"
                            )}
                        />
                        {!collapsed && <span className="ml-3">Settings</span>}
                    </Link>
            </nav>

            <div className="border-t p-4">
                {/* User profile could go here in the future */}
                {!collapsed && (
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center text-[#6d28d9] font-bold">
                            U
                        </div>
                        <div className="flex flex-col overflow-hidden max-w-full">
                            <span className="text-xs font-medium truncate">User Name</span>
                            <span className="text-[10px] text-zinc-500 truncate">Admin</span>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
