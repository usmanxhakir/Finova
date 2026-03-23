'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { handleSendInvoice } from '@/app/(dashboard)/invoices/[id]/actions'

interface SendInvoiceModalProps {
    invoice: any
    settings: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function SendInvoiceModal({
    invoice,
    settings,
    open,
    onOpenChange,
    onSuccess
}: SendInvoiceModalProps) {
    const [sending, setSending] = useState(false)
    const [email, setEmail] = useState(invoice?.contacts?.email || '')
    const [subject, setSubject] = useState(`Invoice ${invoice?.number} from ${settings?.name || 'us'}`)
    const [personalMessage, setPersonalMessage] = useState('')

    const onSend = async () => {
        if (!email) {
            toast.error('Recipient email is required')
            return
        }

        setSending(true)
        try {
            await handleSendInvoice(invoice.id, email, subject, personalMessage)
            toast.success('Invoice sent successfully')
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            toast.error(error.message || 'Failed to send invoice')
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Send Invoice</DialogTitle>
                    <DialogDescription>
                        Email this invoice to your customer. You can customize the recipient and message.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">To</Label>
                        <Input
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="customer@example.com"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message">Message (Optional)</Label>
                        <Textarea
                            id="message"
                            value={personalMessage}
                            onChange={(e) => setPersonalMessage(e.target.value)}
                            placeholder="Add a personal note..."
                            className="min-h-[100px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                        Cancel
                    </Button>
                    <Button onClick={onSend} disabled={sending} className="bg-indigo-600 hover:bg-indigo-700">
                        {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invoice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
