import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContactDetailHeaderProps {
    contact: any;
}

export function ContactDetailHeader({ contact }: ContactDetailHeaderProps) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Link
                    href="/contacts"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Contacts
                </Link>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {contact.name}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <Badge
                            variant="outline"
                            className={cn(
                                "capitalize font-medium text-xs py-0",
                                contact.type === "customer" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
                                contact.type === "vendor" && "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
                                contact.type === "both" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400"
                            )}
                        >
                            {contact.type}
                        </Badge>
                        {contact.email && (
                            <>
                                <span>•</span>
                                <span>{contact.email}</span>
                            </>
                        )}
                        {contact.phone && (
                            <>
                                <span>•</span>
                                <span>{contact.phone}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
