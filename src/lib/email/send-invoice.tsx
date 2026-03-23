/** @jsxImportSource react */
import { Resend } from 'resend'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

// Inline PDF Component for simplicity and better server-side rendering compatibility
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#18181b' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, alignItems: 'flex-start' },
    companyInfo: { flex: 1 },
    logo: { width: 100, height: 'auto', marginBottom: 10 },
    companyName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    titleContainer: { textAlign: 'right' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#6366f1' },
    invoiceNumber: { fontSize: 12, marginTop: 4 },
    section: { marginBottom: 20 },
    label: { fontSize: 8, textTransform: 'uppercase', color: '#71717a', marginBottom: 4, fontWeight: 'bold' },
    value: { flex: 1 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f4f4f5', padding: 8, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f4f4f5', padding: 8 },
    descCol: { flex: 3 },
    qtyCol: { flex: 1, textAlign: 'right' },
    rateCol: { flex: 1, textAlign: 'right' },
    amountCol: { flex: 1, textAlign: 'right' },
    totals: { marginTop: 20, alignItems: 'flex-end' },
    totalRow: { flexDirection: 'row', marginBottom: 5, width: 200, justifyContent: 'space-between' },
    totalLabel: { textAlign: 'right', paddingRight: 10 },
    totalValue: { textAlign: 'right', fontWeight: 'bold' },
    grandTotal: { color: '#6366f1', fontSize: 14, marginTop: 10, borderTopWidth: 1, borderTopColor: '#e4e4e7', paddingTop: 10 }
})

const InvoicePDF = ({ invoice, settings, logoBase64 }: { invoice: any, settings: any, logoBase64?: string | null }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <View style={styles.companyInfo}>
                    {logoBase64 && <Image src={logoBase64} style={styles.logo} />}
                    <Text style={styles.companyName}>{settings?.name || 'Invoice'}</Text>
                    <Text>{settings?.address}</Text>
                    <Text>{settings?.city}, {settings?.state} {settings?.zip}</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>INVOICE</Text>
                    <Text style={styles.invoiceNumber}>#{invoice.number}</Text>
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bill To</Text>
                    <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{invoice.contacts?.name}</Text>
                    <Text>{invoice.contacts?.billing_address}</Text>
                    <Text>{invoice.contacts?.billing_city}, {invoice.contacts?.billing_state} {invoice.contacts?.billing_zip}</Text>
                </View>
                <View style={{ textAlign: 'right' }}>
                    <View style={{ marginBottom: 10 }}>
                        <Text style={styles.label}>Issue Date</Text>
                        <Text>{invoice.issue_date ? format(new Date(invoice.issue_date), 'MMM d, yyyy') : ''}</Text>
                    </View>
                    <View>
                        <Text style={styles.label}>Due Date</Text>
                        <Text style={{ color: '#ef4444' }}>{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : ''}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.tableHeader}>
                <Text style={styles.descCol}>Description</Text>
                <Text style={styles.qtyCol}>Qty</Text>
                <Text style={styles.rateCol}>Rate</Text>
                <Text style={styles.amountCol}>Amount</Text>
            </View>

            {invoice.invoice_line_items?.map((line: any) => (
                <View key={line.id} style={styles.tableRow}>
                    <Text style={styles.descCol}>{line.description}</Text>
                    <Text style={styles.qtyCol}>{line.quantity}</Text>
                    <Text style={styles.rateCol}>{formatCurrency(line.rate)}</Text>
                    <Text style={styles.amountCol}>{formatCurrency(line.amount)}</Text>
                </View>
            ))}

            <View style={styles.totals}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
                </View>
                {Number(invoice.tax_amount) > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Tax</Text>
                        <Text style={styles.totalValue}>{formatCurrency(invoice.tax_amount)}</Text>
                    </View>
                )}
                <View style={[styles.totalRow, styles.grandTotal]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{formatCurrency(invoice.total)}</Text>
                </View>
                <View style={[styles.totalRow, { marginTop: 5 }]}>
                    <Text style={styles.totalLabel}>Balance Due</Text>
                    <Text style={styles.totalValue}>{formatCurrency(invoice.amount_due)}</Text>
                </View>
            </View>

            {invoice.notes && (
                <View style={{ marginTop: 40, padding: 10, backgroundColor: '#f9fafb' }}>
                    <Text style={styles.label}>Notes</Text>
                    <Text style={{ fontSize: 9 }}>{invoice.notes}</Text>
                </View>
            )}
        </Page>
    </Document>
)

const resend = new Resend(process.env.RESEND_API_KEY)

async function getBase64Image(url: string) {
    try {
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return `data:${response.headers.get('content-type') || 'image/png'};base64,${buffer.toString('base64')}`
    } catch (error) {
        console.error('Error fetching image for PDF:', error)
        return null
    }
}

export async function sendInvoiceEmail({
    invoice,
    settings,
    to,
    subject,
    personalMessage
}: {
    invoice: any,
    settings: any,
    to: string,
    subject: string,
    personalMessage?: string
}) {
    try {
        // Fetch logo as base64 for PDF
        const logoBase64 = settings?.logo_url ? await getBase64Image(settings.logo_url) : null

        // Generate PDF
        const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={invoice} settings={settings} logoBase64={logoBase64} />)

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const brandColor = '#6366f1' // Indigo
        const brandColorLight = '#f5f3ff'

        const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                    .header { padding: 32px; text-align: center; border-bottom: 1px solid #e5e7eb; }
                    .logo { height: 48px; width: auto; margin-bottom: 16px; }
                    .company-name { font-size: 20px; font-weight: bold; color: ${brandColor}; margin: 0; }
                    .summary-box { padding: 32px; background-color: ${brandColorLight}; border-left: 4px solid ${brandColor}; }
                    .summary-title { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: ${brandColor}; font-weight: 700; }
                    .summary-heading { margin: 8px 0 0; font-size: 24px; color: #111827; line-height: 1.2; }
                    .summary-details { margin-top: 24px; width: 100%; border-collapse: collapse; }
                    .summary-details td { padding: 0; vertical-align: top; }
                    .detail-label { color: #6b7280; font-size: 14px; margin-bottom: 4px; }
                    .detail-value { font-weight: 600; color: #111827; }
                    .amount-card { margin-top: 24px; padding: 24px; background-color: #ffffff; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
                    .amount-label { margin: 0; color: #6b7280; font-size: 14px; }
                    .amount-value { margin: 4px 0 0; font-size: 32px; font-weight: 800; color: ${brandColor}; }
                    .personal-message { padding: 24px 32px; background-color: #f9fafb; color: #4b5563; font-style: italic; border-bottom: 1px solid #e5e7eb; }
                    .items-container { padding: 32px; }
                    .items-table { width: 100%; border-collapse: collapse; }
                    .items-table th { text-align: left; padding-bottom: 12px; color: #6b7280; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #f3f4f6; }
                    .items-table td { padding: 16px 0; border-bottom: 1px solid #f3f4f6; color: #111827; }
                    .totals-table { width: 100%; margin-top: 24px; border-collapse: collapse; }
                    .totals-table td { padding: 4px 0; }
                    .total-final { padding-top: 16px !important; border-top: 2px solid #f3f4f6; }
                    .cta-container { padding: 0 32px 40px; text-align: center; }
                    .button { display: inline-block; background-color: ${brandColor}; color: #ffffff; padding: 16px 40px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 16px; }
                    .footer { padding: 32px; background-color: #f9fafb; text-align: center; color: #6b7280; font-size: 13px; }
                    .footer-company { font-weight: 600; color: #374151; margin: 0 0 4px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        ${settings?.logo_url ? `<img src="${settings.logo_url}" alt="${settings.name}" class="logo">` : `<h2 class="company-name">${settings?.name || 'Your Company'}</h2>`}
                    </div>
                    
                    <div class="summary-box">
                        <p class="summary-title">Invoice Ready</p>
                        <h1 class="summary-heading">${settings?.name || 'We'} sent you an invoice</h1>
                        
                        <table class="summary-details">
                            <tr>
                                <td>
                                    <div class="detail-label">Invoice Number</div>
                                    <div class="detail-value">#${invoice.number}</div>
                                </td>
                                <td style="text-align: right;">
                                    <div class="detail-label">Due Date</div>
                                    <div class="detail-value">${format(new Date(invoice.due_date), 'MMM d, yyyy')}</div>
                                </td>
                            </tr>
                        </table>
                        
                        <div class="amount-card">
                            <p class="amount-label">Amount Due</p>
                            <h2 class="amount-value">${formatCurrency(invoice.amount_due)}</h2>
                        </div>
                    </div>

                    ${personalMessage ? `<div class="personal-message">"${personalMessage}"</div>` : ''}

                    <div class="items-container">
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${invoice.invoice_line_items?.map((item: any) => `
                                    <tr>
                                        <td>${item.description}</td>
                                        <td style="text-align: right;">${formatCurrency(item.amount)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <table class="totals-table">
                            <tr>
                                <td style="width: 60%;"></td>
                                <td style="color: #6b7280;">Subtotal</td>
                                <td style="text-align: right;">${formatCurrency(invoice.subtotal)}</td>
                            </tr>
                            ${Number(invoice.tax_amount) > 0 ? `
                                <tr>
                                    <td></td>
                                    <td style="color: #6b7280;">Tax</td>
                                    <td style="text-align: right;">${formatCurrency(invoice.tax_amount)}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td></td>
                                <td class="total-final" style="font-weight: 700; font-size: 18px;">Total</td>
                                <td class="total-final" style="text-align: right; font-weight: 700; font-size: 20px; color: ${brandColor};">${formatCurrency(invoice.total)}</td>
                            </tr>
                        </table>
                    </div>

                    <div class="cta-container">
                        <a href="${appUrl}/invoices/${invoice.id}" class="button">View Invoice Details</a>
                    </div>

                    <div class="footer">
                        <p class="footer-company">${settings?.name || 'Company Name'}</p>
                        <p style="margin: 0;">${settings?.address || ''}, ${settings?.city || ''} ${settings?.state || ''} ${settings?.zip || ''}</p>
                        <p style="margin-top: 16px; font-size: 11px; color: #9ca3af;">Thank you for your business!</p>
                    </div>
                </div>
            </body>
            </html>
        `

        const { data, error } = await resend.emails.send({
            from: `${settings?.name || 'Finova'} <onboarding@resend.dev>`,
            to: [to],
            subject: subject,
            html: htmlBody,
            attachments: [
                {
                    filename: `Invoice-${invoice.number}.pdf`,
                    content: pdfBuffer,
                }
            ]
        })

        if (error) {
            console.error('Resend Error:', error)
            throw new Error(error.message)
        }

        return data
    } catch (error: any) {
        console.error('Email sending failed:', error)
        throw error
    }
}
