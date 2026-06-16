import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendApprovalEmailParams {
  to: string
  approvalToken: string
  poNumber: string
  poTotal: number
  currency: string
  vendorName: string
  submittedByName: string
  companyName: string
  stepLabel: string
  appUrl: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendApprovalEmail(params: SendApprovalEmailParams) {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL environment variable is not set')
  }

  const {
    to,
    approvalToken,
    poNumber,
    poTotal,
    currency,
    vendorName,
    submittedByName,
    companyName,
    stepLabel,
    appUrl,
  } = params

  const baseUrl = appUrl.replace(/\/$/, '')
  const reviewUrl = `${baseUrl}/approve-po?token=${encodeURIComponent(approvalToken)}`
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(poTotal / 100)

  const safePoNumber = escapeHtml(poNumber)
  const safeVendorName = escapeHtml(vendorName)
  const safeSubmittedByName = escapeHtml(submittedByName)
  const safeCompanyName = escapeHtml(companyName)
  const safeStepLabel = escapeHtml(stepLabel)
  const safeReviewUrl = escapeHtml(reviewUrl)

  await resend.emails.send({
    from: `${safeCompanyName || 'Fyntrax'} <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    subject: `Action Required: Review Purchase Order ${poNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 32px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;">
            <div style="background: #7c3aed; padding: 24px 32px;">
              <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Purchase Order Approval Required</h1>
            </div>

            <div style="padding: 32px;">
              <p style="color: #374151; margin: 0 0 24px;">Hi,</p>
              <p style="color: #374151; margin: 0 0 24px;">
                <strong>${safeSubmittedByName}</strong> at <strong>${safeCompanyName}</strong> has requested your approval
                for the following purchase order as <strong>${safeStepLabel}</strong>.
              </p>

              <div style="background: #f3f4f6; border-radius: 6px; padding: 20px; margin-bottom: 28px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">PO Number</td>
                    <td style="color: #111827; font-size: 13px; font-weight: 600; text-align: right;">${safePoNumber}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Vendor</td>
                    <td style="color: #111827; font-size: 13px; text-align: right;">${safeVendorName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; font-size: 13px; padding: 8px 0 0;">Total Amount</td>
                    <td style="color: #111827; font-size: 18px; font-weight: 700; text-align: right;">${formattedTotal}</td>
                  </tr>
                </table>
              </div>

              <a href="${safeReviewUrl}" style="display: block; background: #7c3aed; color: white; text-align: center; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
                Review &amp; Decide
              </a>

              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                This link expires in 7 days. You can approve or reject with an optional comment on the review page.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  })
}
