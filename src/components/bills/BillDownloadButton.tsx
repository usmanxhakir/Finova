'use client'

import { PDFDownloadLink } from '@react-pdf/renderer'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BillPDF } from './BillPDF'
import { useEffect, useState } from 'react'

interface BillDownloadButtonProps {
    bill: any
    settings: any
}

export function BillDownloadButton({ bill, settings }: BillDownloadButtonProps) {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted) {
        return (
            <Button variant="outline" disabled>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
            </Button>
        )
    }

    return (
        <PDFDownloadLink
            document={<BillPDF bill={bill} settings={settings} />}
            fileName={`Bill-${bill.number}.pdf`}
        >
            {({ blob, url, loading, error }) => (
                <Button variant="outline" disabled={loading}>
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    {loading ? 'Generating...' : 'Download PDF'}
                </Button>
            )}
        </PDFDownloadLink>
    )
}
