# F-19 Lập lộ trình mới (ANGI-105)

Từ 2026-11-06, lập lộ trình là **hộp thoại 2 bước** mở trên màn "Lộ trình của tôi" (`/roadmaps`, chỉ `TRAVELER`), không còn trang riêng. `/roadmaps/new` chỉ còn chuyển hướng tới `/roadmaps?new=1`, nơi hộp thoại tự mở, nên link và bookmark cũ vẫn dùng được. Hộp thoại gọi thật RM-01 `POST /api/v1/roadmaps`. Mã nguồn: `src/features/roadmaps/new-roadmap-dialog.tsx` (+ `.css`), luật trong `roadmap-rules.ts` (`validateRoadmapPlace`, `roadmapPlaceSummary`, `validateRoadmapForm`, `buildCreateRoadmapRequest`). Màn demo cũ `src/features/roadmaps/pages.tsx` (`/demo/traveler/roadmaps/*`) không bị sửa.

## Hành vi

### Bước 1: Bạn sẽ ăn ở đâu

Hộp thoại hỏi trước: **"Bạn đã biết chính xác nơi mình sẽ đến chưa?"**

- **Đã biết chính xác**: chọn một trong hai cách, mỗi cách tương ứng một `originMode` của API Design:
  - **Chấm trên bản đồ** (`pinned`): bấm là mở ngay hộp chọn vị trí dùng chung với F-43. Khi lưu điểm, app tra địa chỉ của điểm đó (đúng một lần tra ngược) và tự điền tỉnh / thành phố theo danh mục tỉnh; tên điểm (nếu tìm được) được điền sẵn làm tên điểm xuất phát. Đóng hộp mà chưa chọn điểm thì lựa chọn được bỏ. Tọa độ gửi lên là điểm người dùng chấm, làm tròn 6 chữ số.
  - **Vị trí hiện tại** (`gps`): trình duyệt hỏi quyền vị trí. Chỉ khi được phép thì lựa chọn mới giữ lại; bị từ chối hoặc lỗi thì về chưa chọn và hiện hướng dẫn. Khi có token Mapbox, tọa độ chỉ dùng để tra tỉnh / thành phố; tọa độ **không được gửi và không được lưu** (RM-10 / RM-14 hỏi lại vị trí mỗi lần dùng).
  - Ô **Tỉnh / thành phố**: với **Chấm trên bản đồ** không có ô này, thành phố lấy theo điểm đã chấm và hiện cạnh điểm (`Khách sạn Sala · Đà Nẵng`); ô chỉ hiện khi không tra được thành phố từ điểm (không có token, không khớp danh mục). Với **Vị trí hiện tại** ô hiện bên dưới, tự điền khi tra được và vẫn sửa được. Chưa chọn cách nào thì chỉ báo thiếu vị trí, chưa hỏi thành phố.
- **Chưa biết chính xác**: chỉ cần chọn **tỉnh / thành phố** sẽ đến; gửi `originMode: "none"`.
- Danh sách gợi ý tỉnh / thành phố trong hộp thoại nổi trên nội dung (`position: fixed` theo ô nhập, dùng chung cho mọi `Combobox` trong hộp thoại), không bị cắt bởi vùng cuộn; thiếu chỗ phía dưới thì mở lên trên.
- Nút **Tiếp tục** chỉ sang bước 2 khi đủ: đã trả lời câu hỏi, có tỉnh / thành phố, và nếu "đã biết" thì có điểm đã chấm hoặc vị trí đã được cho phép. Thiếu thì báo lỗi ngay dưới phần thiếu và đưa focus tới đó.

Tỉnh được gửi lên RM-01 thành `destinationProvince` (từ 2026-11-08; với điểm đã chấm hoặc vị trí hiện tại là tỉnh suy ra từ địa chỉ của điểm đó, không suy ra được thì bỏ trống), đồng thời gợi ý tên lộ trình (`Khám phá ẩm thực Đà Nẵng`). FE vẫn nhớ một bản trong trình duyệt (`rememberDestination`) cho lộ trình tạo trước khi backend lưu tỉnh.

### Bước 2: Thời gian và ngân sách

- Đầu bước có dòng tóm tắt nơi đến (ví dụ `Vị trí hiện tại · Đà Nẵng`, `Khách sạn Sala · Đà Nẵng`, hoặc chỉ `Hà Nội`) với nút **Đổi** quay lại bước 1. Nút **Quay lại** cũng vậy; mọi giá trị đã nhập được giữ.
- **Tên điểm xuất phát** (chỉ khi chấm trên bản đồ, không bắt buộc, tối đa 200 ký tự).
- **Ngày bắt đầu** (không bắt buộc) và **số ngày** (số nguyên 1–7, bắt buộc; giới hạn 7 ngày là quy định của ứng dụng, RM-01 ở backend nhận 1–100). Ngày kết thúc chỉ hiển thị, tính theo `startDate + numDays − 1`.
- **Ngân sách** (VND mỗi người, cả chuyến, số nguyên ≥ 0, không bắt buộc): tự định dạng khi gõ thành `1.500.000 VND`, tối đa 14 chữ số (`numeric(14,0)`); chỉ gửi các chữ số (`budgetAmount: 1500000`).
- **Tên lộ trình** (1–200 ký tự): gợi ý theo tỉnh cho tới khi người dùng tự sửa.
- **Tạo lộ trình**: gọi RM-01, hiện toast "Đã tạo lộ trình. Thêm món cho từng bữa nhé." và mở trang chi tiết lộ trình vừa tạo (`/roadmaps/{id}`). Nút giữ trạng thái đang xử lý tới khi trang chi tiết mở, nên không gửi hai lần. Sửa thông tin chung (RM-04) làm ở trang chi tiết.
- **Lỗi** theo `errorCode`: `VALIDATION_FAILED` hiện lỗi dưới từng trường (khóa PascalCase hoặc camelCase); lỗi khác hiện thông báo chung trong hộp thoại. Mọi lỗi đều giữ nguyên dữ liệu đã nhập.

### Lối vào

- Nút **Lập lộ trình mới** trên màn "Lộ trình của tôi" (cả khi chưa có lộ trình nào).
- `roadmapRoutes.plan` = `/roadmaps?new=1`: liên kết "Lập lộ trình mới" ở footer, khối Roadmap của trang chủ, và `/roadmaps/start` (header "Lộ trình" khi Traveler chưa có lộ trình). Đóng hộp thoại thì `?new=1` bị bỏ khỏi URL, nên tải lại trang không mở lại hộp thoại.
- Đóng bằng nút ✕, nút **Hủy**, phím Escape hoặc bấm ra ngoài; không đóng được khi đang tạo.

## Giới hạn hiện tại

- Không có quyền riêng tư và mời bạn đồng hành (Figma frame 07–10), vì RM-01 không có các trường này.
- Đóng hộp thoại giữa chừng thì không hỏi lại; các giá trị đã nhập bị bỏ.

## Kiểm tra (2026-11-06, hộp thoại 2 bước)

| Kiểm tra                                                                               | Kết quả                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm test`                                                                             | `tests/roadmap-plan.test.ts`: thêm test cho `validateRoadmapPlace`, `roadmapPlaceSummary` |
| `tests/browser/roadmap-plan.spec.ts` (viết lại cho hộp thoại) và `my-roadmaps.spec.ts` | Đạt với `ANGI_TEST_DEV=1`; ca chấm bản đồ (`ROADMAP_MAP=1`) vẫn do chủ dự án tự chạy      |
| Giao diện                                                                              | Chụp ở 1280px và 390px: không tràn ngang                                                  |

## Kiểm tra (2026-10-24, trang cũ `/roadmaps/new`)

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
