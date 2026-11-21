# A04 — Class Management

Source: supplied design.md §5.2.C and shared interaction/state/accessibility patterns, with the user's A04 CRUD scope. English-only desktop interface at `/admin/classes`; no mobile version. Reuse AdminShell, Dialog, Icon, Be Vietnam Pro, existing tokens and User Management directory/form styles.

## Scope and model

The source explicitly marks the Class model TBD. The implementation extends the existing sample model only: stable internal `id`, editable visible `code`, `courseId`, existing `instructorId`, and Active/Inactive status. No semester, academicYear, timetable, room, capacity or credits are invented. Instructor assignment and enrollment belong to A05: A04 displays their current values without adding assignment controls.

Table: Class code / Course / Instructor / Status / Actions. Search matches class code, course code/name and instructor name. Course and Status filters combine; sortable headers expose aria-sort. Pagination offers 5/10/25/50 rows. Names and codes wrap. Details show linked course, instructor, enrolled-student count and status.

Create/Edit: required Class code and existing Course. Code is trimmed, uppercased and unique case-insensitively, with a provisional frontend limit of 40 characters. New classes start Active, with no instructor or enrollments. Only active courses may be newly selected; an existing inactive course may be preserved during editing. The linked course is read-only when the class has enrollments or an assigned instructor. These are conservative preview rules pending the final backend contract, not claimed schema requirements.

Both activation and deactivation require confirmation. Activation requires an active linked course; deactivation preserves assignments/enrollments. Delete confirms a named class and is allowed only without enrollments or instructor assignment. Otherwise explain the restriction and suggest deactivation. No cascade deletion. The backend must enforce the final policies when integrated.

## State and accessibility

Loading, empty directory, filtered-empty, missing active courses, saved feedback, field errors, focused linked error summary, offline/retry, unavailable storage and stale records. Preserve form data after errors. Duplicate submits are blocked; cancellation aborts pending preview operations. Unsaved forms offer Keep editing / Discard changes. Confirmation focuses Cancel. Dialogs support keyboard Tab/Escape and restore focus; if a saved/deleted row disappears, focus returns to Add class.

## Shared preview data

`classStore.js` owns sessionStorage key `university-lms.class-preview.v1`, shape validation and relationship helpers. `classPreview.js` owns asynchronous list/save/status/delete behavior and validation. Splitting storage from the adapter avoids circular dependencies with Courses. Data is fictional and saved in this browser tab only; no API or authorization is implemented.

Internal IDs remain stable when codes change. Existing enrollment references are preserved. Dashboard, enrollment preview and course-linked-class details show current class codes on navigation. Course deletion checks read saved classes, so newly created classes protect their courses from deletion. Course details and class counts share the same records. Enrollment counts still derive from the existing A05 sample fixture until that module is implemented.

## Skill review

UI UX Pro Max returned a marketing hero layout for the broad design query; it is unsuitable for this directory. The explicit UX search verified confirmation-dialog and success-feedback guidance. Verified error-summary guidance and controlled React form state were applied. Keep the existing Master design; do not persist the mismatched generated layout. Desktop verification targets 1024/1440/1920px, keyboard behavior and contrast.

## Tests

Browser checks cover desktop layout/axe, search/filter/sort, add/duplicate/missing-field validation, saved data, code changes preserving references, course switching for empty classes, dynamically linked-course deletion protection, status confirmation and inactive-course guard, safe/blocked deletion, offline retry, discard/cancellation, missing courses, 105-row/long-content lists, storage failures and stale records. Courses/dashboard regression checks cover cross-module consistency.
