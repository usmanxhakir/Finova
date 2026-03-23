### 🎯 Project Overview

Build a **full-stack, multi-user accounting and invoicing web application** for a single company. The app must support  **accrual-based accounting** , meaning income and expenses are recorded when they are  *earned or incurred* , and their  *payments are recorded separately* . The app should feel like a polished SaaS product — think a lightweight version of QuickBooks or FreshBooks with beautiful UI.

---

### 🛠️ Tech Stack

Use the following stack:

* **Frontend:** Next.js 14 (App Router) with TypeScript
* **Styling:** Tailwind CSS + shadcn/ui component library
* **Backend:** Next.js API Routes (serverless)
* **Database:** Supabase (PostgreSQL) with Row Level Security
* **Auth:** Supabase Auth (email/password)
* **PDF Generation:** `@react-pdf/renderer` for invoice PDFs
* **Email Sending:** Resend (resend.com) for sending invoices via email
* **Charts/Reports:** Recharts for visual reports
* **State Management:** Zustand for global state
* **Forms:** React Hook Form + Zod for validation

---

### 🗂️ Database Schema

Create the following tables in Supabase. Every table should have `id` (UUID, primary key), `created_at`, and `updated_at` timestamps.

#### `users`

Managed by Supabase Auth. Add a `profiles` table linked to `auth.users` with: `full_name`, `role` (enum: `admin`, `accountant`, `viewer`), `avatar_url`.

#### `company_settings`

One row per app instance: `name`, `logo_url`, `address`, `city`, `state`, `zip`, `country`, `phone`, `email`, `website`, `tax_number`, `default_currency` (default `USD`), `fiscal_year_start` (month number, default `1` for January), `invoice_prefix` (default `INV-`), `bill_prefix` (default `BILL-`), `invoice_terms` (text, default payment terms shown on invoices), `invoice_footer` (text).

#### `accounts`

The Chart of Accounts. Fields: `code` (varchar, user-defined like "1000"), `name`, `type` (enum: `asset`, `liability`, `equity`, `revenue`, `expense`), `sub_type` (enum: `accounts_receivable`, `accounts_payable`, `bank`, `cash`, `other_current_asset`, `fixed_asset`, `other_asset`, `credit_card`, `other_current_liability`, `long_term_liability`, `income`, `other_income`, `cost_of_goods_sold`, `expense`, `other_expense`), `description`, `is_active` (boolean), `parent_account_id` (self-referencing FK, for sub-accounts), `is_system` (boolean — system accounts like A/R and A/P cannot be deleted).

Seed the following system accounts on first setup:

* `1100` - Accounts Receivable (asset > accounts_receivable) [system]
* `2100` - Accounts Payable (liability > accounts_payable) [system]
* `1000` - Checking Account (asset > bank)
* `4000` - Sales Revenue (revenue > income)
* `5000` - Cost of Goods Sold (expense > cost_of_goods_sold)
* `6000` - General & Administrative (expense > expense)
* `3000` - Owner's Equity (equity)

#### `contacts`

Represents both customers and vendors. Fields: `name`, `type` (enum: `customer`, `vendor`, `both`), `email`, `phone`, `website`, `billing_address`, `billing_city`, `billing_state`, `billing_zip`, `billing_country`, `tax_number`, `notes`, `is_active`.

#### `items`

Products and services. Fields: `name`, `description`, `type` (enum: `product`, `service`), `unit` (e.g., "hrs", "pcs", "kg"), `default_rate` (decimal), `income_account_id` (FK to accounts — used when item is sold), `expense_account_id` (FK to accounts — used when item is purchased), `is_active`.

#### `invoices`

Fields: `number` (auto-generated, e.g., INV-0001), `contact_id` (FK, must be customer or both), `status` (enum: `draft`, `sent`, `partially_paid`, `paid`, `overdue`, `void`), `issue_date`, `due_date`, `currency`, `subtotal`, `tax_amount`, `discount_amount`, `total`, `amount_paid`, `amount_due`, `notes`, `terms`, `footer`, `sent_at` (timestamp when emailed).

#### `invoice_line_items`

Fields: `invoice_id` (FK), `item_id` (FK, nullable — user can add a custom line without an item), `description`, `quantity` (decimal), `rate` (decimal), `amount` (decimal, = qty × rate), `account_id` (FK to accounts — the revenue account for this line, auto-populated from item but overridable), `tax_rate` (decimal, nullable).

#### `bills`

Mirror of invoices but for vendor purchases. Fields: `number` (auto-generated, e.g., BILL-0001), `contact_id` (FK, must be vendor or both), `status` (enum: `draft`, `received`, `partially_paid`, `paid`, `overdue`, `void`), `issue_date`, `due_date`, `currency`, `subtotal`, `tax_amount`, `discount_amount`, `total`, `amount_paid`, `amount_due`, `notes`, `reference_number` (vendor's invoice number).

#### `bill_line_items`

Mirror of invoice_line_items. Fields: `bill_id` (FK), `item_id` (FK, nullable), `description`, `quantity`, `rate`, `amount`, `account_id` (FK — the expense account for this line), `tax_rate` (nullable).

#### `payments`

Records actual cash movements. Fields: `type` (enum: `invoice_payment`, `bill_payment`), `contact_id` (FK), `account_id` (FK — the bank/cash account the money came from or went to), `date`, `amount`, `reference` (check number, transaction ID, etc.), `notes`.

#### `payment_allocations`

Links a payment to specific invoices or bills. Fields: `payment_id` (FK), `invoice_id` (FK, nullable), `bill_id` (FK, nullable), `amount_applied`.

#### `journal_entries`

For manual accrual entries and the system-generated double-entry records. Fields: `date`, `reference`, `description`, `is_system_generated` (boolean), `source_type` (enum: `invoice`, `bill`, `payment`, `manual`), `source_id` (UUID of the source record, nullable).

#### `journal_entry_lines`

Fields: `journal_entry_id` (FK), `account_id` (FK), `description`, `debit` (decimal, default 0), `credit` (decimal, default 0). Each journal entry must balance (sum of debits = sum of credits).

---

### ⚙️ Accounting Engine (Critical — Build This Carefully)

This is the heart of the app. Use  **double-entry accrual accounting** . Every financial event must create a balanced journal entry automatically.

**When an Invoice is created/finalized (not draft):**

* Debit `Accounts Receivable` for the invoice total
* Credit each revenue account on the line items for their respective amounts
* Credit a `Tax Payable` liability account for any tax amount

**When a Payment is received against an Invoice:**

* Debit the selected bank/cash account for the amount received
* Credit `Accounts Receivable` for the same amount

**When a Bill is created/finalized:**

* Debit each expense account on the line items
* Debit a `Tax Receivable` (or expense) account for tax if applicable
* Credit `Accounts Payable` for the bill total

**When a Bill is paid:**

* Debit `Accounts Payable` for the amount paid
* Credit the selected bank/cash account

**When an Expense is recorded directly (not as a bill):**

* Debit the selected expense account
* Credit the selected bank/cash account (or credit card account)
* This creates a single journal entry with no A/P step.

All journal entries generated this way must be marked `is_system_generated = true` and linked via `source_type` and `source_id`. They should not be editable by users. Users can only create and edit manual journal entries.

---

### 🖥️ Application Pages & Features

#### 1. Auth Pages

* `/login` — Email/password login with company logo
* `/register` — First-time setup: create admin account + company profile
* Forgot password flow via Supabase

#### 2. Dashboard `/`

Show a clean KPI summary:

* Total outstanding receivables (unpaid invoice totals)
* Total outstanding payables (unpaid bill totals)
* Revenue this month vs last month (bar chart)
* Expenses this month vs last month
* Recent invoices (last 5) with status badges
* Recent bills (last 5) with status badges
* Quick action buttons: New Invoice, New Bill, Record Expense

#### 3. Invoices `/invoices`

**Invoice List Page:**

* Table with columns: Invoice #, Customer, Issue Date, Due Date, Total, Amount Due, Status
* Color-coded status badges: Draft (gray), Sent (blue), Partially Paid (yellow), Paid (green), Overdue (red), Void (strikethrough)
* Filters: by status, date range, customer
* Bulk actions: mark as sent, void
* "New Invoice" button

**Invoice Detail/Edit Page `/invoices/[id]`:**

* Full invoice form with:
  * Customer selector (searchable dropdown from contacts)
  * Invoice number (auto-generated but editable)
  * Issue date and due date pickers
  * Line items table with: Description, Item (optional), Qty, Rate, Account, Tax%, Amount columns
    * Each row allows picking an item from the items list which auto-fills description, rate, and account
    * Or user can manually type a custom line item with account selector
    * Add/remove rows dynamically
  * Subtotal, Discount (% or fixed), Tax, Total calculation shown live
  * Notes, Terms, Footer text areas
  * Save as Draft / Finalize buttons
  * Once finalized, invoice is locked for editing (void + recreate workflow)

**Invoice Actions (shown on detail page):**

* **Send via Email:** Opens modal with pre-filled recipient (customer email), subject ("Invoice #INV-001 from [Company]"), message body, and attaches PDF. Sends via Resend API.
* **Download PDF:** Generates a beautiful PDF using @react-pdf/renderer with: company logo top-left, company details top-right, customer billing info, invoice number/dates in a styled header box, line items table, totals section, notes/terms/footer, "PAID" watermark if fully paid.
* **Record Payment:** Modal asking for: payment date, amount (pre-filled with amount due), payment account (bank/cash), reference number, notes. Creates a Payment + PaymentAllocation + journal entry.
* **View Payments:** Shows all payments applied to this invoice with dates and amounts.
* **Void Invoice:** Requires confirmation. Reverses all journal entries.

#### 4. Bills `/bills`

Mirror of invoices but for vendor bills. Same list, detail, and action pages. Key differences:

* Contact must be a vendor
* "Received" status instead of "Sent"
* Reference number field for vendor's invoice number
* "Record Payment" creates a bill payment journal entry

#### 5. Expenses `/expenses`

For recording expenses directly (not via a bill).

* List of direct expenses with: Date, Payee, Account, Amount, Notes
* "New Expense" button opens a simple form:
  * Date
  * Payee (free text or from contacts)
  * Payment Account (bank/cash/credit card — from Chart of Accounts)
  * Expense Account (from Chart of Accounts, filtered to expense types)
  * Amount
  * Description/Notes
  * Optional: receipt image upload (stored in Supabase Storage)
* These create immediate journal entries (no A/P step)

#### 6. Contacts `/contacts`

* List of all customers and vendors with search and type filter
* Create/Edit contact form with all fields
* Contact detail page showing: all invoices for this contact, all bills for this contact, total owed to/by them, payment history

#### 7. Items `/items`

* List of products/services
* Create/Edit form linking item to income account (for sales) and expense account (for purchases)
* Used as a shortcut when building invoice/bill line items

#### 8. Chart of Accounts `/accounts`

* Hierarchical table showing all accounts grouped by type (Assets, Liabilities, Equity, Revenue, Expenses)
* Each account shows: Code, Name, Type, Sub-type, Balance (calculated from journal entries)
* Add/Edit/Deactivate accounts
* System accounts (A/R, A/P) show a lock icon and cannot be deleted
* Parent/child account relationships shown with indentation
* "Add Sub-account" button on each row

#### 9. Reports `/reports`

Build the following reports, all with date range pickers and a clean print/export layout:

**Profit & Loss Statement `/reports/pl`**

* Show Revenue accounts grouped under "Income" section with their balances
* Show Expense accounts grouped under "Expenses" section
* Calculate Gross Profit (Revenue - COGS), Operating Expenses subtotal, Net Income
* Allow comparison: This Period vs Prior Period side by side
* Display as clean financial statement with proper indentation for sub-accounts

**Balance Sheet `/reports/balance-sheet`**

* Assets section: Current Assets (Cash, A/R, etc.), Fixed Assets, Other Assets
* Liabilities section: Current Liabilities (A/P, credit cards), Long-term Liabilities
* Equity section
* Show that Assets = Liabilities + Equity
* As of a specific date (not a range)

**A/R Aging Report `/reports/ar-aging`**

* Shows all customers with outstanding invoices
* Columns: Customer, Current (not yet due), 1-30 days overdue, 31-60 days, 61-90 days, 90+ days, Total
* Each customer row expandable to show individual invoices
* Summary row at bottom with totals
* Color-code the aging buckets (green → yellow → orange → red)

**A/P Aging Report `/reports/ap-aging`**

* Mirror of A/R aging but for vendor bills

**General Ledger `/reports/general-ledger`**

* Filter by account and date range
* Shows all journal entry lines for selected account with running balance
* Columns: Date, Description, Reference, Debit, Credit, Balance

**Trial Balance `/reports/trial-balance`**

* All accounts with their debit/credit balance totals
* Must show that total debits = total credits

---

### 🎨 UI/UX Design Requirements

* Use a **sidebar layout** with collapsible navigation
* Sidebar sections: Dashboard, Sales (Invoices, Customers), Purchases (Bills, Expenses, Vendors), Accounting (Chart of Accounts, Journal Entries), Reports, Settings
* Use shadcn/ui components throughout: DataTable, Dialog, Sheet (slide-over panel), Select, DatePicker, Tabs, Badge, Card
* Color scheme: Clean white background, indigo/violet as the primary brand color, subtle gray borders
* All tables must support: sorting, pagination (25 per page default), and column-level search/filter
* All forms must have proper validation with inline error messages
* All money amounts must be formatted consistently using `Intl.NumberFormat` in the user's currency
* All dates must be formatted consistently
* Use skeleton loaders while data is fetching — never show blank pages
* Toast notifications for all actions (success/error) using shadcn/ui `toast`
* Confirmation dialogs for all destructive actions (void, delete)
* Responsive layout that works on tablet (not required to be mobile-first, but shouldn't break)

---

### 🔐 Access Control

* `admin` role: Full access to everything including settings, user management, and deleting records
* `accountant` role: Full access except cannot manage users or change company settings
* `viewer` role: Read-only access to all pages, no create/edit/delete

Enforce this at the API route level using Supabase RLS policies and middleware checks.

---

### ⚙️ Settings Pages `/settings`

* **Company:** Edit all company_settings fields, upload logo (Supabase Storage)
* **Users:** Invite users via email, set their role, deactivate users
* **Accounts:** Quick link to Chart of Accounts
* **Invoice Customization:** Set default invoice terms, footer text, invoice/bill number prefixes and starting numbers

---

### 📦 Project Structure

```
/app
  /auth (login, register)
  /dashboard
  /invoices
  /bills
  /expenses
  /contacts
  /items
  /accounts
  /reports
    /pl
    /balance-sheet
    /ar-aging
    /ap-aging
    /general-ledger
    /trial-balance
  /settings
/components
  /ui (shadcn components)
  /invoices (InvoiceForm, InvoiceTable, InvoicePDF, PaymentModal)
  /bills
  /reports
  /layout (Sidebar, Header, PageHeader)
/lib
  /supabase (client, server, middleware)
  /accounting (journal-engine.ts — all auto journal entry logic)
  /pdf (invoice-pdf.tsx)
  /email (send-invoice.ts)
  /utils (formatCurrency, formatDate, calcAging)
/hooks
  /useInvoices, useBills, useAccounts, useContacts, etc.
/types
  database.types.ts (auto-generated from Supabase)
```

---

### 🚀 Implementation Order

Build in this exact order to avoid dependency issues:

1. Auth + Company Setup (onboarding flow)
2. Chart of Accounts (seed default accounts)
3. Contacts + Items
4. Invoices (create, list, PDF download)
5. Accounting Engine (journal entries for invoices)
6. Invoice Payments
7. Bills + Bill Payments
8. Direct Expenses
9. Reports (P&L first, then others)
10. Email sending
11. User management + roles
12. Polish: dashboard KPIs, charts, empty states

---

### 🧪 Important Rules for the AI to Follow

* **Never allow a journal entry to be unbalanced** — always validate that debits = credits before saving
* **Never allow deletion of a finalized invoice or bill** — use void + reversal instead
* **Accounts Receivable and Accounts Payable accounts must never be selectable in manual dropdowns** — they are only touched by the accounting engine automatically
* **All monetary arithmetic must use integer math** (store cents as integers in the DB, e.g. $10.50 = 1050) to avoid floating point errors
* **Partial payments must update invoice/bill status correctly** — if amount_paid > 0 but < total, status is `partially_paid`
* **The A/R Aging report must use the invoice due_date, not issue_date** , to calculate aging buckets
* **PDF generation must happen server-side** or be triggered client-side with the full invoice data already loaded
* **All Supabase queries must go through typed RPC functions or the typed client** — no raw SQL strings in components
