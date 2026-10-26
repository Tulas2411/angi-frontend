# F-19 Lập lộ trình mới (ANGI-105)

Màn `/roadmaps/new` (chỉ `TRAVELER`) gọi thật RM-01 `POST /api/v1/roadmaps` để tạo lộ trình và RM-04 `PATCH /api/v1/roadmaps/{roadmapId}` để sửa thông tin chung. Mã nguồn nằm trong `src/features/roadmaps/` (`plan-roadmap-page.tsx`, `roadmap-overview-form.tsx`, `roadmap-rules.ts`, `roadmap-service.ts`, `roadmap-types.ts`). Màn demo cũ `src/features/roadmaps/pages.tsx` (`/demo/traveler/roadmaps/*`) không bị sửa.

## Hành vi

- **Điểm đến** (tỉnh / thành, bắt buộc trên form): RM-01 không lưu điểm đến, nên tỉnh chỉ dùng để gợi ý tên lộ trình (`3 ngày ăn ngon Đà Nẵng`) cho tới khi người dùng tự sửa tên. Khi sinh món (RM-10) hoặc gợi ý món (RM-06), app phải gửi lại tỉnh.
- **Điểm xuất phát**: hai nút, mỗi nút tương ứng một `originMode` của API Design:
  - **Chấm trên bản đồ** (`pinned`): bấm là mở ngay hộp chọn vị trí dùng chung với F-43. Gửi `originLatitude` / `originLongitude` (làm tròn 6 chữ số) và `originLabel` (không bắt buộc, tối đa 200 ký tự). Khi bấm lưu điểm, form tra địa chỉ của điểm đó (đúng một lần tra ngược, như form đăng ký nhà hàng F-43) và tự điền ô **tỉnh / thành phố** theo danh mục tỉnh; giá trị đã nhập trước đó bị thay và gợi ý tên lộ trình được cập nhật. Không tra được hoặc không khớp danh mục thì giữ nguyên ô tỉnh và báo người dùng tự chọn. Tọa độ gửi lên vẫn là điểm người dùng chấm, không đổi theo địa chỉ. Đóng hộp mà chưa chọn điểm thì lựa chọn được bỏ.
  - **Vị trí hiện tại** (`gps`): bấm là trình duyệt hỏi người dùng có cho ANGI dùng vị trí không. Chỉ khi được phép thì lựa chọn mới giữ lại; bị từ chối hoặc lỗi thì trả về chưa chọn và hiện hướng dẫn. Tọa độ không được gửi và không được lưu; RM-10 / RM-14 sau này sẽ hỏi lại vị trí mỗi lần dùng.
  - Không chọn nút nào (hoặc bấm "Bỏ điểm xuất phát") thì gửi `originMode: "none"`, chỉ cần tỉnh.
- **Ngày bắt đầu** (không bắt buộc) và **số ngày** (số nguyên 1–7, bắt buộc; giới hạn 7 ngày là quy định của ứng dụng, RM-01 ở backend vẫn nhận 1–30). Ngày kết thúc chỉ hiển thị, tính theo `startDate + numDays − 1`. Figma có chọn ngày kết thúc, nhưng hợp đồng nhận `numDays`.
- **Ngân sách** (VND mỗi người, cả chuyến, số nguyên ≥ 0, không bắt buộc): ô nhập tự định dạng khi gõ thành `1.500.000 VND` (dấu chấm phân cách hàng nghìn, đơn vị luôn ở cuối), tối đa 14 chữ số theo cột `numeric(14,0)` của Data Dictionary. Form chỉ giữ và gửi các chữ số (`budgetAmount: 1500000`); chữ cái, ký tự lạ bị bỏ, Backspace xóa được số dù con trỏ đứng cạnh dấu chấm hoặc `VND`. Thẻ kết quả cũng hiển thị dạng `1.500.000 VND / người`. và **tên lộ trình** (1–200 ký tự).
- Sau khi tạo: thẻ tóm tắt lấy từ `RoadmapDetail` trả về (`overview`, số ngày theo `itinerary`), kèm nút **Sửa thông tin** và **Lập lộ trình khác**.
- **Sửa thông tin** (RM-04): chỉ gửi các trường đã đổi; trường tùy chọn bị xóa được gửi `null`. Khi rời `pinned`, app chỉ gửi `originMode`, backend tự xóa tọa độ và tên điểm. Nút lưu bị khóa khi chưa có thay đổi. Bấm hủy khi còn thay đổi thì mở `ConfirmDialog`.
- **Lỗi** xử lý theo `errorCode`:
  - `VALIDATION_FAILED`: hiện lỗi dưới từng trường (khóa PascalCase hoặc camelCase đều được).
  - `DAY_NOT_EMPTY`: báo cần xóa món ở những ngày bị cắt.
  - `ROADMAP_NOT_FOUND`: báo không tìm thấy lộ trình.
  - Mọi lỗi đều giữ nguyên dữ liệu đã nhập.
- Lối vào:
  - liên kết "Lập lộ trình" trên thanh điều hướng của Traveler;
  - mục "Lập lộ trình mới" trong menu tài khoản;
  - liên kết "Lập lộ trình của bạn" trong khối Roadmap của trang chủ.

## Giới hạn hiện tại

- Tải lại trang thì không mở lại lộ trình vừa tạo, vì màn chi tiết (F-21, RM-03) chưa làm.
- Không có quyền riêng tư và mời bạn đồng hành (Figma frame 07–10), vì RM-01 không có các trường này.

## Kiểm tra (2026-10-24)

| Kiểm tra                                                                 | Kết quả                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run lint`                                                           | 0 lỗi (1 cảnh báo có sẵn ở `restaurant-reviews-page.tsx`)      |
| `npm test`                                                               | 21 file, 136 test đạt (`tests/roadmap-plan.test.ts`: 12 test)  |
| `npx tsc --noEmit`, `npm run build`                                      | Đạt; route `ƒ /roadmaps/new`                                   |
| `npm run test:browser` (bản build production cô lập, API stub cổng 5164) | 52 đạt, 1 bỏ qua                                               |
| `roadmap-plan.spec.ts` với hộp bản đồ (`ROADMAP_MAP=1`)                  | **Chưa chạy**: chủ dự án tự kiểm tra phần bản đồ               |
| Mapbox                                                                   | Không có request nào: token rỗng, mọi URL `mapbox.com` bị chặn |
| Backend thật (`test:live`)                                               | Chưa chạy                                                      |

Kiểm tra giao diện ở 1440px và 390px: bố cục hai cột theo Figma "Plan new trip", dồn thành một cột dưới 960px, không tràn ngang ở 320–1440px.

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-24 15:48, không đổi trong suốt task; bản trích lại giống hệt bản lúc bắt đầu).

- Sheet "Backend API": dòng r31 (RM-01), r34 (RM-04).
- Sheet "Chi tiết Request-Response": r111–r134.
- Sheet "JSON mẫu": RM-01 r763–r865, RM-04 r989–r998.
- Sheet "DTO": RoadmapSummary, RoadmapItem, RoadmapDay, RoadmapDetail (r178–r224).
- Sheet "Mã lỗi": r10, r30, r44.
- Sheet "Enum": r27 `roadmaps.originMode`.

Cũng đối chiếu với code backend: `RoadmapsController`, `CreateRoadmapRequestDto` / `UpdateRoadmapRequestDto` cùng validator của chúng, và `UpdateRoadmapUseCase` (cách xử lý origin khi đổi mode, `DAY_NOT_EMPTY`). Method, đường dẫn, mã trạng thái (201 / 200), tên trường, kiểu nullable, giá trị enum, giới hạn và mã lỗi đều khớp.
