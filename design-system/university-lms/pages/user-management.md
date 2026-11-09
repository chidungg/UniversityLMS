# User management

Source: supplied design.md, sections 5.2.A, 6–9. English desktop only, as requested. Reuse AdminShell, Dialog, Icon and shared design tokens. Route: `/admin/users`.

## Layout

Task-focused header with one primary Add user action. One directory panel contains search by name/email, Role and Status filters, sortable columns Full name / Email / Role / Status / Actions, result count and pagination (5/10/25/50 rows). No duplicate KPI cards or bulk-delete controls. White surfaces, restrained blue controls, readable table rows and wrapping names/emails at 1024, 1440 and 1920px.

## Interactions

- Add/Edit dialog: full name, email, role (Student, Instructor, Admin); all required. Trim values, validate email format and case-insensitive uniqueness, limit name to 100 and email to 254 characters. These length limits are frontend assumptions pending the API contract.
- New sample accounts start Active. Edit preserves status; distinct Activate/Deactivate actions use a named confirmation dialog. Deactivation preserves the record. No hard delete, password field or reset invitation because provisioning/reset contracts are not established.
- Inline blur/submit errors, focused linked error summary, duplicate-submit prevention, retained values after failure, loading feedback, explicit save result. Unsaved edits offer Keep editing / Discard changes. Cancelling during a pending preview operation aborts it.
- Native dialogs trap focus, support Escape, and restore focus. Status dialogs initially focus Cancel. Filters reset pagination; sorting exposes aria-sort. Empty directory and filtered-empty have distinct recovery actions.

## Preview boundary

`userPreview.js` is a replaceable async frontend adapter. It reads fictional existing dashboard users and saves changes under `university-lms.user-preview.v1` in sessionStorage, scoped to this browser tab. No credentials, real accounts, emails or access permissions are created. No API exists yet. Dashboard counts and related name lookups read the same sample snapshot on navigation. Browser-storage failures, offline operations and missing records never report a save success.

This is an Admin UI preview, not authentication or RBAC enforcement. Before live use, replace this adapter, verify sessions/permissions on the server, map authorization/conflict responses, and finalize provisioning and role-change rules for existing enrollments/assignments. Do not infer a real session from the sidebar identity or stored sample users.

## Skill review

UI UX Pro Max searches for university administration and enterprise account management returned unsuitable portfolio/marketing patterns; those layouts were not adopted. The enterprise minimal styling matched the established direction. Use the existing Master and general form/table guidance: fixed labels, accessible inline errors, keyboard operation, one primary action, clear destructive confirmation, and local React state. No global palette/font changes.

## Verification

Focused browser checks cover desktop accessibility/layout, search/filter/sort/pagination, create validation/duplicate email, edits/roles, status confirmations, persistence/dashboard synchronization, offline retry, storage failure, stale records, empty/long/105-record lists and discard/focus behavior.
