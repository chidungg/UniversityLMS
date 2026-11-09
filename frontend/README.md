# University LMS frontend

React + Vite login screen. English-only desktop UI, local Be Vietnam Pro fonts, and the supplied campus photograph optimized to WebP.

## Run

```sh
npm install
npm run dev
```

Open `/login` (or `/`). `/forgot-password` and `/support` provide account assistance. The desktop layout keeps the campus image and sign-in form side by side, with a minimum width of 1024px. No separate mobile layout is provided.

## Checks

```sh
npm run lint
npm run build
npm test
npm run test:e2e
```

Browser checks use Microsoft Edge via Playwright. If Edge is unavailable, change `channel` in `playwright.config.js` to an installed supported browser. All authentication responses in the browser tests are intercepted fixtures, not real user accounts. The test server sets its own mock endpoint; production never enables a mock login.

## Authentication integration — proposed contract, not implemented backend

The existing backend has a health endpoint only. Login is intentionally unavailable until the team implements and confirms an authentication contract. No credentials are saved in localStorage/sessionStorage and no successful login is fabricated.

Set `VITE_AUTH_LOGIN_URL` in a local `.env.local` only after the endpoint exists. Restart Vite after changing it. An example is in `.env.example` (disabled by default).

`src/features/auth/auth.js` is the integration boundary. It sends `POST` JSON `{ email, password }` with `credentials: include`. The proposed response is:

```json
{ "user": { "id": "server-user-id", "role": "student", "isActive": true } }
```

The backend must establish an HttpOnly, Secure, appropriately SameSite-scoped session cookie and perform all authorization checks. Cross-origin deployments require explicit CORS credentials configuration. The current frontend does not implement persistent session checks, logout, or protected learning pages; these belong to the future authenticated app shell.

Recognized roles and destinations:

- `admin` → `/admin/users`
- `instructor` → `/instructor/classes`
- `student` → `/student/courses`

After confirmed success the password is cleared, a success message appears, and the browser replaces the login URL with the destination. The admin destination currently displays an explicitly labeled sample preview; student and instructor destinations are not yet implemented and use the not-found page. Unknown roles or malformed success payloads do not redirect.

Error mappings: `401` invalid credentials; `403` with `code: ACCOUNT_DISABLED` disabled account; other `403` forbidden; `429` rate limit; network/server errors retryable. Requests time out after 15 seconds and abort when leaving the form. Raw server error messages are never displayed. A deactivated user in a success payload is also rejected.

Password recovery is a frontend-only modal based on the supplied administrator-recovery reference. Open it from “Forgot password?” or directly at `/forgot-password`. It reuses the login email, accepts an optional 500-character note, and provides validation, cancellable loading, offline/retry feedback, and an explicitly labeled preview confirmation. No request is sent, no account lookup occurs, and no password changes. `recoveryPreview.js` is the isolated demo adapter to replace when the team confirms the real recovery API. OTP and reset-link flows remain out of scope. No Google sign-in, registration, remembered-login checkbox, or role picker was added.

## Main files

- `src/features/auth/LoginPage.jsx`: layout, accessible form, help routes, feedback.
- `src/features/auth/auth.js`: validation, opt-in service, error mapping, role destinations.
- `src/features/auth/login.css`: desktop page styling.
- `src/features/auth/ForgotPasswordDialog.jsx`: administrator recovery request preview.
- `src/components/ui/Dialog.jsx`: native modal, background isolation, scroll lock, Escape and focus restoration.
- `src/styles/tokens.css`: shared design tokens.
- `../design-system/university-lms/`: recorded design decisions.


## Admin dashboard preview

Open `/admin` (or `/admin/dashboard`) for the English desktop dashboard. The sidebar and topbar share the project's font, colors and existing dialog/icon components. `/admin/users`, `/admin/courses`, `/admin/classes`, `/admin/enrollments` and `/admin/statistics` currently show read-only module previews; CRUD is not implemented by this dashboard feature.

All admin content is explicitly labeled sample data from `src/features/admin/dashboardData.js`. Counts, instructor-attention items and enrollment summaries are derived from that fixture. Class search, clear/no-results feedback, detail dialogs, keyboard focus restoration, refresh/loading and offline/retry interactions are available. Refresh reloads the preview presentation without calling an API. Exit preview returns to login; it is not server-side logout.

The dashboard routes contain fictional fixtures only and currently have no session or RBAC guard. Before connecting live data, implement server-confirmed session handling and enforce admin authorization. Course/Class/Enrollment relationships remain a proposed frontend shape until the team finalizes the schema.

Run `npm run test:e2e -- admin.spec.js` for the focused desktop dashboard checks.
