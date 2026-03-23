'use client'

import { Button } from '@/components/ui/button'
import { Printer, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ReportHeaderProps {
    title: string
    description?: string
    onPrint?: () => void
    onExport?: () => void
}

export function ReportHeader({ title, description, onPrint, onExport }: ReportHeaderProps) {
    const defaultPrint = () => window.print()

    return (
        <div className="flex flex-col gap-4 mb-6 print:hidden">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="-ml-2">
                    <Link href="/reports">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Reports
                    </Link>
                </Button>
            </div>
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    {description && <p className="text-muted-foreground">{description}</p>}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onPrint || defaultPrint}>
                        <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExport}>
                        <Download className="h-4 w-4 mr-2" /> Export
                    </Button>
                </div>
            </div>
        </div>
    )
}
