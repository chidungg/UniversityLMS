# A03 — Course Management

Source: user-provided design.md §5.2.B and shared form/table/state/accessibility patterns (§6–9), plus the user's A03 CRUD scope. English-only, desktop-only (1024/1440/1920px). Route: `/admin/courses`.

## Visual and interaction design

Reuse AdminShell, Dialog, Icon, the shared tokens and existing User Management directory/form styles. Page header with one primary Add course action. White catalog panel with search, status filter, count and sortable Code/Name/Status columns. Table columns exactly follow the specification: Course code, Course name, Description, Status, Actions. Pagination offers 5/10/25/50 rows. No unrelated metrics, gradients or mobile layout.

Create/edit modal contains required code and name plus optional short description. Code is normalized to uppercase; uniqueness is case-insensitive. Frontend limits: code 30, name 200, description 500 characters. These limits, optional description and initial Active status are implementation assumptions pending the final API/schema, not requirements invented by design.md. Missing/duplicate data receives inline errors and a focused linked summary. Description has a character counter. Long names wrap; descriptions longer than 120 characters offer keyboard-accessible Read more to show the complete text in a details dialog.

Status changes use a separate named confirmation for both Activate and Deactivate. They preserve classes/enrollments and do not cascade class status. Details show the course and linked sample classes. CRUD includes a separate low-emphasis Delete action with confirmation. As a provisional frontend integrity rule, courses with linked classes cannot be deleted; the dialog explains this and recommends deactivation. The backend must confirm/enforce deletion rules before production use.

Forms preserve input after errors, block duplicate submits, show saving feedback, support cancellation and confirm discarded edits. Status/delete confirmations focus Cancel. Native dialogs handle Tab, Escape, focus restoration and background isolation. After a row disappears (delete or filtering), focus falls back to Add course. Include loading, empty, filtered-empty, saved, offline/retry, unavailable storage and stale-record states.

## Data boundary

`coursePreview.js` is an isolated asynchronous frontend adapter. Initial courses derive from dashboardSample with fictional descriptions. SessionStorage key: `university-lms.course-preview.v1`. Changes are scoped to this browser tab. No API calls or production records. Keep the internal `id` stable when editing the visible `code`, preserving existing `class.courseId` references. The dashboard, class names and statistics preview read the same course snapshot on navigation. Linked-class details and deletion guards now use A04's shared class storage, including newly created classes and changed codes. Corrupt storage surfaces a catalog error rather than being overwritten silently.

Production integration still requires confirmed fields/limits, server-confirmed admin permissions, conflict/error mappings, and server-side relationship checks. Do not infer permissions from sample storage. Existing authentication and other modules are outside A03 scope.

## UI UX Pro Max review

The design-system query returned a marketing hero pattern; it does not fit this catalog and was not adopted. Retain the existing Master. Verified UX form guidance supports a focusable linked error summary alongside inline errors; React guidance supports controlled input state. Table search returned mobile-overflow advice, which is not an exact match for desktop sorting; use general semantic-table guidance with aria-sort and keyboard-operated header buttons. No unverified generated design system was persisted.

## Verification

Playwright checks cover desktop layout and axe accessibility, search/filter/sorting, create validation/duplicate code, persistence, code edits with preserved class references, status confirmation, blocked linked-course deletion, confirmed unlinked deletion, offline recovery, storage/stale-record errors, unsaved edits/cancellation, empty and 105-row catalogs, long descriptions and pagination. Existing Users and Admin dashboard checks provide regression coverage.
