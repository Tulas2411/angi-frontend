# Tạo nhanh roadmap trên homepage

Cập nhật ngày 28/10/2026 trên nhánh `feat/homepage-roadmap-starter`. Mở `http://localhost:3000/` để xem. Các thay đổi được giữ ở trạng thái chưa stage/commit.

## Giao diện và thao tác

Phần đầu trang gồm ảnh món ăn và khung nhập nổi với đúng ba trường: tỉnh/thành phố, ngày bắt đầu, số ngày. Banner “Ăn đúng gu. Đi thật đã.” được chuyển xuống ngay bên dưới. Giữ màu kem, trắng, đen và coral, font Fraunces/Be Vietnam Pro hiện tại; các trường xếp lại trên màn hình nhỏ.

- Tỉnh/thành phố dùng `ProvinceField` và proxy Provinces Open API V2 hiện có. Có thể nhập tay nếu nguồn gợi ý tạm lỗi.
- Cả ba trường bắt buộc. Ngày phải hợp lệ; số ngày là số nguyên 1–7 theo giới hạn hiện tại của trình lập roadmap. Giới hạn này hẹp hơn API RM-01 (1–30), không phải giới hạn mới của backend.
- Khách chưa đăng nhập: bấm tạo để giữ ba giá trị trong `sessionStorage` và mở đăng nhập. Sau khi đăng nhập bằng tài khoản Traveler, homepage khôi phục dữ liệu; người dùng bấm tạo lần nữa. Không tự gửi yêu cầu tạo sau đăng nhập.
- Traveler đã đăng nhập: gửi tạo qua service hiện có, chỉ chuyển đến `/roadmaps/{id}` sau khi backend xác nhận thành công. Khóa gửi trùng trong khi xử lý/chuyển trang; giữ giá trị và cho thử lại khi API lỗi. Lỗi trường `StartDate`/`NumDays` được gắn về đúng ô nhập.
- MOD/ADMIN không được gửi form Traveler; Owner vẫn được chuyển về `/restaurant` theo chính sách hiện có.

## Kết nối backend và phạm vi

Form gọi RM-01 `POST /api/v1/roadmaps` qua API client/BFF hiện có, không thêm endpoint hoặc biến môi trường. Tên roadmap được tạo từ tỉnh/thành và số ngày bằng helper của trình lập roadmap.

Ví dụ body hợp lệ:

```json
{
  "title": "3 ngày ăn ngon Đà Nẵng",
  "startDate": "2026-11-06",
  "numDays": 3,
  "originMode": "none"
}
```

RM-01 không có trường tỉnh/thành và không lưu điểm đến. FE ghi nhớ tỉnh/thành theo ID bằng `rememberDestination` hiện có trong localStorage; đây không phải dữ liệu điểm đến được backend lưu, nên không đồng bộ sang thiết bị khác. Không gửi thêm province, ngân sách hoặc tọa độ ngoài hợp đồng.

RM-01 tạo các ngày rỗng. Người dùng tiếp tục chọn món/tạo lịch trong trang chi tiết; form này không tự gọi RM-10, RM-14, Agent hoặc Mapbox. Các ví dụ khẩu vị, lịch trình và bộ sưu tập cảm hứng phía dưới vẫn là nội dung minh họa, không được thay bằng kết quả AI giả.

## Kiểm tra và đối chiếu cuối task

- ESLint cho các file thay đổi và TypeScript `--noEmit`: đạt.
- Vitest `tests/home-roadmap.test.ts`: đạt **6 kiểm thử**, bao gồm validation, wire body, khôi phục/làm sạch bản nháp và storage bị chặn.
- Build production cách ly: đạt. Playwright trên bản production: **27/27 kiểm thử** trong `home-roadmap.spec.ts` và `public-home.spec.ts`, gồm guest → login → tạo, tài khoản sai role, lỗi API, chống gửi trùng, nguồn tỉnh lỗi và các tương tác homepage cũ.
- Không tràn ngang tại 1440, 1024, 768, 390, 320px; đã xem ảnh desktop 1440px và mobile 320px. Kiểm thử keyboard/modal cũ tiếp tục đạt.
- Browser dùng backend stub local và chặn yêu cầu bên ngoài; không chạy kiểm thử với BE thật, không tiêu thụ Mapbox. Kết quả trên xác nhận UI/BFF và payload, chưa xác nhận kết nối tới môi trường BE đang chạy của người dùng.

Sau code và các kiểm tra, đã xuất lại bản workbook từ backend `origin/dev` commit `951115cbf2c758d47c9c74f2c37deb6d61b7ffc7`: `.docs/ANGI_API_Design_Ver1.8.xlsx`. SHA-256 `EF1E765849999D771A910152EEAAB9B8BFD2BC8D356F3B450059B6877605F21C`, không đổi so với lần đọc trước khi code. Chỉ có một file API Design trong `.docs` của ref này.

Đã mở lại `Backend API` dòng 31; `Chi tiết Request-Response` dòng 111–119; `DTO` vùng 178–223 (RoadmapSummary/Item/Day/Detail); `JSON mẫu` dòng 762–864; `Mã lỗi` dòng 10 (`400 VALIDATION_FAILED`, lỗi chi tiết theo trường). Form khớp method/path, role Traveler, body với `originMode=none`, response `201 RoadmapDetail` và xử lý lỗi của RM-01. Backend không bị chỉnh sửa.
