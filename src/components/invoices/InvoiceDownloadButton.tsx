'use client'

import { PDFDownloadLink } from '@react-pdf/renderer'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePDF } from './InvoicePDF'
import { useEffect, useState } from 'react'

interface InvoiceDownloadButtonProps {
    invoice: any
    settings: any
}

export function InvoiceDownloadButton({ invoice, settings }: InvoiceDownloadButtonProps) {
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
            document={<InvoicePDF invoice={invoice} settings={settings} />}
            fileName={`Invoice-${invoice.number}.pdf`}
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
