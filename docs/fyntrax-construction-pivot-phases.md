# Fyntrax -> Construction Accounting: Phased Roadmap

Sequencing per Codex review: stabilize schema and line-level dimensions before building on top of them. Do not start with G703/WIP. Earn footing with job costing + commitments + actuals first.

---

## MVP (Phases 0-3) - target 6-8 weeks

### Phase 0 - Schema Consolidation (prerequisite)

**~1 week**

- Reconcile checked-in migrations vs. what the app actually expects (`companies`, `purchase_orders`, approval tables, `my_company_id()`, RPCs)
- Write missing migrations so the repo is a single source of truth
- Regenerate `database.types.ts`
- No new features. This is a stability pass only.

### Phase 1 - Cost Foundations

**~2 weeks**

- New tables: `projects`, `cost_codes`
- Add `project_id` + `cost_code_id` to: PO lines, bill lines, expense lines, journal entry lines
- Backfill/migration strategy for existing data
- No reporting yet. Just get every cost-bearing line taggable.

### Phase 2 - Job Costing Reports

**~2 weeks**

- Budget vs. committed vs. actual vs. remaining report, per project and per cost code
- PO-to-bill job cost flow: PO commits budget -> converting PO to bill moves committed -> actual
- This is the first user-facing construction value

### Phase 3 - Generalized Approvals + Basic Change Events

**~2-3 weeks**

- Refactor PO approval engine (`apply-workflow.ts`) from PO-specific into a generic, entity-agnostic workflow engine (`entity_type` + `entity_id` instead of `po_id`)
- Basic change events (COR / SCO / BT): create + approve, updates project budget only; no SOV/contingency logic yet

MVP ships here. Contractors can track committed vs. actual cost per project and cost code, with PO-to-bill flow and basic change approvals.

---

## Post-MVP (Phases 4-7) - target 10-16 weeks total, including MVP

### Phase 4 - SOV / G703 Billing + WIP Schedule

**~3-5 weeks**

- Schedule of Values per project, tied to cost codes
- Change events (COR/SCO/BT) update SOV in real time: contract sum, billed to date, contingency used
- AIA-style pay application (G702/G703)
- WIP schedule report, using cost-to-cost % complete by default until method is confirmed

### Phase 5 - Subcontractor SOVs + Retainage

**~2-3 weeks**

- Sub contracts + sub-level SOV lines
- SCOs tied to sub contracts, rolling up into project cost
- Retainage held/released logic, pending confirmed business rules

### Phase 6 - Fixed Assets + Depreciation

**~1-2 weeks**

- Asset register
- Automated recurring depreciation/amortization journal entries, straight-line first; other methods TBD

### Phase 7 - AI Budget Overrun Projections/Alerts

**~1-2 weeks**

- Extend existing Groq agent context with project budget/actual/committed data
- Threshold-based alerts + forward-looking overrun projection

---

## Deferred / Optional

### Tax Handling

Low priority, no estimate. Revisit after core construction workflows are stable.

---

## Key Bottlenecks Called Out

1. **Schema reliability** - migrations do not fully match app expectations yet. Phase 0 exists because of this.
2. **Line-level dimensions** - `project_id`/`cost_code_id` touches bills, expenses, POs, JEs, reports, AI context, imports, and PDFs.
3. **Approval reuse** - PO approval engine is PO-specific; it needs a generic model before change events can use it.
4. **Accounting correctness** - journal creation/reversal/void consistency must be rock solid before WIP/reports are trustworthy.

## Timeline Summary

| Scope | Estimate |
|---|---|
| MVP (Phases 0-3) | 6-8 weeks |
| Full plan (Phases 0-7) | 10-16 weeks, with 1 strong FTE and no major design churn |
| Polished, contractor-trust-ready | 3-5 months |
