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
    Sparkles,
    MoreHorizontal,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── Pulse ring animation injected once ───────────────────────────────────────
const PULSE_STYLE = `
@keyframes pulse-ring {
  0%   { transform: scale(0.8); opacity: 0.8; }
  100% { transform: scale(2.2); opacity: 0; }
}
.pulse-ring::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: rgb(239 68 68);
  animation: pulse-ring 1.4s cubic-bezier(0.4,0,0.6,1) infinite;
}
`;

// ─── Nav data ─────────────────────────────────────────────────────────────────
const navItems = [
    { name: "AI Agent",   href: "/agent",     icon: Sparkles,       badge: "Beta", isAgent: true },
    { name: "Dashboard",  href: "/dashboard", icon: LayoutDashboard },
    { name: "Invoices",   href: "/invoices",  icon: FileText },
    { name: "Bills",      href: "/bills",     icon: Receipt },
    { name: "Expenses",   href: "/expenses",  icon: CreditCard },
    { name: "Contacts",   href: "/contacts",  icon: Users },
    { name: "Items",      href: "/items",     icon: Package },
];

const reportSubItems = [
    { name: "Profit & Loss",    href: "/reports/pl" },
    { name: "Balance Sheet",    href: "/reports/balance-sheet" },
    { name: "A/R Aging",        href: "/reports/ar-aging" },
    { name: "A/P Aging",        href: "/reports/ap-aging" },
    { name: "Transaction List", href: "/reports/transactions" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [reportsExpanded, setReportsExpanded] = useState(false);
    const [hasUnreconciled, setHasUnreconciled] = useState(false);
    const [unreconciledCount, setUnreconciledCount] = useState(0);

    useEffect(() => {
        async function checkUnreconciled() {
            try {
                const res = await fetch('/api/reconciliation/accounts');
                const data = await res.json();
                if (Array.isArray(data)) {
                    const count = data.reduce((s: number, a: any) => s + (a.unreconciled_count ?? 0), 0);
                    setHasUnreconciled(count > 0);
                    setUnreconciledCount(count);
                }
            } catch (err) {
                console.error('Failed to check unreconciled accounts', err);
            }
        }
        checkUnreconciled();
    }, []);

    // ── Shared active/inactive classes ────────────────────────────────────────
    const activeItem = "bg-violet-50 text-[#6d28d9] border border-violet-100/80";
    const inactiveItem = "text-zinc-600 hover:bg-gray-50 hover:text-gray-900 hover:translate-x-0.5";
    const activeIcon  = "bg-violet-100 text-[#6d28d9]";
    const inactiveIcon = "text-zinc-500";

    const navLinkClass = (active: boolean, extra = "") =>
        cn(
            "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            active ? activeItem : inactiveItem,
            extra,
        );

    const iconBoxClass = (active: boolean) =>
        cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            active ? activeIcon : inactiveIcon,
        );

    // ── Collapsed nav item ────────────────────────────────────────────────────
    const collapsedItem = (active: boolean, extra = "") =>
        cn(
            "flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-150",
            active ? activeItem : "text-zinc-400 hover:bg-gray-50 hover:text-zinc-700",
            extra,
        );

    return (
        <TooltipProvider delayDuration={100}>
            {/* Inject pulse keyframes once */}
            <style dangerouslySetInnerHTML={{ __html: PULSE_STYLE }} />

            <aside
                className={cn(
                    "flex flex-col bg-white border-r border-gray-100 rounded-r-2xl",
                    "shadow-[2px_0_8px_rgba(0,0,0,0.04)]",
                    "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex h-16 items-center border-b border-gray-100 px-4 gap-2">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                    >
                        {/* Logo icon */}
                        <div className="w-8 h-8 rounded-lg bg-[#7c3aed] flex items-center justify-center text-white shrink-0">
                            <img
                                src="/finova-icon.png"
                                alt="Fyntrax Logo"
                                className="h-6 w-6 object-cover rounded"
                            />
                        </div>
                        {!collapsed && (
                            <span className="font-bold text-lg text-gray-900 tracking-tight">
                                Fyntrax
                            </span>
                        )}
                    </Link>

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            "w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors",
                            collapsed ? "mx-auto" : "ml-auto"
                        )}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <ChevronLeft
                            size={15}
                            className={cn("transition-transform duration-300", collapsed && "rotate-180")}
                        />
                    </button>
                </div>

                {/* ── New button ──────────────────────────────────────────── */}
                <div className={cn("px-4 py-3", collapsed && "flex justify-center")}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            {collapsed ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button className="w-10 h-10 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white flex items-center justify-center shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105 transition-all duration-150">
                                            <Plus size={20} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={8}>
                                        <p>Create New</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <button className="w-full h-11 flex items-center justify-between px-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-sm shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all duration-150">
                                    <div className="flex items-center gap-2">
                                        <Plus size={17} />
                                        <span>New</span>
                                    </div>
                                    <ChevronDown size={14} className="opacity-70" />
                                </button>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align={collapsed ? "center" : "start"}
                            side={collapsed ? "right" : "bottom"}
                            className="w-56 p-2 rounded-xl border-violet-100 shadow-xl"
                        >
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
                            <Link href="/journal-entries/new">
                                <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-violet-50 focus:text-violet-700 py-2.5">
                                    <ClipboardList className="mr-2 h-4 w-4 text-zinc-400" />
                                    <span>New Journal Entry</span>
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

                {/* ── Navigation ──────────────────────────────────────────── */}
                <nav className="flex-1 px-2 pb-2 space-y-0.5 overflow-y-auto">

                    {/* Main nav items */}
                    {navItems.map((item: any) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                        if (collapsed) {
                            return (
                                <Tooltip key={item.name}>
                                    <TooltipTrigger asChild>
                                        <Link href={item.href} className={collapsedItem(isActive || item.isAgent)}>
                                            <item.icon size={18} />
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={8}>
                                        <p>{item.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={navLinkClass(isActive || item.isAgent)}
                            >
                                <div className={iconBoxClass(isActive || item.isAgent)}>
                                    <item.icon size={16} />
                                </div>
                                <span>{item.name}</span>
                                {item.badge && (
                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-200 text-violet-800">
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                    {/* ── ACCOUNTING section ────────────────────────────── */}
                    {collapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center justify-center my-3 cursor-default">
                                    <div className="relative flex items-center justify-center w-6 h-[3px] bg-gray-200 rounded-full">
                                        <div className="absolute w-[3px] h-[3px] bg-gray-300 rounded-full" />
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                                <p>Accounting</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="pt-5 pb-2 px-3">
                            <p className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">
                                Accounting
                            </p>
                        </div>
                    )}

                    {/* Chart of Accounts */}
                    {(() => {
                        const isActive = pathname === "/accounts" || pathname.startsWith("/accounts/");
                        return collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href="/accounts" className={collapsedItem(isActive)}>
                                        <BookOpen size={18} />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                    <p><span className="text-gray-400 mr-1">Accounting ·</span> Chart of Accounts</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Link href="/accounts" className={navLinkClass(isActive)}>
                                <div className={iconBoxClass(isActive)}><BookOpen size={16} /></div>
                                <span>Chart of Accounts</span>
                            </Link>
                        );
                    })()}

                    {/* Journal Entries */}
                    {(() => {
                        const isActive = pathname === "/journal-entries" || pathname.startsWith("/journal-entries/");
                        return collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href="/journal-entries" className={collapsedItem(isActive)}>
                                        <ClipboardList size={18} />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                    <p><span className="text-gray-400 mr-1">Accounting ·</span> Journal Entries</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Link href="/journal-entries" className={navLinkClass(isActive)}>
                                <div className={iconBoxClass(isActive)}><ClipboardList size={16} /></div>
                                <span>Journal Entries</span>
                            </Link>
                        );
                    })()}

                    {/* Banking — with pulsing dot + count badge */}
                    {(() => {
                        const isActive = pathname === "/banking" || pathname.startsWith("/banking/");
                        return collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href="/banking" className={cn(collapsedItem(isActive), "relative")}>
                                        <Landmark size={18} />
                                        {hasUnreconciled && (
                                            <span className="absolute -top-0.5 -right-0.5 flex">
                                                <span className="pulse-ring relative w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                                            </span>
                                        )}
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                    <p><span className="text-gray-400 mr-1">Accounting ·</span> Banking</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Link href="/banking" className={navLinkClass(isActive)}>
                                <div className={cn(iconBoxClass(isActive), "relative")}>
                                    <Landmark size={16} />
                                    {hasUnreconciled && (
                                        <span className="absolute -top-0.5 -right-0.5 flex">
                                            <span className="pulse-ring relative w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                                        </span>
                                    )}
                                </div>
                                <span>Banking</span>
                                {hasUnreconciled && unreconciledCount > 0 && (
                                    <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                                        {unreconciledCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })()}

                    {/* ── ANALYSIS section ─────────────────────────────── */}
                    {collapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center justify-center my-3 cursor-default">
                                    <div className="relative flex items-center justify-center w-6 h-[3px] bg-gray-200 rounded-full">
                                        <div className="absolute w-[3px] h-[3px] bg-gray-300 rounded-full" />
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                                <p>Analysis</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="pt-5 pb-2 px-3">
                            <p className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">
                                Analysis
                            </p>
                        </div>
                    )}

                    {/* Reports accordion */}
                    {(() => {
                        const isActive = pathname === "/reports" || pathname.startsWith("/reports/");
                        return collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href="/reports" className={collapsedItem(isActive)}>
                                        <BarChart3 size={18} />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                    <p><span className="text-gray-400 mr-1">Analysis ·</span> Reports</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <>
                                <div className={cn(
                                    "flex items-center rounded-xl overflow-hidden transition-all duration-150",
                                    isActive ? activeItem : ""
                                )}>
                                    <Link
                                        href="/reports"
                                        className={cn(
                                            "flex flex-1 items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150",
                                            isActive ? "text-[#6d28d9]" : "text-zinc-600 hover:text-gray-900"
                                        )}
                                    >
                                        <div className={iconBoxClass(isActive)}><BarChart3 size={16} /></div>
                                        <span className="flex-1 text-left">Reports</span>
                                    </Link>
                                    <button
                                        onClick={() => setReportsExpanded(!reportsExpanded)}
                                        className={cn(
                                            "px-3 py-2.5 text-sm transition-colors",
                                            isActive ? "text-[#6d28d9]" : "text-zinc-500 hover:text-gray-900"
                                        )}
                                    >
                                        <ChevronDown
                                            size={15}
                                            className={cn("transition-transform duration-200", reportsExpanded && "rotate-180")}
                                        />
                                    </button>
                                </div>
                                {reportsExpanded && (
                                    <div className="mt-1 ml-11 space-y-0.5">
                                        {reportSubItems.map((sub) => (
                                            <Link
                                                key={sub.name}
                                                href={sub.href}
                                                className={cn(
                                                    "block px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                                    pathname === sub.href
                                                        ? "text-[#6d28d9] bg-violet-50"
                                                        : "text-zinc-500 hover:text-[#7c3aed] hover:bg-violet-50/40"
                                                )}
                                            >
                                                {sub.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </>
                        );
                    })()}

                    {/* Settings */}
                    {(() => {
                        const isActive = pathname === "/settings" || pathname.startsWith("/settings/");
                        return collapsed ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href="/settings" className={cn(collapsedItem(isActive), "mt-1")}>
                                        <Settings size={18} />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                    <p>Settings</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <Link href="/settings" className={cn(navLinkClass(isActive), "mt-1")}>
                                <div className={iconBoxClass(isActive)}><Settings size={16} /></div>
                                <span>Settings</span>
                            </Link>
                        );
                    })()}
                </nav>

                {/* ── User footer ─────────────────────────────────────────── */}
                <div className="border-t border-gray-100 p-3">
                    {collapsed ? (
                        <div className="flex items-center justify-center">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button className="w-10 h-10 rounded-full bg-violet-100 text-[#6d28d9] font-semibold text-sm flex items-center justify-center hover:bg-violet-200 transition-colors">
                                        U
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                    <p>User Name — Admin · Click for menu</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    ) : (
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left group">
                            <div className="w-9 h-9 rounded-full bg-violet-100 text-[#6d28d9] font-semibold text-sm flex items-center justify-center shrink-0">
                                U
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">User Name</p>
                                <p className="text-xs text-gray-400 truncate">Admin</p>
                            </div>
                            <MoreHorizontal size={16} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
                        </button>
                    )}
                </div>
            </aside>
        </TooltipProvider>
    );
}
