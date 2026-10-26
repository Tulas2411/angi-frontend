# F-25 Thêm món và quán vào đúng ngày, đúng vị trí (ANGI-125)

Use case F-25 "Add Dish and Place": Traveler duyệt danh sách món ANGI gợi ý kèm quán, chọn một món, hệ thống kiểm tra rồi thêm vào **ngày hoặc vị trí tương ứng** của lộ trình. Endpoint giống F-24: RM-06 `GET /api/v1/roadmaps/{roadmapId}/suggestions` và RM-07 `POST /api/v1/roadmaps/{roadmapId}/days/{dayId}/items`.

F-24 (ANGI-130, `docs/roadmap-add-item.vi.md`) đã làm hộp thoại duyệt gợi ý và thêm món vào cuối một bữa của một ngày. F-25 bổ sung phần còn thiếu của use case: **chọn ngày**, **chọn vị trí trong bữa** và **xem quán trên bản đồ**. Mã nguồn nằm trong `src/features/roadmaps/`: `roadmap-add-item-dialog.tsx`, `roadmap-insert-rules.ts` (mới), `roadmap-add-item-rules.ts`, `roadmap-add-item.css` và phần nối ở `roadmap-itinerary.tsx`. Việc dời các món cũ dùng RM-08 `PATCH roadmaps/{id}/items/{itemId}` đã có từ F-27 (không thêm đường dẫn proxy mới).

## Hành vi

- **Nhóm ô "Thêm món đã chọn vào":** ba ô chọn là **Ngày** (mọi ngày của lộ trình, mặc định ngày của nút đã bấm), **Bữa** (sáng, trưa, tối, ăn vặt, ăn khuya, mặc định bữa của nút đã bấm) và **Vị trí**. Cả ba chỉ quyết định món được thêm vào đâu, không lọc danh sách và không gọi lại RM-06 (backend không dùng `dayId` của RM-06). Tên hộp thoại là "Thêm món vào lộ trình".
- **Vị trí:** các lựa chọn của bữa đã chọn trong ngày đã chọn, theo thứ tự trên trang: "Đầu bữa", "Sau {món}" cho từng món trừ món cuối, "Cuối bữa" (mặc định). Bữa chưa có món chỉ có "Cuối bữa". Đổi ngày hoặc bữa thì vị trí về "Cuối bữa". Sau khi thêm một món vào một vị trí, món kế tiếp mặc định đứng ngay sau món vừa thêm.
- **Cách gửi (đúng hành vi backend):** RM-07 gán cho món mới đúng `sortOrder` được gửi ("Thứ tự trong bữa; bỏ trống = cuối danh sách") và không dồn các món còn lại; RM-03 sắp theo bữa, `sortOrder`, rồi id. Vì vậy:
  - "Cuối bữa": không dời gì, **không gửi `sortOrder`**.
  - Vị trí khác: các món từ vị trí đó trở xuống được dời xuống một bậc bằng RM-08 (`{ sortOrder }`, món ở xa nhất dời trước), sau đó RM-07 gửi `{ dishId, mealSlot, sortOrder, recoRequestId }` với `sortOrder` bằng vị trí đã chọn. Cách này cũng gỡ các món trùng `sortOrder` do lần tạo trước để lại.
  - Một lần dời lỗi thì dừng, **chưa thêm món nào**, hiện thông báo ngay ở dòng món đó (các món đã dời vẫn giữ nguyên thứ tự tương đối) và đọc lại lộ trình để các lựa chọn vị trí đúng với dữ liệu thật. `ROADMAP_ITEM_NOT_FOUND` khi dời (một món của bữa vừa bị xóa): "Một món trong bữa này vừa bị xóa nên chưa xếp được vị trí…".
- **Quán:** mỗi món gợi ý có thêm liên kết "Xem quán trên Google Maps" mở tab mới theo tọa độ của quán (`https://www.google.com/maps/search/?api=1&query={lat},{lng}`); không có tọa độ thì không có liên kết. Dùng liên kết thường, không gọi Mapbox.
- **Sau khi thêm:** như F-24 (đọc lại RM-03, chặng RM-14 của ngày đổi được hỏi lại đúng một lần); thông báo cho trình đọc màn hình nay có cả ngày: "Đã thêm {món} vào {bữa} của {ngày}."

## Giới hạn hiện tại

- Chưa gửi IMP-01 (impressions), chưa lộ `tagIds` / `excludeTagIds` / `radiusKm` của RM-06 (như F-24).
- Mỗi lần thêm có thể tốn nhiều lần gọi (RM-08 cho từng món phải dời, rồi RM-07), vì backend không có thao tác chèn một lần; chèn ở đầu bữa nhiều món thì số lần gọi bằng số món của bữa đó cộng một.
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-06 / RM-07 / RM-08 đã có ở backend, nên màn gọi API thật ngay.

## Kiểm tra (2026-10-26)

| Kiểm tra                                                | Kết quả                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/roadmap-insert.test.ts`                          | 8 test: các lựa chọn vị trí, vị trí không còn thì về cuối, kế hoạch dời (cuối bữa không dời, đầu bữa, sau một món, món trùng `sortOrder`), body RM-07 có hoặc không có `sortOrder`, lỗi `ROADMAP_ITEM_NOT_FOUND`, liên kết bản đồ                           |
| `tests/browser/roadmap-add-position.spec.ts` (API stub) | 6 test: ba ô chọn và các vị trí của từng bữa, mặc định cuối bữa (không `sortOrder`, không RM-08), vị trí chọn sẵn (RM-08 rồi RM-07 đúng thứ tự, món kế tiếp đứng sau), đầu bữa và ngày khác, lỗi khi dời, liên kết Google Maps, không tràn ngang 320–1440px |
| `tests/browser/roadmap-add-item.spec.ts` (F-24)         | Cập nhật tên hộp thoại và nhãn ô "Bữa"; các test cũ vẫn đạt                                                                                                                                                                                                 |
| Mapbox                                                  | Không có request nào: backend được stub, token rỗng (bản đồ của trang chi tiết tắt)                                                                                                                                                                         |
| Backend thật (`test:live`)                              | Chưa chạy                                                                                                                                                                                                                                                   |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-26 18:28, nội dung không đổi giữa hai lần).

- Sheet "Backend API": RM-06 (r36, "Dùng cho cả Add Roadmap Item Manually và Edit Roadmap Item", loại các món đã có trong roadmap), RM-07 (r37), RM-08 (r38).
- Sheet "Chi tiết Request-Response": RM-06 (r136–r138), RM-07 (r139–r143: `sortOrder` smallint, "Thứ tự trong bữa; bỏ trống = cuối danh sách"), RM-08 (r144–r149: `sortOrder` "Thứ tự mới").
- Sheet "UC ↔ API": dòng "Add Dish and Place → RM-06, RM-07" (r21).
- Sheet "JSON mẫu": RM-06, RM-07, RM-08. Sheet "DTO": DishCard, RestaurantMini (tọa độ có thể null), RoadmapItem. Sheet "Mã lỗi": `*_NOT_FOUND`, `DISH_NOT_AVAILABLE`, `VALIDATION_FAILED`.

Đối chiếu code backend: `AddRoadmapItemUseCase` (`SortOrder = request.SortOrder ?? NextSortOrder(day, mealSlot)`, không dồn các món khác), `UpdateRoadmapItemUseCase` (RM-08 không có `dishId` thì sửa tại chỗ đúng item đó, `ROADMAP_ITEM_NOT_FOUND` khi không có), `RoadmapMapper.MapDay` (sắp theo bữa, `SortOrder`, id) và `GetRoadmapSuggestionsUseCase` (không đọc `dayId`). Method, đường dẫn, tên và kiểu trường, enum, mã trạng thái và mã lỗi đều khớp.
