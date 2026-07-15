"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectSheet } from "./ProjectSheet";

interface ProjectDetailHeaderProps {
    project: any;
    customers: any[];
    isViewer?: boolean;
}

export function ProjectDetailHeader({ project, customers, isViewer }: ProjectDetailHeaderProps) {
    const router = useRouter();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Link
                    href="/projects"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Projects
                </Link>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                        {project.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        {project.code && (
                            <>
                                <span className="font-medium text-foreground">Code:</span> {project.code}
                                <span>•</span>
                            </>
                        )}
                        <span className="font-medium text-foreground">Customer:</span> 
                        <Link href={`/contacts/${project.contact_id}`} className="hover:underline text-indigo-600">
                            {project.contacts?.name || "Unknown"}
                        </Link>
                        <span>•</span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "capitalize font-medium text-xs py-0",
                                project.status === "active" && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
                                project.status === "completed" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
                                project.status === "archived" && "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400"
                            )}
                        >
                            {project.status}
                        </Badge>
                    </div>
                </div>
                
                {!isViewer && (
                    <Button variant="outline" onClick={() => setIsSheetOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Project
                    </Button>
                )}
            </div>

            <ProjectSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                project={project}
                customers={customers}
                onSuccess={() => router.refresh()}
            />
        </div>
    );
}
