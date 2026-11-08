# University LMS — Design decisions

Source of truth: the user-provided `design.md` (08/11/2026). The user subsequently requested English-only UI and desktop-only scope; these preferences override the original language and mobile guidance. UI copy, code and routes are English.

## Visual direction

Calm academic interface with white surfaces, pale blue-gray backgrounds, restrained blue interactions, thin borders, and minimal shadows. Use Be Vietnam Pro, locally bundled with the Latin subset. No gradients, marketing metrics, social login, role selector, or invented institutional logo.

UI/UX Pro Max searches were reviewed. Its university portfolio and children's education recommendations did not fit this authentication screen; they were not adopted. The provided specification takes precedence. Verified form guidance: visible labels, inline errors with accessible descriptions, a focused linked error summary after failed submission, keyboard navigation, and reduced motion.

## Tokens

Implementation source: `frontend/src/styles/tokens.css`. Primary #155E95; hover #1664A9; page #F7F9FC; surface white; text #1F2937; secondary #4B5563; muted #64748B; danger #B42318; success #157347. Control borders use #8796A8 for non-text contrast. Card radius 10px; input radius 6px; button radius 8px. Spacing follows the specification's 4/8px scale.

## Interaction

Only one primary form action. Validate on blur and submit. Preserve entered credentials on recoverable errors, clear password on success, allow paste and password managers, and do not save credentials in browser storage. Busy states disable repeated submissions. Use server-assigned roles only. Do not claim a session exists without a successful server response.
