# Finova / Fyntrax App State and GC Pivot Notes

Date: 2026-06-24

Assumption: "GC" means General Contractor.

## Executive Summary

The app is not a blank prototype. It has a real Next.js/Supabase accounting product shape: auth, company onboarding, chart of accounts, contacts, items, invoices, bills, expenses, payments, journal entries, reports, banking/reconciliation UI, purchase orders, approvals, email/PDF flows, and an AI-agent surface.

The strongest product signal is actually not generic accounting. The strongest differentiated surface is procurement/purchase orders plus approvals, which fits a GC/construction workflow better than another broad QuickBooks-style accounting app. I would seriously consider pivoting toward a GC-first accounting/procurement tool, but I would not pitch it as "full accounting" yet. The current ledger and schema need stabilization first.

Recommended positioning for the next phase:

> GC-first job-costing, purchase-order, bill, and payment-control tool, with lightweight accrual accounting underneath.

## What Is Working or Mostly Implemented

### Product Surface

Implemented app areas visible in the repo:

- Auth/login/register flow.
- Multi-company direction through `companies`, `profiles.company_id`, plans, and roles.
- Sidebar SaaS layout with modules for dashboard, invoices, bills, purchase orders, expenses, contacts, items, accounts, journal entries, banking, reports, settings, and AI Agent.
- Chart of Accounts CRUD and account selection flows.
- Contacts and items CRUD/import-style surfaces.
- Invoice list/detail/new flows.
- Bill list/detail/new flows.
- Direct expense flow with receipt upload.
- Receive payment and pay bills flows.
- Journal entry pages.
- Reports hub plus Profit and Loss, Balance Sheet, A/R Aging, A/P Aging, and Transaction List pages.
- Banking/reconciliation UI and APIs.
- Purchase orders, PO detail, PO creation, PO approval workflow, external approval links, comments, voiding, and PO-to-bill conversion.
- Invoice/bill PDF components and invoice email sending via Resend.
- AI agent route with parse/execute APIs and accounting actions.

### Accounting Engine

There is a real journal engine in `src/lib/accounting/journal-engine.ts`:

- Finalized invoices debit A/R and credit revenue.
- Invoice payments debit bank/cash and credit A/R.
- Finalized bills debit expense accounts and credit A/P.
- Bill payments debit A/P and credit bank/cash.
- Direct expenses debit expense and credit payment account.
- Invoice and bill void flows attempt reversal entries.

Amounts are mostly stored as integer cents, which is the right direction.

### Verification Results

- `npx.cmd tsc --noEmit` passed.
- `npm.cmd run lint` did not finish before the 120 second timeout, with no actionable lint output returned.
- `npm.cmd run build` inside the restricted sandbox failed because Next.js could not fetch Google fonts for `next/font`.
- A network-enabled build was attempted and timed out without useful output, so production build status is still inconclusive.

## What Is Not Working or Risky

### 1. Database Migrations Are Not Reproducible

This is the biggest technical risk.

The code expects tables and fields that are not created by the visible migrations:

- `companies`
- `profiles.company_id`
- `purchase_orders`
- `po_line_items`
- `po_approval_workflows`
- `po_approval_records`
- `reconciliations`
- `journal_entry_lines.is_cleared`
- RPCs such as `generate_invoice_number`, `generate_bill_number`, and `generate_po_number`
- `my_company_id()`

The base migration creates `company_settings`, not `companies`, but most current app code reads/writes `companies`.

Examples:

- `supabase/migrations/003_autonumber_and_references.sql` alters `companies`, but no visible migration creates `companies`.
- `supabase/migrations/004_invitations.sql` references `companies(id)` and `my_company_id()`, but neither is created in visible migrations.
- `supabase/migrations/006_void_po.sql` alters `purchase_orders`, but no visible migration creates `purchase_orders`.
- The generated type file defines only partial `profiles` and `companies`, then falls back to `any` for everything else.

Likely meaning: the remote database has manual or missing migrations that the repo does not capture. A fresh setup from this repo would likely fail.

### 2. Accounting Ledger Is Not Yet Trustworthy

The accounting foundation is promising, but several paths can create inconsistent books:

- Sending a draft invoice calls `createInvoiceJournalEntry` before changing the invoice status from `draft` to `sent`; the journal engine rejects draft invoices, so this flow can fail.
- Expense edits call `createExpenseJournalEntry` again, which can duplicate journal entries for the same expense.
- Voiding expenses only marks the expense `void`; there is no reversal journal entry.
- Voiding invoices/bills creates reversals but then sets `amount_due` back to the document total even though the status is `void`.
- Some creation flows swallow journal-entry failures and keep the source document anyway. That means invoices/bills/expenses can exist without their accounting impact.
- Discounts and tax handling are fragile. The engine credits line amounts and optionally tax, but discount behavior is not clearly represented as a balanced accounting entry.
- There is no database-level balanced-entry constraint visible in migrations. Balance validation happens in app code only.

### 3. Purchase Orders Are Feature-Rich but Schema-Missing

The PO product surface is one of the strongest parts of the app:

- PO list and detail pages.
- New PO form.
- Approval workflow settings.
- Submit/approve/reject routes.
- External approval token route.
- Approval email helper.
- PO comments.
- Void PO.
- Convert PO to bill.

But the repo does not include the required schema. If the remote DB already has it, this may work there. From a product decision standpoint, this is still a strong signal: PO/procurement workflows are where the app starts looking differentiated.

### 4. Access Control Is Inconsistent

There is a useful plan/role model:

- Roles: `admin`, `accountant`, `viewer`, `procurement`.
- Plans: `free`, `pro`, `studio`, `po_only`.
- `procurement` and `po_only` restrict modules to PO-oriented workflows.

But the migrations and policies are behind the app model:

- Base role enum does not include `procurement`.
- Older RLS policies are broad authenticated read policies, not strict company-scoped policies.
- App code often relies on `.eq('company_id', companyId)`, but clean schema support is missing.
- Some routes enforce auth/company checks; some client queries rely heavily on RLS.

### 5. Banking/Reconciliation Looks Partial

The UI and APIs reference:

- `reconciliations`
- `journal_entry_lines.is_cleared`

Those are not present in visible migrations. The banking feature should be treated as partial unless the remote DB has additional schema.

### 6. Reports Exist but Depend on Ledger Quality

Reports are implemented and useful as a UI direction, especially P&L and transaction drilldowns. But they are only as reliable as the journal entries. Until journal creation, reversal, and schema consistency are fixed, reports should be considered demo-quality rather than accounting-grade.

## Best Product Direction

### Generic Accounting Path

Pros:

- Broad market.
- Current app already covers the standard modules: invoices, bills, expenses, reports, accounts.
- Easier to explain as a lightweight QuickBooks/FreshBooks alternative.

Cons:

- Extremely crowded.
- Current app will be judged against mature accounting expectations: bank feeds, reconciliation, audit trails, tax, closing periods, permissions, accountant workflows, exports, compliance, and data integrity.
- The ledger is not ready for high-trust accounting use.

Verdict: possible, but expensive and not differentiated enough yet.

### GC-First Accounting/Procurement Path

Pros:

- Existing PO/approval/convert-to-bill work naturally fits general contractors.
- Procurement controls are painful for GCs: approvals, vendors, commitments, change orders, bill matching, job-level budgets.
- You can narrow the accounting scope while becoming more valuable to a specific buyer.
- The `po_only` and `procurement` concepts already point in this direction.

Cons:

- You need to add job/project costing and construction-specific concepts.
- Accounting must still be reliable enough for bills, payments, commitments, and reporting.
- Requires clearer domain language: jobs, cost codes, subs, materials, retention, change orders, draws, lien waivers.

Verdict: stronger path. The app already leans this way.

## Recommended Pivot Shape

Do not pivot to "GC accounting" as a full QuickBooks replacement immediately. Pivot to:

> GC-first cost control: purchase orders, approvals, vendor bills, payments, and job cost visibility.

Then let accounting grow underneath it.

The first wedge should be:

- Vendors/subcontractors.
- Jobs/projects.
- Cost codes/cost categories.
- Purchase orders and subcontract commitments.
- Approval workflows.
- PO-to-bill matching.
- Budget vs committed vs actual cost.
- A/P aging and bill payment control.
- Exports/sync later, instead of replacing accounting systems on day one.

## Missing GC-Specific Capabilities

To become clearly GC-first, add:

- `jobs` / `projects`
- `cost_codes`
- `cost_types` such as labor, material, subcontract, equipment, overhead
- Job budget lines
- PO/subcontract commitments by job and cost code
- Change orders
- Retainage
- Progress billing or draw requests
- Vendor/subcontractor compliance fields
- Lien waiver tracking
- Insurance/COI expiration tracking
- Job-level P&L or WIP-style reporting

## Immediate Stabilization Plan

Priority 1: Make the database reproducible.

- Pull or recreate the real remote schema into migrations.
- Add missing migrations for `companies`, company-scoped tables, purchase orders, approvals, reconciliations, number RPCs, and role/plan enums.
- Remove or migrate away from `company_settings` vs `companies` ambiguity.
- Regenerate complete Supabase types.

Priority 2: Make the ledger safe.

- Fix draft invoice send ordering.
- Prevent duplicate system journal entries per source.
- Add expense reversal on void.
- Fix voided invoice/bill `amount_due`.
- Stop swallowing journal-entry failures in finalized document flows.
- Add database-level checks or RPCs for balanced journal entries.

Priority 3: Commit to the GC wedge.

- Add jobs and cost codes.
- Attach every PO, bill, expense, and eventually invoice line to job/cost code.
- Build a Job Cost report: budget, committed, actual, remaining.
- Make PO approvals and PO-to-bill the hero workflow.

Priority 4: Tighten product packaging.

- Rename/clarify brand: repo says Finova, UI says Fyntrax.
- Decide plans: `po_only` can become the GC/procurement starter plan.
- Simplify navigation for GC users: Dashboard, Jobs, POs, Bills, Vendors, Reports, Settings.

## Decision Recommendation

Yes, pivot toward a GC-first tool, but make it a focused construction cost-control product first, not a full accounting replacement.

The current codebase already has enough accounting infrastructure to support that wedge, and the PO/approval work is the most differentiated part of the app. The fastest credible path is to stabilize the schema and ledger, then add jobs/cost codes and make PO-to-bill-to-job-cost reporting excellent.

If you stay generic accounting, you will spend most of your time catching up to baseline accounting expectations. If you go GC-first, the same work becomes more valuable because it solves a sharper workflow.
