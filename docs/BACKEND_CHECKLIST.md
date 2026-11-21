# Checklist Backend — UniversityLMS

Ngày rà soát: 21/11/2026. Phạm vi: A01–A06 và I07 theo yêu cầu.

**Cập nhật triển khai A01:** đã có login thật, cookie HttpOnly/session MongoDB, logout, reset qua Admin, đổi mật khẩu bắt buộc, RBAC/route guard và bộ test cô lập. Xem [A01_AUTHENTICATION.md](A01_AUTHENTICATION.md) và [schema bổ sung](auth-schema.extension.json). Cần chạy migration trên DB triển khai. Mục A01 và các ghi chú tích hợp đã cập nhật theo triển khai mới; các mục học vụ còn lại vẫn là việc cần làm.

Đánh giá dựa trên mã nguồn trong repository, chưa xác nhận hoạt động với MongoDB thật. `[x]` chỉ đánh dấu thành phần đã thấy trong code; không đồng nghĩa đã nghiệm thu. Các API ghi “đề xuất” chưa tồn tại. A01 đã tích hợp API thật; FE Admin A02–A05 vẫn có các màn hình/adapter preview cần tích hợp API. A06 hiện có bảng thống kê preview; chưa thấy trang hoặc route I07 trong cây mã đang rà soát. Checklist tập trung vào 7 mục được phân công, kèm các điểm tích hợp cần thiết để nghiệm thu.

## 1. Kết quả rà soát

| Mục | Đã có ở Backend | Còn thiếu |
|---|---|---|
| A01 Authentication | Login, cookie/session, logout, reset qua Admin, đổi mật khẩu, RBAC, rate limit và route guard | Áp dụng migration và smoke-test trên DB triển khai |
| A02 User Management | Model User, enum 3 role, khai báo index email unique | Toàn bộ API quản trị tài khoản/role/trạng thái/xóa |
| A03 Course Management | Model Course, API đọc cho Student | CRUD và trạng thái cho Admin, kiểm tra quan hệ trước khi xóa |
| A04 Class Management | Chưa có model Class | Model, API, validation, quan hệ với môn/giảng viên/ghi danh |
| A05 Enrollment | Model Enrollment theo `courseId + studentId`, helper kiểm tra ghi danh | Ghi danh theo lớp, hủy ghi danh, phân công/gỡ giảng viên, API quản trị |
| A06 Statistics & Reports | Chưa có API Admin | Tổng hợp DB, bộ lọc, báo cáo/xuất dữ liệu; FE mới có preview |
| I07 Monitor Students | Assignment/Submission có điểm và feedback; Quiz/QuizAttempt có kết quả làm bài và API Student | Phạm vi lớp được dạy, gradebook, dữ liệu tiến độ, API tổng hợp; chưa có route FE Instructor |

Các nguồn đối chiếu chính:

- `backend/src/server.js`: mount `/api/auth`, `/api/student`, `/api/admin` (recovery) và bảo vệ namespace `/api/instructor`.
- `backend/src/routes/authRoutes.js`, `controllers/authController.js`, `middlewares/authMiddleware.js`: login, me, Bearer JWT, role.
- `backend/src/models/`: User, Course, Enrollment, Assignment, Submission, LearningMaterial, Quiz, QuizAttempt, Message, Announcement, AnnouncementRead; chưa có Class và LearningProgress.
- `frontend/src/features/admin/{users,courses,classes,enrollments}/*Preview.js`: nghiệp vụ mẫu, lưu qua sessionStorage.
- `frontend/src/services/http.js`: contract cookie, `_id/fullName` và role canonical theo schema; auth.js cũ cũng đã đồng bộ contract.
- `frontend/src/app/AuthContext.jsx`: phiên thật qua `/me`, login/logout API, không lưu token vào browser storage.
- `frontend/src/app/Router.jsx`: A01 dùng AuthenticationPage, route guard theo role; Instructor có trang vào nhưng chưa có I07.
- `frontend/src/services/api.js`: đã bỏ fallback mock; lỗi API được trả về cho UI và AuthContext xử lý.
- `frontend/src/features/auth/AuthenticationPage.jsx`: yêu cầu khôi phục thật gửi Admin; không dùng email link. ForgotPasswordDialog cũ không nằm trong router hiện tại.
- `frontend/src/features/admin/AdminDashboard.jsx`: thống kê preview, refresh không gọi dữ liệu thật.

## 2. P0 — Chốt mô hình và hợp đồng trước khi viết CRUD

- [ ] Tạo Class với `classCode`, `courseId`, `instructorId` nullable, `isActive`, timestamps. FE hiện thể hiện một giảng viên cho mỗi lớp; chưa cần bảng phân công nhiều giảng viên.
- [ ] Chuyển Enrollment sang tham chiếu `classId + studentId`; tạo unique index cho cặp này. `courseId` nếu giữ để tối ưu phải được suy ra từ Class và đồng bộ ở server.
- [ ] Viết migration có dry-run, thống kê trước/sau và phương án rollback cho Enrollment cũ. Khi một môn có nhiều lớp, không tự đoán lớp cho dữ liệu cũ; dùng bảng ánh xạ được kiểm tra.
- [ ] Chốt phạm vi Assignment/Quiz/Material/Announcement: tài liệu có thể dùng chung theo môn, nhưng bài tập/quiz/điểm cần phân biệt lớp hoặc có bảng phân phối nội dung cho lớp. Submission/QuizAttempt phải truy ngược được lớp tương ứng; không để giảng viên một lớp xem điểm lớp khác cùng môn.
- [ ] Sửa helper `isStudentEnrolled`, `getEnrolledCourseIds` và API Student theo mô hình mới; lấy danh sách môn distinct để không nhân bản môn khi sinh viên học nhiều lớp.
- [ ] Chốt quy tắc inactive: chặn ghi danh/phân công mới vào lớp hoặc môn inactive; xác định quyền đọc lịch sử và quyền nộp bài khi ngừng hoạt động.
- [ ] Thống nhất DTO bằng serializer/adapter theo bảng dưới; không dùng mã hiển thị làm khóa liên kết.
- [x] A01 thống nhất cookie HttpOnly + AuthSession và chống CSRF; API học vụ sử dụng chung client.
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
| Phiên | Cookie HttpOnly qua client A01 | JWT tham chiếu AuthSession | Đã thống nhất; không lưu JWT ở FE |

## 3. A01 — Authentication (đã triển khai)

- [x] Login bcrypt/JWT, `/me`, user/role theo schema; bỏ JWT secret mặc định và validate cấu hình.
- [x] Phiên MongoDB 8 giờ, cookie HttpOnly/SameSite, Secure trong production; logout vô hiệu hóa phiên hiện tại.
- [x] Rate limit login/recovery bằng MongoDB; kiểm tra Origin và header mutation, CORS allowlist.
- [x] Gửi yêu cầu recovery thật; Admin tìm/lọc/phân trang, xem và xử lý yêu cầu cho đủ 3 role.
- [x] Admin xác minh danh tính, đặt mật khẩu tạm/từ chối; transaction, chống xử lý trùng và audit người/thời điểm xử lý.
- [x] Reset thu hồi tất cả phiên; `mustChangePassword` và API đổi mật khẩu; chặn truy cập học vụ trước khi đổi.
- [x] Guard các route và namespace API theo role; đọc lại user DB ở mỗi request.
- [x] Form A01 tiếng Việt theo design.md, login theo role, reload xác minh phiên, logout thật; bỏ mock fallback API Student.
- [x] Migration thêm collection/index, schema extension và hướng dẫn cấu hình/chạy/kiểm thử.
- [ ] Áp dụng `npm run migrate:auth` trên DB triển khai và smoke-test bằng tài khoản thật của nhóm.

API thực tế và chi tiết nghiệm thu: [A01_AUTHENTICATION.md](A01_AUTHENTICATION.md). Các bộ test mới dùng DB tạm, không dùng Atlas của dự án.

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
- [ ] Không xóa môn còn lớp. Kiểm tra cả Enrollment/Assignment/Quiz/LearningMaterial/Announcement cũ đang tham chiếu môn, tránh orphan trước khi migration hoàn tất.
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
- [ ] Ghi danh: lớp/môn tồn tại và active, user role Student và active, chưa ghi danh lớp đó. Điều kiện môn active là đề xuất cần đồng bộ thêm với FE: enrollmentPreview hiện mới kiểm tra trạng thái lớp và user.
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

- [x] Submission đã có grade/feedback, Assignment có maxScore; QuizAttempt có result/startedAt/submittedAt và API Student làm bài/xem kết quả. Chưa có API giảng viên và model lưu tiến độ học tài liệu.
- [ ] Danh sách lớp đang được phân công; mọi truy vấn gradebook/progress/export đều kiểm tra `Class.instructorId === req.user._id` ở server.
- [ ] API roster: sinh viên thuộc lớp, trạng thái ghi danh, tìm kiếm/phân trang; phân biệt người đang học và lịch sử rút học.
- [ ] Gradebook trả cột bài tập, maxScore, điểm từng sinh viên, tình trạng chưa nộp/đã nộp/chưa chấm/đã chấm/quá hạn và feedback theo phạm vi cho phép.
- [ ] Giữ `null` cho chưa chấm, `0` cho đã chấm 0 điểm; không dùng truthiness khi kiểm tra grade.
- [ ] Chốt tổng điểm: giai đoạn đầu đề xuất `sum(grade)/sum(maxScore)` trên các bài đã chấm, kèm số bài đã chấm/tổng bài; mẫu số 0 trả null. Chưa gọi đây là điểm cuối kỳ. Nếu cần điểm cuối kỳ, bổ sung trọng số và quy tắc thiếu bài rõ ràng.
- [ ] API chi tiết tiến độ từng sinh viên trong lớp: tổng hoạt động, đã hoàn thành, bài chưa nộp/quá hạn, bài chờ chấm, hoạt động gần nhất.
- [ ] Tạo LearningProgress với studentId, classId, materialId/activityId, completedAt, lastAccessedAt; unique key ngăn ghi nhận trùng.
- [ ] Có API Student ghi nhận hoàn thành hoạt động, kiểm tra enrollment và hoạt động thuộc lớp; server xác định danh tính, không nhận studentId tùy ý. Quy định “đã mở tài liệu” có tính hoàn thành hay không.
- [ ] Đề xuất progress = hoạt động bắt buộc đã hoàn thành / tổng hoạt động bắt buộc đã công bố. Khi mẫu số 0 trả null/“chưa có hoạt động”; giữ tách biệt với tỷ lệ nộp bài và điểm số.
- [ ] Nếu cần chấm điểm: API cập nhật grade/feedback, `0 <= grade <= maxScore`, lưu gradedBy/gradedAt, audit thay đổi và kiểm soát cập nhật đồng thời.
- [ ] Nếu gradebook gồm quiz: tái sử dụng Quiz/QuizAttempt và quizController hiện có; chỉ lấy attempt đã nộp, chốt cách chọn attempt khi có nhiều bản ghi và cách chuẩn hóa điểm. Đối chiếu Quiz.maxScore với tổng questions.points để gradebook và trang kết quả dùng cùng mẫu số; bổ sung phạm vi lớp trước khi tổng hợp.
- [ ] Xuất gradebook CSV nếu yêu cầu; chỉ lớp được phân công, cùng bộ lọc và công thức với màn hình.
- [ ] Hoàn thiện FE I07 và route Instructor; trạng thái empty/loading/error, phân biệt chưa chấm với 0 điểm.
- [ ] Test giảng viên khác lớp, hai lớp cùng môn, thay giảng viên, Student giả instructorId, điểm 0/null/vượt max, không có hoạt động, rút học và tái ghi danh.

API đề xuất: `GET /api/instructor/classes`, `GET /api/instructor/classes/:id/students`, `GET /api/instructor/classes/:id/gradebook`, `GET /api/instructor/classes/:id/students/:studentId/progress`, `GET /api/instructor/classes/:id/gradebook/export`. Dependency: `PUT /api/student/classes/:classId/materials/:materialId/progress`; `PATCH /api/instructor/submissions/:id/grade` nếu cần nhập điểm.

Nghiệm thu: giảng viên chỉ xem đúng sinh viên và dữ liệu lớp mình; điểm và tiến độ có nguồn dữ liệu thật, công thức rõ ràng.

## 10. Tích hợp và kiểm thử chung

- [ ] Mount adminRoutes/instructorRoutes và tách controller/service/validation theo module.
- [ ] Thay các preview adapter A02–A05 bằng API; giữ chế độ demo riêng nếu cần, không tự fallback khi API lỗi 401/403/500.
- [x] A01 sửa CORS allowlist và kiểm tra Origin/header cho mutation.
- [ ] Chuẩn hóa 400/401/403/404/409/429/500, không trả chi tiết lỗi nội bộ/stack ra client.
- [ ] Kiểm tra ObjectId, query enum, page/limit, sort allowlist; escape từ khóa nếu dùng regex tìm kiếm.
- [ ] Tạo migration quản lý index: các schema hiện `autoIndex: false, autoCreate: false`; khai báo `.index()` không chứng minh index đã có trong DB.
- [ ] Cân nhắc unique `(assignmentId, studentId)` nếu nghiệp vụ chỉ một submission; index hiện tại không unique, find-then-save có thể tạo trùng khi request đồng thời.
- [ ] Bảo vệ tải file bài nộp: `/uploads` hiện public static, đường dẫn file không có kiểm tra quyền; API tải có auth phải thay thế lối truy cập công khai cho file riêng tư.
- [ ] Bổ sung cấu hình mẫu không chứa secret, seed 3 role, môn/lớp/ghi danh/bài tập/điểm trên DB phát triển và test riêng.
- [x] Test BE A01 và Student dùng MongoMemoryReplSet và seed độc lập; không dùng DB trong .env.
- [x] Cleanup suite Student chỉ chạy trên DB tạm của lần kiểm thử; MongoMemoryReplSet được dừng sau test.
- [ ] Viết integration test theo từng module, kiểm tra quyền sở hữu lớp và các tình huống lỗi đã liệt kê; seed cố định và cleanup.
- [ ] Chạy E2E thật: Admin tạo user → môn → lớp → ghi danh/phân công → Student truy cập/nộp bài → Instructor xem gradebook/progress → Admin xem báo cáo.
- [ ] Kiểm tra lại API Student sau migration; không kết luận thành công chỉ vì FE còn hiển thị dữ liệu mock.

Ngoài 7 mục: Backend đã có route/controller/model Student cho quiz, tin nhắn và thông báo; không cần ghi lại thành các module chưa triển khai. Cần kiểm thử hồi quy các API này khi đổi Enrollment sang theo lớp. Việc tạo nội dung, tạo bài tập/quiz và chấm bài thuộc module phụ trách tương ứng; I07 cần thống nhất dữ liệu đầu vào với các module đó, không mặc định bao gồm toàn bộ nghiệp vụ Instructor.

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

## 12. Giới hạn và kết quả kiểm chứng

Rà soát ban đầu dựa trên mã nguồn. Sau đó A01 đã được triển khai, README và schema extension đã cập nhật; kiểm thử BE A01/Student chạy trên MongoDB tạm, E2E chạy với API thật trên localhost. Chưa xác minh dữ liệu/index đang triển khai và chưa áp dụng migration A01 lên Atlas. Những mục A02–A06/I07 chưa đánh dấu vẫn cần thực hiện riêng.
