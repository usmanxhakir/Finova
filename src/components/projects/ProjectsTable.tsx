"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectSheet } from "./ProjectSheet";

interface ProjectsTableProps {
    projects: any[];
    isViewer?: boolean;
    customers?: any[];
    contactId?: string; // If passed, pre-fill this customer and only show their projects
}

export function ProjectsTable({ projects, isViewer, customers = [], contactId }: ProjectsTableProps) {
    const router = useRouter();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const displayProjects = contactId 
        ? projects.filter(p => p.contact_id === contactId)
        : projects;

    return (
        <div className="space-y-4">
            {!isViewer && (
                <div className="flex justify-end">
                    <Button onClick={() => setIsSheetOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </div>
            )}
            
            {displayProjects.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg">
                    <p className="text-zinc-500">No projects found</p>
                </div>
            ) : (
                <div className="rounded-md border bg-white dark:bg-zinc-950">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                {!contactId && <TableHead>Customer</TableHead>}
                                <TableHead>Status</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead className="text-right">Budget</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayProjects.map((project) => (
                                <TableRow
                                    key={project.id}
                                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                    onClick={() => router.push(`/projects/${project.id}`)}
                                >
                                    <TableCell className="font-medium">{project.code || "-"}</TableCell>
                                    <TableCell className="font-medium">{project.name}</TableCell>
                                    {!contactId && <TableCell>{project.contacts?.name || "-"}</TableCell>}
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "capitalize",
                                                project.status === "active" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                                project.status === "completed" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                                project.status === "archived" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                            )}
                                        >
                                            {project.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : "-"}</TableCell>
                                    <TableCell>{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : "-"}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(project.budget)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <ProjectSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                customers={customers}
                initialContactId={contactId}
                onSuccess={() => router.refresh()}
            />
        </div>
    );
}
