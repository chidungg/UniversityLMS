# University LMS frontend

React + Vite. A01 Authentication đã tích hợp API thật theo design.md và schema dự án. Hướng dẫn đầy đủ: [A01_AUTHENTICATION.md](../docs/A01_AUTHENTICATION.md).

## Chạy

```sh
npm install
npm run dev
```

Backend chạy ở port 5000, Vite proxy `/api`. Chạy migration A01 ở Backend trước khi khởi động. Mở `/login`; không cần VITE_AUTH_LOGIN_URL. Dùng tài khoản có sẵn trong DB, không có đăng nhập giả hoặc tài khoản được chọn sẵn.

## Authentication

- `/login`: email, password, role do server quyết định; form tiếng Việt 420px theo design.md mục 5.1.
- `/forgot-password`: gửi yêu cầu thật, Admin xử lý tại `/admin/password-resets`.
- `/change-password`: đổi mật khẩu; bắt buộc sau reset bằng mật khẩu tạm.
- Cookie HttpOnly, phiên 8 giờ, kiểm tra `/api/auth/me`, logout thu hồi phiên trên server. Không lưu token/user trong browser storage.
- Guard Admin/Instructor/Student; lỗi 401/403 không được biến thành dữ liệu mẫu. Instructor có trang vào riêng; module lớp sẽ được kết nối sau.
- Dùng `src/services/http.js` và `src/app/AuthContext.jsx` làm boundary cho các module tiếp theo. DTO dùng `_id`, `fullName`, `Administrator/Instructor/Student`, `isActive` đúng schema.

## Kiểm thử A01

```sh
npm run test:auth
npm run test:e2e:auth
npm run build
```

E2E A01 dùng Edge, API thật và MongoDB replica set tạm, không kết nối DB dự án. Các bài browser test preview cũ dùng fixture/hợp đồng cũ, cần chuyển sang xác thực thật trước khi dùng để nghiệm thu những module tiếp theo.

## Các module quản trị khác

Các phần bên dưới mô tả preview A02–A06. Chúng đã nằm sau guard Administrator nhưng nghiệp vụ vẫn sử dụng dữ liệu minh họa. Riêng Password resets đã dùng API và database thật.

## Admin dashboard preview

Open `/admin` (or `/admin/dashboard`) for the English desktop dashboard. The sidebar and topbar share the project's font, colors and existing dialog/icon components. `/admin/enrollments` and `/admin/statistics` currently show read-only module previews. `/admin/users`, `/admin/courses` and `/admin/classes` have dedicated interactive frontends described below.

All admin content is explicitly labeled sample data from `src/features/admin/dashboardData.js`. Counts, instructor-attention items and enrollment summaries are derived from that fixture. Class search, clear/no-results feedback, detail dialogs, keyboard focus restoration, refresh/loading and offline/retry interactions are available. Refresh reloads the preview presentation without calling an API. Logout now revokes the authenticated session on the server.

The dashboard routes contain fictional fixtures and are protected by the A01 Administrator guard. Live academic APIs remain to be implemented. Course/Class/Enrollment relationships remain a proposed frontend shape until the team finalizes the schema.

Run `npm run test:e2e -- admin.spec.js` for the focused desktop dashboard checks.

## User Management frontend

`/admin/users` includes search, combined role/status filters, sorting, pagination, Add/Edit dialogs and Activate/Deactivate confirmations. Required fields are full name, email and role. Validation covers missing values, invalid/duplicate emails, and frontend name/email length limits (100/254). No hard-delete or password-provisioning workflow is assumed.

`src/features/admin/users/userPreview.js` is the isolated preview adapter. Changes persist in sessionStorage for the current browser tab, under `university-lms.user-preview.v1`, and are reflected in dashboard counts and related name lookups on navigation. Refresh preserves edits. This is sample account data, not authentication/session storage; no passwords or credentials are stored. Remove this key in browser developer tools to restore the initial sample directory.

The UI handles loading, empty/filtered-empty lists, inline validation, saved feedback, offline retry, unavailable storage, missing records, and unsaved-change confirmation. Real API, server-side authorization, account provisioning and role-change rules for existing academic relationships remain integration work. Do not supply live user data until those boundaries are implemented.

Run `npm run test:e2e -- users.spec.js admin.spec.js` for User Management and dashboard regression checks. Design decisions: `../design-system/university-lms/pages/user-management.md`.

## A03 — Course Management frontend

`/admin/courses` includes a searchable, status-filtered, sortable and paginated catalog; Add/Edit dialogs; full course details; Activate/Deactivate confirmations; and Delete confirmation for courses without linked classes. A linked course shows an explanation instead of allowing deletion. Course status changes preserve linked classes and their statuses.

`src/features/admin/courses/coursePreview.js` isolates sample persistence and validation. Required fields are code and name; description is optional. Frontend limits are 30/200/500 characters, pending the final API contract. Codes are saved uppercase and checked for case-insensitive duplicates. A stable internal ID preserves class references when codes change.

Data persists in sessionStorage under `university-lms.course-preview.v1`. Refresh keeps changes; dashboard metrics, class names and statistics use the saved course snapshot on navigation. Remove this key in browser developer tools to restore sample courses. This is a frontend demonstration: no live academic data, API or authorization is implemented. Deletion/relationship policies remain provisional until backend integration.

Run `npm run test:e2e -- courses.spec.js users.spec.js admin.spec.js`. Page decisions and integration assumptions: `../design-system/university-lms/pages/course-management.md`.

## A04 — Class Management frontend

`/admin/classes` includes search, Course/Status filters, sorting, pagination, details, Add/Edit dialogs, status confirmations and guarded Delete. The form contains Class code and Course only. Instructor/enrollment information is read-only in A04; assignment belongs to A05. Semester and academic year are omitted because the schema is not finalized.

`src/features/admin/classes/classStore.js` stores samples in `university-lms.class-preview.v1` for the current browser tab. `classPreview.js` isolates asynchronous operations and validation. Codes are uppercased, unique ignoring case and limited to 40 characters as a frontend assumption. Stable IDs preserve enrollment references when visible codes change. Dashboard, course details and enrollment previews use the same saved classes on navigation.

Provisional integrity rules: newly selected courses must be active; an existing inactive course can be kept. A class with an instructor or enrollment cannot switch courses or be deleted. Activation requires an active course. Deactivation keeps related records. The final backend must confirm these rules and enforce authorization; this frontend does not make API calls or change real academic data. Remove the class preview key in developer tools to restore initial sample classes.

Run `npm run test:e2e -- classes.spec.js courses.spec.js admin.spec.js`. Design decisions: `../design-system/university-lms/pages/class-management.md`.
