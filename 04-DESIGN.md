# DESIGN — UI/UX System for the HVAC ERP (v2)

This supersedes the earlier lightweight-dashboard design direction. The system now targets **enterprise data-tool scale** — the density, navigation patterns, and data-entry patterns of a tool like HubSpot — while keeping things calm and uncluttered. This is the right call for an ERP: dispatchers, accountants, and admins live in tables and forms all day; they need density and speed, not decorative whitespace. The card-based dashboard language from the earlier pass is kept only for the home dashboard's summary widgets — everything else (jobs, accounts, HRM, purchasing, feedback) follows the patterns below.

---

## 1. Global shell

### Sidebar + top bar are one continuous surface
- **The sidebar and top bar share the exact same dark background color** — they read as one continuous dark frame wrapping the top and left of the app, not two separately-colored regions with a visible seam. This is a specific correction from earlier passes: don't let the top bar be white/light while the sidebar is dark — match them exactly, with only a hairline (if anything at all) separating sidebar from top bar.
- **The whole app sits inside a rounded outer container**: the dark frame (sidebar + top bar combined) has a soft rounded outer corner where it meets the page edge, and the white content area is inset within it with its own rounded corner (matches the reference's floating, rounded-rectangle-within-a-frame look, not a hard-edged full-bleed layout). This rounded-frame treatment is what makes the dark/light contrast feel considered rather than like two unstyled panels stuck together.

### Sidebar
- Dark charcoal/near-black background (matching the top bar exactly, per above), white/light-grey icon+label nav items, generous vertical spacing, rounded active-item indicator (subtle rounded highlight behind the active icon+label, not just a color change).
- Order top to bottom: logo, primary nav (Dashboard, Jobs, Dispatch Map, Technicians, Accounts, HRM, Purchasing/Inventory, Projects, Feedback, Reports), a **"More"** overflow group at the bottom for secondary/rare screens (Settings, Audit Log, Admin Tools), collapse/expand toggle pinned at the very bottom.
- Sidebar must be **collapsible to icon-only** for users who want more table width — remember the collapsed state per user.

### Top bar
- Same dark background as the sidebar (see above) — light text/icons on it, not the white-bar-with-dark-icons look from the earlier draft.
- **Universal search field** ("Find or Ask") — light/white pill-shaped input sitting on the dark bar, searches across jobs, customers, technicians, invoices by job number, phone, name, etc. This is the fastest path into the system for a dispatcher taking a call; treat it as a first-class feature, not a decoration.
- Right-aligned utility icons: quick-call/dialer icon (ties into click-to-call), notifications bell with unread badge, help, settings, and the logged-in user's name + org name with a dropdown (switch role view if the person has multiple roles, log out) — all rendered as light icons/text on the dark bar.
- A **global "+" quick-create button** next to search — opens a small menu (New Job, New Customer, New Invoice, New PR) so any user can start the most common actions from anywhere, not just from inside the relevant module.

### Page header (inside content area)
- Breadcrumb-style page title with a dropdown caret when the page has variants (e.g. "Jobs ▾" → switch between "All Jobs / My Jobs / Needs Review"), matching the reference pattern exactly.
- Primary action button top-right (solid dark or accent-colored, e.g. "+ New Job"), secondary actions (Export, Import, Actions ▾ menu, Share) as outline buttons beside it.

---

## 2. List/table views (the default screen for Jobs, Customers, Technicians, Invoices, PRs/POs, Feedback Queue)

This is the pattern used most heavily across the whole ERP — get it right once, reuse everywhere.

- **Saved-view tabs** directly under the page header: e.g. Jobs → `All Jobs | My Jobs | Needs Review | Completed Today | +` (the `+` lets a user save their own filtered view). Contacts/Companies-style tabs, not a dropdown — they should be one click away.
- **Page-header utility icons** (top-right, beside the primary action button): a kebab/vertical-dots menu (row-level bulk/less-common actions), a hierarchy/sitemap icon (view record relationships, e.g. a job's linked invoice/customer/technician), matching the reference's icon cluster — these are secondary to the primary action button, rendered as plain icon buttons in a light outline, not filled.
- **Filter bar** below the tabs: a `Filter` button (opens filter builder), a `Sort by` button, plus quick filter chips for the most common cuts (status, technician, date range, care-of vs. direct — shown as individual dropdown chips like "Deal owner ▾", "Create date ▾", not one combined filter). A small `+` icon to add another filter chip, a pencil icon to edit the current chip set, and an **"Advanced filters"** link with a small colored dot badge when unsaved/active filters exist beyond the visible chips — kept out of the way by default, one click to reach.
- **View selector**: a dropdown to switch between saved table configurations/pipelines (e.g. "Deals pipeline ▾" in the reference → for Jobs this becomes something like a saved view or pipeline stage grouping), plus small grid/list view-toggle icon buttons and the column-configuration gear, grouped together at the top-right of the table itself (distinct from the page-header icons above it).
- **Dense data table**:
  - Sticky header row, light-grey background, small-caps or medium-weight column labels.
  - Row height compact enough to see 15–20 rows without scrolling on a laptop screen — this is a working tool, not a marketing dashboard.
  - Each row has a small **expand chevron** immediately before the primary identifier — click (or Enter, when focused) reveals inline sub-details without leaving the table, in addition to the identifier link opening the full record.
  - First column after the checkbox+chevron is always the primary identifier as a clickable link (job number, contact name, company name) in the accent color, underlined — this is the click-through into detail.
  - Status/lifecycle values render as **colored pill badges** (e.g. a solid green "Closed Won"/"Verified" pill, a solid purple "Customer" pill) — reserve solid-fill pills for the single most important status column per table; secondary metadata stays as plain text so the eye isn't fighted for attention.
  - Where a status cell has a next-step action (e.g. the reference's "Schedule ▾" under Next Activity), render it as an **inline actionable dropdown right in the cell** — bold text with a small caret — so common next actions (e.g. "Assign Technician ▾", "Request Payment ▾") don't require opening the full record.
  - Party/owner columns show a small circular **avatar with initials** next to the name (e.g. technician or customer initials) — consistent avatar treatment used identically in tables, drawers, and detail pages.
  - Column configuration gear icon at the top-right of the table — users can show/hide/reorder columns per view.
  - Row-level checkbox selection enabling bulk actions (bulk assign technician, bulk export, bulk status change) via a bar that appears once rows are selected.
  - Horizontal scroll for wide tables (with a visible scrollbar, as in the reference) rather than forcing column truncation — data tools should show real data, not hide it.
  - Footer bar: total count ("1 contact" / "24 jobs"), plus Export/Clone/Refresh icon actions bottom-right.
  - **Empty state**: centered, calm message ("There is no data to show in this time frame. Try changing the date range.") — never a blank white void.

---

## 3. Data entry: side drawers vs. full pages

Use both, chosen deliberately — this is the single biggest structural decision in the system, so the rule needs to be explicit and consistent:

- **Side drawer (slide-over panel from the right)** for:
  - Quick creation of a single, simple record: Add Customer (name/phone/address/email), Add Technician, quick expense log, quick discount entry, quick feedback-call outcome.
  - Editing a handful of fields on an existing record without leaving the list context (e.g. changing a job's assigned technician from the Jobs table).
  - Rule of thumb: **if the form fits without scrolling and doesn't branch into sub-sections, it's a drawer.**
- **Full page** for:
  - Anything with multiple sections or a workflow: New Job (customer, job items, care-of, assignment — genuinely multi-part), Payroll run screens, PR→PO conversion, Project/BOQ setup.
  - Any detail view with a stepper/timeline, financial summary, and multiple related sub-tables (Job Detail, Technician Ledger Detail, Payroll Run Detail).
  - Rule of thumb: **if the user needs to reference other data while filling the form, or the form has more than ~2 logical sections, it's a full page.**
- Drawers always open from the right, dim the background content (don't fully hide it — the user should still sense where they are in the table), and have a persistent Save/Cancel footer that stays visible while scrolling the drawer's contents.
- Full-page create/edit flows use a **left-side vertical section nav within the page** for long forms (e.g. New Job: "Customer" → "Job Items" → "Care Of" → "Assignment" as anchored sections), so users can jump around instead of scrolling blindly.

---

## 4. Dashboards (Home, module-level overviews)

- Keep the earlier stat-card language here specifically — dashboards are the one place a slightly lighter, more visual treatment is right, because they're for scanning, not data entry.
- Standard dashboard anatomy: quick-filter bar at top (owners/date range/advanced filters — matches the reference), then a responsive grid of widget cards:
  - **Number widgets**: big bold count, comparison delta ("▼ 100% compared to last month"), one-line context.
  - **Trend widgets**: small area/line chart with an explicit empty state when there's no data yet — don't render a fake flat line.
  - **Distribution widgets**: bar chart (e.g. Deals by Stage → Jobs by Status) or donut for proportional breakdowns.
  - **List widgets**: a short table/list of the most relevant records (e.g. "Needs Review" jobs, "Pending Hisaab" queue) with a "View all" link into the full table view.
- Every widget has a header with a name, an info `(i)` tooltip explaining exactly what it measures, and — where relevant — a small edit/expand icon (matches the reference's per-card affordances). Users should never have to guess what a number means.
- Dashboards should be **role-aware**: a dispatcher's home dashboard emphasizes job intake/assignment; an accountant's emphasizes hisaab queue and ledger balances; admin's is the full KPI set. Don't ship one generic dashboard for every role.

---

## 5. Color & type (updated for this density)

- **Sidebar**: dark charcoal (`#1A1A1A`–`#222` range), white/light-grey text, one accent color for the active state and primary buttons (keep the same accent used across the whole product — don't introduce a second brand color for the sidebar vs. the content area).
- **Content area**: white/very light grey background, white table/card surfaces, thin light-grey borders between rows instead of heavy shadows — at this density, shadows read as noisy.
- **Status colors**, used only as pill fills, consistent everywhere: green = positive/complete/approved, amber = pending/in-progress, red = overdue/disapproved/blocked, purple or blue = a distinct "customer/lifecycle" style category (matches the reference's purple "Customer" pill), grey = draft/inactive.
- **Typography**: one sans-serif family throughout (Inter or similar). Table text and form labels can run smaller (13–14px) than the earlier dashboard-only draft, since density matters more here than dashboard-style large numerals — reserve large bold numerals for dashboard widgets specifically.

---

## 6. Accessibility

These are requirements, not nice-to-haves, given the system handles money and job assignments where mistakes are costly:

- **Keyboard navigation**: every table row, drawer, and form field reachable and operable via keyboard alone (Tab/Shift+Tab, Enter to open a row, Esc to close a drawer/modal). The search field's keyboard shortcut (shown as a hint, e.g. a key combo) should be a real, working shortcut, not decorative.
- **Focus states**: a clearly visible focus ring (not just a color change) on every interactive element — buttons, table rows, form inputs, sidebar items — meeting WCAG's non-text contrast requirement.
- **Color contrast**: body text and status pill text must meet WCAG AA contrast against their background (this affects the dark sidebar especially — verify light-grey label text on dark background actually passes, don't eyeball it). Never convey status by color alone — pair every status pill with a text label (already the plan) and consider an icon for colorblind users on the most critical statuses (e.g. "Disapproved").
- **Screen reader semantics**: tables use real `<table>`/ARIA-grid semantics with proper header associations, not divs styled to look like a table. Drawers and modals trap focus while open and return focus to the triggering element on close. Icon-only buttons (gear, refresh, export icons) need `aria-label`s — icons alone are not accessible names.
- **Form errors**: inline, associated with their field via `aria-describedby`, not just a color change on the border — a red border alone fails for colorblind and screen-reader users.
- **Touch targets (mobile technician app)**: minimum 44×44px tappable areas for all buttons, especially the primary action buttons (Accept/Start/Complete) technicians tap one-handed, often outdoors or wearing gloves.
- **Reduced motion**: respect `prefers-reduced-motion` — drawer slide-ins, map pin animations, and progress-ring animations should fall back to instant/near-instant transitions for users who've set that preference.
- **Text scaling**: layout must not break when a user increases browser/OS font size up to 200% — this rules out fixed-height text containers with hidden overflow anywhere real data (names, addresses, remarks) is displayed.
- **Dark-frame contrast**: since the sidebar and top bar now share one continuous dark background, re-verify every element placed on it — search placeholder text, icon buttons, the user-menu text — independently against that exact dark color, not against the sidebar color alone; a value that passed before top-bar unification may not pass once it's reused on both surfaces.
- **Row-level chevrons and inline dropdowns** (expand-row chevron, "Schedule ▾"-style inline action cells) must be independently focusable and operable by keyboard, with an `aria-expanded` state on the chevron and a proper `role="button"`/native `<button>` for the inline dropdown — these are easy to implement as inert `<span>`s with a click handler, which would fail keyboard and screen-reader users entirely.
- **Toolbar icon clusters** (kebab menu, sitemap/hierarchy icon, view toggles, pipeline/view selector) each need a distinct, descriptive `aria-label` — a row of unlabeled icon buttons next to each other is one of the most common screen-reader dead-ends in dense data tools, and this system has several such clusters (page-header icons, table-top icons, filter-chip icons).

---

## 7. Module-specific notes (updated for this pattern)

- **Jobs list**: tabs = All / My Jobs / Assigned Today / Needs Review (disapproved) / Completed. Table columns: Job #, Customer, Type, Technician, Status (pill), Created Date, Amount. Row click → full-page Job Detail (stepper + financial summary as previously specified).
- **Customers list**: tabs = All Contacts / Open Jobs / Care-Of Parties. "Add Customer" is a **drawer** (name, phone, address w/ Places autocomplete, email) — reachable both from here and inline from the New Job flow.
- **Companies/Care-Of list**: same table pattern, with a company detail page listing all jobs done "care of" that company.
- **Accounts/Ledgers**: party-type tabs (Customers / Suppliers / Technicians / Care-Of), table of running-balance rows, click into a party for the full ledger detail page.
- **HRM/Payroll**: table of payroll runs (period, status pill, total, approved by), click into a run for the full-page Draft→Approved→Paid stepper detail.
- **Purchasing**: PR/PO/GRN each get their own tabbed table view under a "Purchasing" section, with the product movement timeline as a dedicated detail page per product.
- **Feedback/Call Center**: single queue table (Customer, Job #, Days Since Verified, Call Status) — the call outcome itself is a **drawer** (radio buttons + remarks + conditional follow-up date), since it's a short, single-purpose form.
- **Dispatch map**: not a table — full-bleed map with a **drawer** (not a separate page) sliding in from the right when a technician pin is tapped, showing their current job, status, and an "Assign Job" action, so the map stays visible while assigning.