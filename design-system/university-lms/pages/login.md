# Login page

The supplied screenshot overrides the specification's single-column placement on desktop: campus image on the left, a centered 420px form on the right. The form itself remains compact. Per the updated user request, retain the desktop two-column layout with a minimum width of 1024px. Do not provide a separate mobile layout. All UI copy, validation, help, status messages, metadata and accessible labels are English. The header uses the University LMS wordmark and an original book symbol, not an unofficial university emblem.

Use the supplied campus photograph, optimized to WebP. Include email, password, password visibility toggle, forgot-password link, and the sole primary action “Sign in”. Google login in the visual reference is not part of the functional specification.

States: initial, field validation, focused error summary, loading, invalid credentials, disabled account, forbidden role, throttled requests, network failure, offline, timeout, malformed server response, and confirmed success followed by role-based navigation.

Backend authentication and recovery are not implemented in the existing project. The login adapter is opt-in through an environment variable. Password recovery now opens the frontend-only administrator-request modal described in `forgot-password.md`, following the user's additional screenshot. No OTP or email-link flow is implied. Destination routes show a neutral unavailable screen until the actual role areas are built; this is not an authenticated application shell.
