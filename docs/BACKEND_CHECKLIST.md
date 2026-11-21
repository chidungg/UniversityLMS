# Checklist Backend — UniversityLMS

Ngày rà soát: 21/11/2026. Phạm vi: A01–A06 và I07 theo yêu cầu.

Đánh giá dựa trên mã nguồn trong repository, chưa xác nhận hoạt động với MongoDB thật. `[x]` chỉ đánh dấu thành phần đã thấy trong code; không đồng nghĩa đã nghiệm thu. Các API ghi “đề xuất” chưa tồn tại. FE A01–A05 được xem là đã hoàn thành giao diện theo thông tin của bạn, nhưng vẫn cần tích hợp API. A06, I07 còn cần hoàn thiện FE.

## 1. Kết quả rà soát

| Mục | Đã có ở Backend | Còn thiếu |
|---|---|---|
| A01 Authentication | Login bcrypt/JWT, `/me`, middleware xác thực, kiểm tra tài khoản active và role | Logout/thu hồi phiên, reset password, giới hạn thử đăng nhập, thống nhất hợp đồng FE–BE |
| A02 User Management | Model User, enum 3 role, khai báo index email unique | Toàn bộ API quản trị tài khoản/role/trạng thái/xóa |
| A03 Course Management | Model Course, API đọc cho Student | CRUD và trạng thái cho Admin, kiểm tra quan hệ trước khi xóa |
| A04 Class Management | Chưa có model Class | Model, API, validation, quan hệ với môn/giảng viên/ghi danh |
| A05 Enrollment | Model Enrollment theo `courseId + studentId`, helper kiểm tra ghi danh | Ghi danh theo lớp, hủy ghi danh, phân công/gỡ giảng viên, API quản trị |
| A06 Statistics & Reports | Chưa có API Admin | Tổng hợp DB, bộ lọc, báo cáo/xuất dữ liệu; FE mới có preview |
| I07 Monitor Students | Assignment, Submission có `grade`, `feedback` | Phạm vi lớp được dạy, gradebook, dữ liệu tiến độ, API tổng hợp; chưa có route FE Instructor |

Các nguồn đối chiếu chính:

- `backend/src/server.js`: chỉ mount `/api/auth` và `/api/student`.
- `backend/src/routes/authRoutes.js`, `controllers/authController.js`, `middlewares/authMiddleware.js`: login, me, Bearer JWT, role.
- `backend/src/models/`: User, Course, Enrollment, Assignment, Submission, LearningMaterial, Announcement; chưa có Class và LearningProgress.
- `frontend/src/features/admin/{users,courses,classes,enrollments}/*Preview.js`: nghiệp vụ mẫu, lưu qua sessionStorage.
- `frontend/src/features/auth/auth.js`: contract login dùng cookie, `user.id`, role viết thường; khác Backend.
- `frontend/src/app/AuthContext.jsx`: user/token giả, `isAuthenticated: true`; logout quay lại user giả.
- `frontend/src/app/Router.jsx`: `/login` dùng `pages/auth/LoginPage.jsx`, không dùng màn hình `features/auth/LoginPage.jsx`; chưa có route guard và route Instructor.
- `frontend/src/services/api.js`: lỗi API bị chuyển sang dữ liệu mock ở nhiều chức năng, kể cả login/me.
- `frontend/src/features/auth/ForgotPasswordDialog.jsx`: yêu cầu khôi phục gửi Admin; không phải tự reset bằng email link.
- `frontend/src/features/admin/AdminDashboard.jsx`: thống kê preview, refresh không gọi dữ liệu thật.

## 2. P0 — Chốt mô hình và hợp đồng trước khi viết CRUD

- [ ] Tạo Class với `classCode`, `courseId`, `instructorId` nullable, `isActive`, timestamps. FE hiện thể hiện một giảng viên cho mỗi lớp; chưa cần bảng phân công nhiều giảng viên.
- [ ] Chuyển Enrollment sang tham chiếu `classId + studentId`; tạo unique index cho cặp này. `courseId` nếu giữ để tối ưu phải được suy ra từ Class và đồng bộ ở server.
- [ ] Viết migration có dry-run, thống kê trước/sau và phương án rollback cho Enrollment cũ. Khi một môn có nhiều lớp, không tự đoán lớp cho dữ liệu cũ; dùng bảng ánh xạ được kiểm tra.
- [ ] Chốt phạm vi Assignment/Material/Announcement: tài liệu có thể dùng chung theo môn, nhưng bài tập/điểm cần phân biệt lớp hoặc có bảng phân phối nội dung cho lớp. Không để giảng viên một lớp xem điểm lớp khác cùng môn.
- [ ] Sửa helper `isStudentEnrolled`, `getEnrolledCourseIds` và API Student theo mô hình mới; lấy danh sách môn distinct để không nhân bản môn khi sinh viên học nhiều lớp.
- [ ] Chốt quy tắc inactive: chặn ghi danh/phân công mới vào lớp hoặc môn inactive; xác định quyền đọc lịch sử và quyền nộp bài khi ngừng hoạt động.
- [ ] Thống nhất DTO bằng serializer/adapter theo bảng dưới; không dùng mã hiển thị làm khóa liên kết.
- [ ] Thống nhất cơ chế phiên giữa hai phần FE. Đề xuất tận dụng Bearer JWT hiện có trước, thêm cơ chế thu hồi; nếu chọn HttpOnly cookie thì sửa đồng bộ BE/client và bổ sung chống CSRF phù hợp.
- [ ] Chuẩn hóa JSON lỗi `{ status, code, message, fields? }`, phân trang `{ data, pagination }`, ID/date và enum; ghi API contract/OpenAPI.

| Ý nghĩa | FE hiện tại | BE hiện tại | Cần xử lý |
|---|---|---|---|
| ID | `id` trong Admin, `_id` trong Student | `_id` | Adapter thống nhất, ID bất biến |
| Họ tên | `name` trong Admin | `fullName` | Mapping rõ ràng |
| Mã/tên môn | `code`, `name` | `courseCode`, `courseName` | Mapping rõ ràng |
| Role Admin | `Admin` trong CRUD; `admin` trong auth.js | `Administrator` | Chọn enum canonical và map ở boundary |
| Role khác | `Student/Instructor` hoặc `student/instructor` | `Student/Instructor` | Không so sánh lẫn kiểu viết |
| Trạng thái | `Active/Inactive` | `isActive: boolean` | Chuyển đổi ở adapter |
| Ghi danh | `classId` | `courseId` | Migration dữ liệu và sửa truy vấn |
| Phiên | Cookie contract và mock token cùng tồn tại | Bearer JWT | Chỉ một luồng xác thực thật |

## 3. A01 — Authentication

- [x] Có `POST /api/auth/login`: chuẩn hóa email, so sánh bcrypt, chặn inactive, phát JWT.
- [x] Có `GET /api/auth/me`, authenticate và requireRole; middleware đọc lại user từ DB.
- [ ] Validate kiểu dữ liệu email/password trước `.trim()`/bcrypt; trả lỗi 400 thay vì 500 cho payload sai.
- [ ] Bỏ JWT secret mặc định trong code; kiểm tra cấu hình bắt buộc khi khởi động.
- [ ] Tạo logout có vô hiệu hóa phiên phía server. Đề xuất `AuthSession`/session ID trong JWT; nếu dùng `tokenVersion` cần ghi rõ logout sẽ kết thúc mọi phiên.
- [ ] Chốt hết hạn phiên và “remember me”; refresh token là tùy chọn nếu cần duy trì phiên dài, không bắt buộc thêm ngay.
- [ ] Rate limit login và recovery; không tiết lộ tài khoản có tồn tại qua phản hồi recovery.
- [ ] Tạo PasswordResetRequest theo FE: email, note tối đa 500 ký tự, trạng thái pending/resolved/rejected, người xử lý, thời điểm xử lý; giới hạn gửi trùng/spam.
- [ ] API công khai tiếp nhận recovery; API Admin xem và xử lý yêu cầu sau xác minh danh tính.
- [ ] Admin đặt mật khẩu mới/khởi tạo mật khẩu tạm qua kênh phù hợp; hash trước khi lưu, không ghi mật khẩu vào log hoặc trả trong danh sách user.
- [ ] Thu hồi phiên sau reset; nếu dùng mật khẩu tạm, thêm `mustChangePassword` và API đổi mật khẩu lần đầu với quyền hạn chế.
- [ ] Bảo vệ toàn bộ `/api/admin/*` bằng Administrator; `/api/instructor/*` bằng Instructor và kiểm tra lớp được phân công.
- [ ] Thay mock AuthContext, khôi phục phiên qua `/me`, guard route FE, điều hướng đúng role và nối màn hình login/recovery chính thức.
- [ ] Test: đúng/sai mật khẩu, inactive, JWT hết hạn/giả, logout rồi dùng lại token, reset rồi dùng token cũ, sai role, payload sai kiểu.

API đề xuất thêm: `POST /api/auth/logout`, `POST /api/auth/recovery-requests`, `GET /api/admin/recovery-requests`, `PATCH /api/admin/recovery-requests/:id`, `POST /api/admin/users/:id/reset-password`; thêm `POST /api/auth/change-password` nếu dùng mật khẩu tạm.

Nghiệm thu: reload vẫn xác thực đúng; logout không còn dùng được phiên; tài khoản sai quyền không gọi được API dù bỏ qua FE.

## 4. A02 — User Management

- [x] Có User với email, fullName, passwordHash, role, isActive, createdAt.
- [ ] API danh sách/chi tiết, tìm theo tên/email, lọc role/trạng thái, phân trang, sắp xếp có allowlist.
- [ ] Tạo tài khoản: tên tối đa 100, email hợp lệ tối đa 254 theo FE; normalize email, kiểm tra unique ở DB, hash mật khẩu khởi tạo.
- [ ] FE tạo user chưa nhập mật khẩu: nối với quy trình cấp mật khẩu/tạo lời mời, tránh tạo user không thể đăng nhập.
- [ ] Cập nhật thông tin và role; chỉ nhận trường được phép, không cho client ghi trực tiếp passwordHash/session fields.
- [ ] Kích hoạt/vô hiệu hóa; bảo vệ Admin hoạt động cuối cùng, ngăn tự khóa tài khoản đang quản trị ngoài chủ đích.
- [ ] Khi đổi role Student/Instructor đã có quan hệ, yêu cầu xử lý quan hệ hoặc từ chối với 409; không để assignment/enrollment mồ côi.
- [ ] Chốt xóa user: đề xuất chỉ xóa bản ghi chưa có quan hệ; có bài nộp/điểm/ghi danh/phân công thì dùng deactivate hoặc archive để giữ lịch sử.
- [ ] Bổ sung UI xóa nếu CRUD bắt buộc: preview hiện có tạo/sửa/trạng thái, chưa có thao tác xóa user.
- [ ] Audit thay đổi role, trạng thái, reset mật khẩu; không lưu nội dung mật khẩu.
- [ ] Test email trùng khác hoa/thường, 2 request tạo đồng thời, role không hợp lệ, đổi role khi đang được phân công, Admin cuối cùng, response không lộ hash.

API đề xuất: `GET/POST /api/admin/users`, `GET/PATCH/DELETE /api/admin/users/:id`, `PATCH /api/admin/users/:id/status`.

Nghiệm thu: thay đổi được lưu DB và phản ánh đúng quyền truy cập ngay sau khóa/đổi role.

## 5. A03 — Course Management

- [x] Có Course, isActive và khai báo index mã môn unique; có API đọc Student.
- [ ] CRUD Admin; danh sách tìm theo mã/tên, lọc trạng thái, phân trang và số lớp liên quan.
- [ ] Validate theo FE: mã <= 30, tên <= 200, mô tả <= 500; trim, mã viết hoa và không trùng.
- [ ] Sửa mã hiển thị không thay đổi `_id` và không làm mất liên kết Class.
- [ ] API activate/deactivate; áp dụng thống nhất quy tắc ảnh hưởng tới lớp và nội dung Student.
- [ ] Không xóa môn còn lớp. Kiểm tra cả Enrollment/Assignment/LearningMaterial/Announcement cũ đang tham chiếu môn, tránh orphan trước khi migration hoàn tất.
- [ ] Trả 409 và mã lỗi `HAS_CLASSES`/mã tương đương để FE hiển thị hướng xử lý.
- [ ] Test trùng mã, payload sai, môn không tồn tại, xóa môn có quan hệ, cập nhật mã vẫn giữ liên kết.

API đề xuất: `GET/POST /api/admin/courses`, `GET/PATCH/DELETE /api/admin/courses/:id`, `PATCH /api/admin/courses/:id/status`.

Nghiệm thu: Admin CRUD thật; môn bị chặn xóa có thông báo rõ và dữ liệu liên quan còn nguyên.

## 6. A04 — Class Management

- [ ] Tạo model Class và index mã lớp unique; mã <= 40 theo FE, trim/uppercase; validate môn tồn tại.
- [ ] CRUD, tìm theo mã lớp/môn, lọc môn/trạng thái/giảng viên, phân trang.
- [ ] Response có môn, giảng viên hiện tại và số sinh viên; lookup endpoint cho form chọn môn.
- [ ] Chỉ tạo lớp mới/gán sang môn đang active; chặn đổi môn khi lớp có ghi danh hoặc giảng viên theo FE.
- [ ] Activate/deactivate; không activate khi môn liên kết inactive.
- [ ] Không xóa lớp có ghi danh/giảng viên; mở rộng kiểm tra bài tập, bài nộp, tiến độ khi bổ sung các model này.
- [ ] Giữ phân công giảng viên ở A05; không nhận instructorId tùy ý qua payload sửa lớp để tránh bỏ qua kiểm tra A05.
- [ ] Test mã trùng, môn không tồn tại/inactive, chuyển môn có quan hệ, xóa lớp có dữ liệu, update đồng thời.

API đề xuất: `GET/POST /api/admin/classes`, `GET/PATCH/DELETE /api/admin/classes/:id`, `PATCH /api/admin/classes/:id/status`.

Nghiệm thu: lớp liên kết đúng môn; mọi quy tắc của classPreview được kiểm tra lại ở Backend.

## 7. A05 — Enrollment và phân công giảng viên

- [x] Có model Enrollment và helper kiểm tra ghi danh theo môn, cần chuyển đổi để dùng theo lớp.
- [ ] API danh sách ghi danh theo lớp, tìm sinh viên đủ điều kiện và giảng viên đủ điều kiện; không tải toàn bộ user về client.
- [ ] Ghi danh: lớp/môn tồn tại và active, user role Student và active, chưa ghi danh lớp đó.
- [ ] Unique index `(classId, studentId)` thực sự tồn tại trong MongoDB; xử lý duplicate-key thành 409, không chỉ kiểm tra bằng find trước insert.
- [ ] Hủy ghi danh: xác nhận bản ghi tồn tại, thu hồi quyền truy cập lớp, giữ lịch sử bài nộp/điểm. Đề xuất trạng thái withdrawn để tránh mất dấu lịch sử; tái ghi danh kích hoạt lại bản ghi.
- [ ] Phân công/thay giảng viên: role Instructor và active, lớp/môn active; đúng một giảng viên cho mỗi lớp theo FE hiện tại.
- [ ] Gỡ phân công: giảng viên cũ mất quyền truy cập lớp ngay; không xóa lịch sử chấm điểm của họ.
- [ ] Chốt quy tắc học hai lớp cùng môn: FE hiện chỉ cấm trùng cùng lớp; không tự thêm ràng buộc cùng môn/học kỳ nếu chưa có yêu cầu.
- [ ] Khi cập nhật nhiều tài liệu DB, dùng transaction nếu môi trường hỗ trợ hoặc cơ chế nhất quán tương đương; kiểm tra lại trạng thái và quan hệ khi có cập nhật đồng thời.
- [ ] Test ghi danh trùng đồng thời, user sai role/inactive, lớp/môn inactive, hủy không tồn tại, thay giảng viên và truy cập bằng tài khoản cũ.

API đề xuất: `GET/POST /api/admin/classes/:classId/enrollments`, `DELETE /api/admin/classes/:classId/enrollments/:studentId`, `PUT/DELETE /api/admin/classes/:classId/instructor`. DELETE enrollment có thể thực hiện rút học logic và giữ lịch sử.

Nghiệm thu: Admin ghi danh/phân công xong thì Student/Instructor thấy đúng lớp; hủy/gỡ phân công có hiệu lực ở API.

## 8. A06 — Statistics & Reports

Phạm vi tối thiểu đề xuất dựa trên dashboard hiện có; biểu đồ xu hướng/học kỳ chưa có dữ liệu nền, không coi là bắt buộc mặc định.

- [ ] API tổng quan từ MongoDB: số Student, Instructor, môn active, lớp active.
- [ ] Số lượt ghi danh đang hiệu lực, số sinh viên được ghi danh distinct, số lớp active chưa có sinh viên.
- [ ] Danh sách lớp chưa phân công giảng viên; lớp có giảng viên đã inactive cần được báo riêng để tránh hiểu nhầm là đã sẵn sàng.
- [ ] Báo cáo theo môn/lớp: mã, tên môn, giảng viên, trạng thái, số sinh viên; tìm kiếm/lọc/phân trang.
- [ ] Chốt định nghĩa total/active và phạm vi rút học; tất cả widget và bảng dùng cùng quy tắc đếm.
- [ ] Xuất CSV báo cáo theo đúng bộ lọc, kiểm tra quyền Admin, escape CSV và chống giá trị bị hiểu là công thức; Excel/PDF là mở rộng tùy yêu cầu.
- [ ] Nếu cần lọc thời gian, bổ sung timestamps và lịch sử phù hợp trước; `createdAt` không đủ để suy ra số active trong quá khứ.
- [ ] Dùng aggregate/count/index phù hợp, tránh một truy vấn riêng cho mỗi hàng lớp; giới hạn khối lượng export.
- [ ] Hoàn thiện FE A06, thay summarizeDashboard/sessionStorage bằng API; refresh lấy dữ liệu mới.
- [ ] Test DB rỗng, sinh viên ở nhiều lớp không bị đếm trùng, withdrawn/inactive, bộ lọc và CSV khớp bảng.

API đề xuất: `GET /api/admin/statistics/overview`, `GET /api/admin/reports/classes`, `GET /api/admin/reports/classes/export`.

Nghiệm thu: số liệu đối soát được với DB và thay đổi sau thao tác quản trị thật.

## 9. I07 — Monitor Students

Gradebook và theo dõi tiến độ là phạm vi chính. Chấm/sửa điểm dưới đây là dependency nếu dự án cần nhập điểm thật mà chưa có module chấm bài khác; không bắt buộc gộp toàn bộ nghiệp vụ chấm bài vào I07.

- [x] Submission đã có grade/feedback, Assignment có maxScore; chưa có API giảng viên và chưa có dữ liệu theo dõi tiến độ.
- [ ] Danh sách lớp đang được phân công; mọi truy vấn gradebook/progress/export đều kiểm tra `Class.instructorId === req.user._id` ở server.
- [ ] API roster: sinh viên thuộc lớp, trạng thái ghi danh, tìm kiếm/phân trang; phân biệt người đang học và lịch sử rút học.
- [ ] Gradebook trả cột bài tập, maxScore, điểm từng sinh viên, tình trạng chưa nộp/đã nộp/chưa chấm/đã chấm/quá hạn và feedback theo phạm vi cho phép.
- [ ] Giữ `null` cho chưa chấm, `0` cho đã chấm 0 điểm; không dùng truthiness khi kiểm tra grade.
- [ ] Chốt tổng điểm: giai đoạn đầu đề xuất `sum(grade)/sum(maxScore)` trên các bài đã chấm, kèm số bài đã chấm/tổng bài; chưa gọi đây là điểm cuối kỳ. Nếu cần điểm cuối kỳ, bổ sung trọng số và quy tắc thiếu bài rõ ràng.
- [ ] API chi tiết tiến độ từng sinh viên trong lớp: tổng hoạt động, đã hoàn thành, bài chưa nộp/quá hạn, bài chờ chấm, hoạt động gần nhất.
- [ ] Tạo LearningProgress với studentId, classId, materialId/activityId, completedAt, lastAccessedAt; unique key ngăn ghi nhận trùng.
- [ ] Có API Student ghi nhận hoàn thành hoạt động, kiểm tra enrollment và hoạt động thuộc lớp; server xác định danh tính, không nhận studentId tùy ý. Quy định “đã mở tài liệu” có tính hoàn thành hay không.
- [ ] Đề xuất progress = hoạt động bắt buộc đã hoàn thành / tổng hoạt động bắt buộc đã công bố. Khi mẫu số 0 trả null/“chưa có hoạt động”; giữ tách biệt với tỷ lệ nộp bài và điểm số.
- [ ] Nếu cần chấm điểm: API cập nhật grade/feedback, `0 <= grade <= maxScore`, lưu gradedBy/gradedAt, audit thay đổi và kiểm soát cập nhật đồng thời.
- [ ] Nếu gradebook gồm quiz: cần Quiz/QuizAttempt Backend và cách chọn attempt/chuẩn hóa điểm. Hiện FE quiz gọi API nhưng Backend chưa có route/model tương ứng; có thể triển khai I07 bản đầu chỉ với Assignment rồi mở rộng.
- [ ] Xuất gradebook CSV nếu yêu cầu; chỉ lớp được phân công, cùng bộ lọc và công thức với màn hình.
- [ ] Hoàn thiện FE I07 và route Instructor; trạng thái empty/loading/error, phân biệt chưa chấm với 0 điểm.
- [ ] Test giảng viên khác lớp, hai lớp cùng môn, thay giảng viên, Student giả instructorId, điểm 0/null/vượt max, không có hoạt động, rút học và tái ghi danh.

API đề xuất: `GET /api/instructor/classes`, `GET /api/instructor/classes/:id/students`, `GET /api/instructor/classes/:id/gradebook`, `GET /api/instructor/classes/:id/students/:studentId/progress`, `GET /api/instructor/classes/:id/gradebook/export`. Dependency: `PUT /api/student/classes/:classId/materials/:materialId/progress`; `PATCH /api/instructor/submissions/:id/grade` nếu cần nhập điểm.

Nghiệm thu: giảng viên chỉ xem đúng sinh viên và dữ liệu lớp mình; điểm và tiến độ có nguồn dữ liệu thật, công thức rõ ràng.

## 10. Tích hợp và kiểm thử chung

- [ ] Mount adminRoutes/instructorRoutes và tách controller/service/validation theo module.
- [ ] Thay các preview adapter A02–A05 bằng API; giữ chế độ demo riêng nếu cần, không tự fallback khi API lỗi 401/403/500.
- [ ] Sửa CORS: hiện mọi nhánh đều `callback(null, true)`, chưa hạn chế origin thực tế.
- [ ] Chuẩn hóa 400/401/403/404/409/429/500, không trả chi tiết lỗi nội bộ/stack ra client.
- [ ] Kiểm tra ObjectId, query enum, page/limit, sort allowlist; escape từ khóa nếu dùng regex tìm kiếm.
- [ ] Tạo migration quản lý index: các schema hiện `autoIndex: false, autoCreate: false`; khai báo `.index()` không chứng minh index đã có trong DB.
- [ ] Cân nhắc unique `(assignmentId, studentId)` nếu nghiệp vụ chỉ một submission; index hiện tại không unique, find-then-save có thể tạo trùng khi request đồng thời.
- [ ] Bảo vệ tải file bài nộp: `/uploads` hiện public static, đường dẫn file không có kiểm tra quyền; API tải có auth phải thay thế lối truy cập công khai cho file riêng tư.
- [ ] Bổ sung cấu hình mẫu không chứa secret, seed 3 role, môn/lớp/ghi danh/bài tập/điểm trên DB phát triển và test riêng.
- [ ] Tách test khỏi DB thật: suite Student hiện dùng connectDB chung và có ghi submission, chưa cô lập/cleanup đầy đủ.
- [ ] Sửa điều kiện test chọn bài chưa chấm: `grade === null && grade === undefined` không thể đúng; kiểm tra null hoặc undefined.
- [ ] Viết integration test theo từng module, kiểm tra quyền sở hữu lớp và các tình huống lỗi đã liệt kê; seed cố định và cleanup.
- [ ] Chạy E2E thật: Admin tạo user → môn → lớp → ghi danh/phân công → Student truy cập/nộp bài → Instructor xem gradebook/progress → Admin xem báo cáo.
- [ ] Kiểm tra lại API Student sau migration; không kết luận thành công chỉ vì FE còn hiển thị dữ liệu mock.

Ngoài 7 mục: FE Student còn có quiz, tin nhắn và trang thông báo gọi những route Backend chưa có. Phần này cần công việc riêng nếu mục tiêu là hoàn thiện toàn bộ LMS; chỉ quiz/progress hoặc việc tạo bài tập/nội dung mới là dependency trực tiếp cần phối hợp cho I07. Không mặc định đưa toàn bộ các module đó vào phạm vi của bạn.

## 11. Thứ tự triển khai đề xuất

| Đợt | Nội dung | Điều kiện chuyển bước |
|---|---|---|
| 1 | P0: mô hình Class/Enrollment, phạm vi nội dung, DTO, cơ chế phiên | Có schema, migration plan, contract và quy tắc trạng thái |
| 2 | A01 + A02 | Đăng nhập 3 role thật, logout/reset và quản trị user được bảo vệ |
| 3 | A03 → A04 → A05 | Admin vận hành môn/lớp/ghi danh/phân công thật; API Student tương thích |
| 4 | A06 + tích hợp FE A01–A06 | Báo cáo dựa DB và các luồng Admin không dùng mock |
| 5 | I07 + dữ liệu điểm/tiến độ + FE | Instructor thấy đúng lớp, gradebook/progress đúng công thức |
| 6 | Kiểm thử liên thông và nghiệm thu | DB test cô lập, phân quyền/quan hệ dữ liệu và lỗi API được kiểm chứng |

Chưa thêm bắt buộc các tính năng học kỳ, lịch học, sĩ số tối đa, nhiều giảng viên/lớp hoặc role tùy biến: FE/model hiện chưa thể hiện các yêu cầu này. Có thể mở rộng sau khi hoàn tất phạm vi trên.

## 12. Giới hạn của lần rà soát

Đã đọc mã nguồn BE, model, route, middleware, test hiện có và các adapter/form/router FE liên quan. Không chạy suite integration vì suite hiện kết nối cấu hình DB chung và có ghi dữ liệu; chưa xác minh index/collection/dữ liệu đang triển khai. Lần làm việc này chỉ tạo tài liệu checklist, không sửa logic ứng dụng.
