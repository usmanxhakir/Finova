"use client";

import { ProjectsTable } from "@/components/projects/ProjectsTable";

interface ContactProjectsTabProps {
    contact: any;
    projects: any[];
    isViewer?: boolean;
}

export function ContactProjectsTab({ contact, projects, isViewer }: ContactProjectsTabProps) {
    // Pass the contact down to prefill the project sheet customer field
    const customers = [contact];

    return (
        <div className="mt-4">
            <ProjectsTable 
                projects={projects} 
                isViewer={isViewer} 
                customers={customers} 
                contactId={contact.id} 
            />
        </div>
    );
}
