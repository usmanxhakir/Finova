'use client'

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Image,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: '#18181b', // zinc-900
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        alignItems: 'flex-start',
    },
    companyInfo: {
        flex: 1,
    },
    logo: {
        width: 120,
        height: 'auto',
        marginBottom: 10,
    },
    companyName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    titleContainer: {
        textAlign: 'right',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#6366f1', // indigo-600 (matching brand)
    },
    invoiceNumber: {
        fontSize: 12,
        marginTop: 4,
    },
    details: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    billTo: {
        flex: 1,
    },
    label: {
        fontSize: 8,
        textTransform: 'uppercase',
        color: '#71717a', // zinc-500
        marginBottom: 4,
        fontWeight: 'bold',
    },
    address: {
        lineHeight: 1.4,
    },
    dates: {
        textAlign: 'right',
    },
    table: {
        marginTop: 20,
    },
    tableHead: {
        flexDirection: 'row',
        backgroundColor: '#f4f4f5', // zinc-100
        padding: 8,
        fontWeight: 'bold',
        borderBottomWidth: 1,
        borderBottomColor: '#e4e4e7', // zinc-200
    },
    tableRow: {
        flexDirection: 'row',
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f4f4f5', // zinc-100
    },
    description: { flex: 4 },
    qty: { flex: 1, textAlign: 'right' },
    rate: { flex: 1, textAlign: 'right' },
    amount: { flex: 1, textAlign: 'right' },
    totalsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
    },
    totals: {
        width: 180,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e4e4e7',
        fontWeight: 'bold',
        fontSize: 14,
        color: '#6366f1',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        borderTopWidth: 1,
        borderTopColor: '#f4f4f5',
        paddingTop: 10,
        textAlign: 'center',
        color: '#a1a1aa', // zinc-400
        fontSize: 8,
    },
    notes: {
        marginTop: 40,
        padding: 10,
        backgroundColor: '#fafafa',
        borderRadius: 4,
    }
})

interface InvoicePDFProps {
    invoice: any
    settings: any
}

// Helper component to handle logo rendering (fetching base64)
const CompanyLogo = ({ logoUrl }: { logoUrl?: string }) => {
    const [base64, setBase64] = useState<string | null>(null)

    useEffect(() => {
        if (!logoUrl) return

        const fetchImage = async () => {
            try {
                const response = await fetch(logoUrl)
                const blob = await response.blob()
                const reader = new FileReader()
                reader.onloadend = () => {
                    setBase64(reader.result as string)
                }
                reader.readAsDataURL(blob)
            } catch (error) {
                console.error('Error fetching logo for PDF:', error)
            }
        }
        fetchImage()
    }, [logoUrl])

    if (!base64) return null
    return <Image src={base64} style={styles.logo} />
}

export function InvoicePDF({ invoice, settings }: InvoicePDFProps) {
    const formatCurrencyDisplay = (amount: number) => {
        return (amount / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: settings?.default_currency || 'USD',
        })
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.companyInfo}>
                        {settings?.logo_url ? (
                            <CompanyLogo logoUrl={settings.logo_url} />
                        ) : null}
                        <Text style={styles.companyName}>{settings?.name || 'Your Company'}</Text>
                        <Text>{settings?.email || ''}</Text>
                        <Text>{settings?.phone || ''}</Text>
                        <Text>{settings?.address || ''}</Text>
                        <Text>{settings?.city || ''}, {settings?.state || ''} {settings?.zip || ''}</Text>
                    </View>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>INVOICE</Text>
                        <Text style={styles.invoiceNumber}>#{invoice.number}</Text>
                    </View>
                </View>

                {/* Details */}
                <View style={styles.details}>
                    <View style={styles.billTo}>
                        <Text style={styles.label}>Bill To</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{invoice.contacts?.name}</Text>
                        <View style={styles.address}>
                            <Text>{invoice.contacts?.billing_address}</Text>
                            <Text>{invoice.contacts?.billing_city}, {invoice.contacts?.billing_state} {invoice.contacts?.billing_zip}</Text>
                        </View>
                    </View>
                    <View style={styles.dates}>
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.label}>Issue Date</Text>
                            <Text>{invoice.issue_date ? format(new Date(invoice.issue_date), 'MMM d, yyyy') : ''}</Text>
                        </View>
                        <View>
                            <Text style={styles.label}>Due Date</Text>
                            <Text>{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : ''}</Text>
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    <View style={styles.tableHead}>
                        <Text style={styles.description}>Description</Text>
                        <Text style={styles.qty}>Qty</Text>
                        <Text style={styles.rate}>Rate</Text>
                        <Text style={styles.amount}>Amount</Text>
                    </View>
                    {invoice.invoice_line_items?.map((item: any, i: number) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={styles.description}>{item.description}</Text>
                            <Text style={styles.qty}>{item.quantity}</Text>
                            <Text style={styles.rate}>{formatCurrencyDisplay(item.rate)}</Text>
                            <Text style={styles.amount}>{formatCurrencyDisplay(item.amount)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totals */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totals}>
                        <View style={styles.totalRow}>
                            <Text>Subtotal</Text>
                            <Text>{formatCurrencyDisplay(invoice.subtotal)}</Text>
                        </View>
                        {invoice.discount_amount > 0 && (
                            <View style={styles.totalRow}>
                                <Text>Discount</Text>
                                <Text>-{formatCurrencyDisplay(invoice.discount_amount)}</Text>
                            </View>
                        )}
                        {invoice.tax_amount > 0 && (
                            <View style={styles.totalRow}>
                                <Text>Tax</Text>
                                <Text>{formatCurrencyDisplay(invoice.tax_amount)}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotalRow}>
                            <Text>Total</Text>
                            <Text>{formatCurrencyDisplay(invoice.total)}</Text>
                        </View>
                        {invoice.amount_paid > 0 && (
                            <View style={[styles.totalRow, { marginTop: 4 }]}>
                                <Text style={{ color: '#71717a' }}>Amount Paid</Text>
                                <Text style={{ color: '#71717a' }}>{formatCurrencyDisplay(invoice.amount_paid)}</Text>
                            </View>
                        )}
                        <View style={[styles.totalRow, { fontWeight: 'bold' }]}>
                            <Text>Balance Due</Text>
                            <Text>{formatCurrencyDisplay(invoice.amount_due)}</Text>
                        </View>
                    </View>
                </View>

                {/* Notes & Terms */}
                {(invoice.notes || invoice.terms) && (
                    <View style={styles.notes}>
                        {invoice.notes && (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={styles.label}>Notes</Text>
                                <Text>{invoice.notes}</Text>
                            </View>
                        )}
                        {invoice.terms && (
                            <View>
                                <Text style={styles.label}>Terms & Conditions</Text>
                                <Text>{invoice.terms}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Footer */}
                <Text style={styles.footer}>
                    {settings?.invoice_footer || `Thank you for your business!`}
                </Text>
            </Page>
        </Document>
    )
}
