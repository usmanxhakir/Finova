'use client'

import { Button } from '@/components/ui/button'
import { Printer, Download, ArrowLeft, FileText, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'

interface ReportHeaderProps {
    title: string
    description?: string
    onPdf?: () => void
    onExcel?: () => void
}

export function ReportHeader({ title, description, onPdf, onExcel }: ReportHeaderProps) {
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
                    <Button variant="outline" size="sm" onClick={onPdf}>
                        <FileText className="h-4 w-4 mr-2" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExcel}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                    </Button>
                </div>
            </div>
        </div>
    )
}
