# F-28 Xóa món khỏi lộ trình (ANGI-149)

Từ trang chi tiết `/roadmaps/{roadmapId}` (F-21), Traveler xóa một món khỏi lộ trình bằng RM-09 `DELETE /api/v1/roadmaps/{roadmapId}/items/{itemId}`. Mã nguồn nằm trong `src/features/roadmaps/`: `roadmap-remove-item-rules.ts`, phần nối vào `roadmap-itinerary.tsx`, `roadmap-detail-view.tsx`, `roadmap-detail-page.tsx` và `roadmap-service.ts` (`deleteItem`). Proxy cho phép thêm thao tác này trong `src/shared/api/roadmap-proxy.ts`.

## Hành vi

- **Lối vào:** mỗi thẻ món có nút chữ "Xóa món" (biểu tượng thùng rác, màu báo lỗi của site) ở cuối thẻ. Tên truy cập: "Xóa {tên món} khỏi lộ trình". Thiết kế Figma `24:1383` không có khung riêng cho thao tác này nên nút dùng lại kiểu nút, thẻ và hộp thoại của trang.
- **Không có bước xác nhận:** theo yêu cầu của chủ dự án, bấm "Xóa món" là gửi RM-09 ngay, không có hộp thoại hỏi lại. Các món khác không bị ảnh hưởng và đánh giá đã gửi cho món vẫn được giữ (tài liệu RM-09: feedback của item được giữ, `roadmap_item_id` thành NULL).
- **Gửi RM-09:** `DELETE` không có body, backend trả `200 OK` với `data = null`. Mỗi lúc chỉ một lần xóa (nút bận, không đóng được trong lúc chờ).
- **Sau khi xóa:** trang đọc lại RM-03 nên thứ tự, chi phí từng ngày, tổng chi và ngân sách đều là số liệu của backend, FE không tự trừ. Nếu món đang được chọn trên bản đồ thì bỏ chọn. Chặng RM-14 của ngày vừa đổi được hỏi lại đúng một lần (khóa cache có danh sách món); ngày không còn đủ điểm thì không gọi.
- **Thông báo trong ngày:** "Đã xóa {món} khỏi lộ trình." hiện ngay dưới thanh nút của ngày đó (vùng `role="status"`), và nhận tiêu điểm vì thẻ vừa giữ tiêu điểm đã biến mất. Thông báo thành công chỉ là xác nhận nên **tự ẩn sau 5 giây**; cảnh báo (đọc lại thất bại, đổi thứ tự không lưu được) không tự ẩn, giữ đến khi người dùng thao tác tiếp. Đọc lại RM-03 thất bại thì thông báo đổi thành cảnh báo "Món đã được xóa nhưng chưa tải lại được lộ trình…".
- **Lỗi theo `errorCode`:** `ROADMAP_ITEM_NOT_FOUND` (404; món không có, đã bị xóa ở nơi khác hoặc không thuộc lộ trình của bạn): xem như món đã biến mất, báo "{món} không còn trong lộ trình…" và đọc lại danh sách. Lỗi khác (mạng, 5xx, 401/403…): món vẫn còn, ngày hiện cảnh báo "Chưa xóa được {món}. {lý do}" (không tự ẩn) và nút "Xóa món" bấm lại được. 401 đi theo luồng đăng nhập lại chung của `api` client.
- **Proxy:** `DELETE roadmaps/{id}/items/{id}` (id là số dương) là thao tác duy nhất được thêm. Vì request DELETE không có body, `route.ts` không đòi JSON cho thao tác này (`roadmapOperationHasBody`), các thao tác ghi khác của lộ trình vẫn đòi JSON. Nếu thiếu bước này, proxy sẽ trả `400 BAD_REQUEST` "Body phải là JSON hợp lệ" trước khi tới backend.

## Giới hạn hiện tại

- **Xóa là xóa hẳn:** backend xóa cứng item (`DeleteRoadmapItemUseCase`), RM-09 không có hoàn tác và FE không hỏi lại trước khi xóa (quyết định của chủ dự án). Hoàn tác (undo/redo) của Figma thuộc task riêng.
- Backend không xếp lại thứ tự các món còn lại (đúng yêu cầu "không ảnh hưởng món khác"); FE chỉ hiện đúng thứ tự RM-03 trả về.
- Chưa có xóa nhiều món cùng lúc. Đổi món (RM-08), sinh bằng AI (RM-10, RM-11) và đánh giá món (RM-13) thuộc các task sau.
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-09 đã có ở backend, nên màn gọi API thật ngay.

## Kiểm tra (2026-10-25)

| Kiểm tra                                                              | Kết quả                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/roadmap-remove-item.test.ts`                                   | 5 test: allowlist proxy chỉ cho `DELETE roadmaps/{id}/items/{id}`, DELETE không đòi body, `deleteItem` gọi đúng đường dẫn và method, lỗi theo `errorCode`, nội dung thông báo                                                                                                                |
| `tests/browser/roadmap-add-item.spec.ts` (bản build cô lập, API stub) | 7 test F-28: bấm là gửi RM-09 ngay (không hộp thoại) và giữ nguyên món khác, bấm đúp chỉ gửi một lần, lỗi báo trong ngày và thử lại được, `ROADMAP_ITEM_NOT_FOUND`, đọc lại thất bại, chặng RM-14 hỏi lại một lần, không tràn ngang 320–1440px (cùng file với F-24 vì dùng chung stub RM-03) |
| Mapbox                                                                | Không có request nào: backend được stub, token rỗng (bản đồ của trang chi tiết tắt)                                                                                                                                                                                                          |
| Backend thật (`test:live`)                                            | Chưa chạy                                                                                                                                                                                                                                                                                    |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-24 15:48, nội dung không đổi giữa hai lần).

- Sheet "Tổng quan": quy ước 200 OK với `data = null` cho RM-09 (r76).
- Sheet "Backend API": RM-09 (r39): `DELETE /api/v1/roadmaps/{roadmapId}/items/{itemId}`, actor TRAVELER, không body, `200 OK / data: null`, lỗi `404 ROADMAP_ITEM_NOT_FOUND`, bảng `roadmap_items`, ghi chú feedback giữ lại.
- Sheet "Chi tiết Request-Response": RM-09 (r150), "JSON mẫu": RM-09 (r1240).

Đối chiếu code backend: `RoadmapsController.DeleteItem` (`[HttpDelete("{roadmapId:long}/items/{itemId:long}")]`, trả `ApiResponse<object>` với `Data = null`, mã 200) và `DeleteRoadmapItemUseCase` (yêu cầu đăng nhập, khóa và lấy item thuộc lộ trình của người dùng, `ROADMAP_ITEM_NOT_FOUND` khi không có, xóa trong transaction). Method, đường dẫn, tham số, mã trạng thái và mã lỗi đều khớp.
