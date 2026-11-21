# Student password reset requests

Source: supplied `design.md` (sections 5.1, 5.2, 6–9) and `forgot-password.md`. English desktop frontend within `AdminShell`, reusing `Dialog`, `Icon`, `admin.css`, `users.css`, and shared design tokens. Route: `/admin/password-resets`.

## Layout

Task-focused queue matching User, Course, Class, and Enrollment administration. One directory panel contains search (student name, email, request ID, or note), Status filter (`Pending`, `Completed`, `Rejected`), Account check filter (`Eligible students`, `Needs review`), sortable columns (`Student`, `Submitted`, `Status`), queue counts, and pagination (`5/10/25/50`). Timestamps use `dd/MM/yyyy, HH:mm` in `Asia/Ho_Chi_Minh`. No decorative KPI cards, no passwords or tokens in the table.

## Interactions

- **Request details dialog**: Inspect full student note (never truncated), account match status, submitted/reviewed timestamps, and admin resolution note, with direct actions for `Pending` requests.
- **Reset student password dialog**: Guards against unmatched emails, inactive students, and non-student accounts with clear recovery links to User management. For eligible active students, requires explicit identity verification confirmation, temporary password (min 8 chars) and confirmation match with show/hide toggles (`aria-pressed`), paste/password-manager support, optional resolution note (300 chars), focused linked error summary, and unsaved-changes discard confirmation.
- **Reject request dialog**: Requires a rejection reason (up to 300 chars), preserves input on failure, confirms discard on dirty close, and separates destructive action from Cancel.

## Security and preview boundary

`passwordResetPreview.js` reads sample users from `userPreview.js` and stores request metadata only under `university-lms.password-reset-preview.v1` in `sessionStorage`. Temporary passwords are validated locally and never stored in browser storage, logged, or displayed in the table. No real password changes and no email is sent until backend verification and reset endpoints are finalized.
