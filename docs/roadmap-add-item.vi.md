# F-24 Thêm món vào lộ trình thủ công (ANGI-130)

Từ trang chi tiết `/roadmaps/{roadmapId}` (F-21), Traveler mở hộp thoại "Thêm món", xem danh sách món ANGI gợi ý (RM-06 `GET /api/v1/roadmaps/{roadmapId}/suggestions`) và thêm món vào một ngày (RM-07 `POST /api/v1/roadmaps/{roadmapId}/days/{dayId}/items`). Mã nguồn nằm trong `src/features/roadmaps/`: `roadmap-add-item-dialog.tsx`, `roadmap-add-item-rules.ts`, `roadmap-add-item.css`, `roadmap-destination.ts`, phần nối vào `roadmap-itinerary.tsx`, `roadmap-detail-page.tsx` và `roadmap-service.ts`. Proxy cho phép thêm hai thao tác này trong `src/shared/api/roadmap-proxy.ts`.

## Hành vi

- **Lối vào (theo Figma `24:1383`):** nút tối "+ Thêm món" nằm trên thanh của từng bữa (mở hộp thoại ở đúng bữa đó) và ở đầu mỗi ngày (bữa mặc định là bữa chính đầu tiên của ngày còn thiếu: sáng, trưa, tối; nếu đủ thì ăn vặt). Ngày trống có hướng dẫn "Bấm “Thêm món”…".
- **Hộp thoại:** tên "Thêm món vào Thứ Bảy, 10 tháng 10"; bộ lọc: tỉnh / thành phố (bắt buộc), từ khóa, giá tối đa (nhập dạng `40.000 VND`), áp dụng khi bấm "Tìm món". **Danh sách không lọc theo bữa**: ô chọn "Thêm món đã chọn vào" (Bữa sáng, trưa, tối, Ăn vặt, Ăn khuya) chỉ quyết định món được thêm vào bữa nào (RM-07 bắt buộc có `mealSlot`), mặc định là bữa của nút đã bấm, và đổi ô này không gọi lại RM-06.
- **RM-06 gửi đúng tên tham số của tài liệu:** `province`, `dayId`, `q`, `maxPrice`, `lat` + `lng` (luôn đi cùng nhau), `cursor`, `limit` (12 mỗi trang, trong khoảng 1–50). Bộ lọc trống không được gửi. Backend tự loại các món đã có trong lộ trình và tự dùng điểm xuất phát đã chấm (bán kính mặc định 10 km); với lộ trình `gps`, hộp thoại gửi vị trí nếu Traveler đã cho phép ở phần Lịch trình, nếu chưa thì nhắc cách làm.
- **Điểm đến:** lộ trình không lưu điểm đến (RM-01), nên RM-06 cần tỉnh ở mọi lần gọi. Hộp thoại tự điền tỉnh của lộ trình, theo thứ tự: (1) tỉnh người dùng đã chọn khi lập lộ trình hoặc lần tìm trước (nhớ trong trình duyệt này, khóa `angi:roadmap-destination:{id}`, chỉ là tiện ích); (2) tỉnh nhiều món nhất trong lộ trình; (3) tỉnh được nêu trong tên lộ trình (ví dụ "Đi chơi Hà Nội" → "Thành phố Hà Nội"; so khớp theo từ nguyên vẹn, không phân biệt dấu, chọn tên dài nhất, dùng danh mục tỉnh `locations/provinces`) và tự tìm món ngay. Người dùng gõ tỉnh khác thì tên lộ trình không ghi đè. Không xác định được tỉnh thì chưa gọi RM-06 cho đến khi chọn và bấm "Tìm món".
- **Phân trang cursor:** "Xem thêm món" gửi `cursor` kèm cùng bộ lọc (tài liệu: cần `province` ở mọi lần gọi); món trùng được gộp. `INVALID_CURSOR` (danh sách xếp hạng đã hết hạn ở server) hiện thông báo và nút "Tải lại gợi ý" để lấy danh sách mới.
- **Thêm món (RM-07):** nút "Thêm … vào bữa …" gửi `{ dishId, mealSlot, recoRequestId }`, trong đó `recoRequestId` là `requestId` của RM-06 (món chọn từ gợi ý). Không gửi `sortOrder` nên món vào cuối bữa. Mỗi lúc chỉ một lần thêm; sau khi thành công nút thành "✓ Đã thêm" (không thêm lại được), có thông báo cho trình đọc màn hình, và hộp thoại ở lại để thêm món tiếp.
- **Sau khi thêm:** trang đọc lại RM-03, nên thứ tự, chi phí, ngân sách và bản đồ đều là số liệu của backend, FE không tự cộng. Chặng RM-14 của ngày vừa đổi được hỏi lại đúng một lần (khóa cache có danh sách món). Đọc lại thất bại thì hộp thoại báo "Món đã được thêm nhưng chưa tải lại được lộ trình".
- **Lỗi theo `errorCode`:** `DISH_NOT_AVAILABLE` (món hết, ngừng bán hoặc quán ẩn: món bị khóa kèm nhãn, chọn món khác), `DAY_NOT_FOUND`, `ROADMAP_NOT_FOUND`, `VALIDATION_FAILED`, `INVALID_CURSOR`; lỗi khác dùng thông báo chung. Hộp thoại luôn giữ nguyên bộ lọc.
- **Trợ năng và giao diện:** hộp thoại dùng `Dialog` chung (Escape, trả lại tiêu điểm cho nút mở, tiêu điểm vào ô tỉnh khi chưa có tỉnh). Nút đã thêm dùng `aria-disabled` nên vẫn focus được. Dưới 900px bộ lọc hai cột, dưới 700px một cột, nút thêm chiếm cả hàng; không tràn ngang từ 320px đến 1440px.

## Giới hạn hiện tại

- **Chưa gửi IMP-01** (impressions): tài liệu nói app gửi `requestId` của RM-06 và các món thực sự hiện ra cho `POST /impressions`. Task chỉ yêu cầu RM-06 và RM-07, nên phần này để task riêng (ảnh hưởng chất lượng gợi ý, không ảnh hưởng việc thêm món).
- **Không dùng** `mealSlot` của RM-06 (theo yêu cầu: danh sách không lọc theo bữa; tham số vẫn hợp lệ ở backend).
- **Chưa lộ ra** `tagIds`, `excludeTagIds` và `radiusKm` của RM-06, và `sortOrder` của RM-07 (backend dùng mặc định: bán kính 10 km, thêm vào cuối bữa).
- Chỉ thêm món. Đổi món (RM-08), xóa món (RM-09), sinh bằng AI (RM-10, RM-11) và đánh giá món (RM-13) thuộc các task sau. Dải "Quán ăn gợi ý" và "Hỏi AI" của Figma chưa làm vì không có thao tác tương ứng.
- Backend không chặn thêm cùng một món hai lần (RM-07 không kiểm tra), nhưng RM-06 loại món đã có khi xếp hạng; hộp thoại cũng khóa món vừa thêm.
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-06 / RM-07 đã có ở backend, nên màn gọi API thật ngay.

## Kiểm tra (2026-10-24)

| Kiểm tra                                                              | Kết quả                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`, `npx tsc --noEmit`, `npm run build`                   | Xem báo cáo cuối của lần làm                                                                                                                                                                                                                                               |
| `tests/roadmap-add-item.test.ts`                                      | 11 test: tham số RM-06 (không có `mealSlot`), body RM-07, tỉnh mặc định (nhớ, theo món, theo tên lộ trình), bữa gợi ý, lỗi theo `errorCode`, allowlist proxy                                                                                                               |
| `tests/browser/roadmap-add-item.spec.ts` (bản build cô lập, API stub) | 12 test: mở theo bữa (ô chọn bữa đích) và tỉnh điền sẵn, tỉnh lấy từ tên lộ trình, thêm món rồi đọc lại RM-03, chặng hỏi lại, ngày trống, bộ lọc, cursor và `INVALID_CURSOR`, lỗi RM-06 / RM-07 / đọc lại, chưa biết tỉnh, vị trí `gps`, bàn phím và tràn ngang 320–1440px |
| Mapbox                                                                | Không có request nào: backend được stub, token rỗng (bản đồ của trang chi tiết tắt)                                                                                                                                                                                        |
| Backend thật (`test:live`)                                            | Chưa chạy                                                                                                                                                                                                                                                                  |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-24 15:48, nội dung trích lại sau khi code giống hệt bản đầu task).

- Sheet "Tổng quan": quy ước phân trang cursor cho danh sách đi qua reco, ghi chú "Lọc quán gần" và "Thứ tự món bằng điểm".
- Sheet "Backend API": RM-06 (r36), RM-07 (r37).
- Sheet "Chi tiết Request-Response": RM-06 (r136–r138), RM-07 (r139–r143).
- Sheet "JSON mẫu": RM-06 (r1098–), RM-07 (r1137–).
- Sheet "DTO": DishCard, RestaurantMini, Tag, RoadmapDish, RoadmapItem.
- Sheet "Mã lỗi": `VALIDATION_FAILED`, `INVALID_CURSOR`, `DISH_NOT_AVAILABLE`, `*_NOT_FOUND` (`ROADMAP_NOT_FOUND`, `DAY_NOT_FOUND`).
- Sheet "Enum": `mealSlot`, `dishes.status`, `roadmap_items.source`.

Đối chiếu code backend: `RoadmapsController` (`GetSuggestions`, `AddItem`, mã 201), `GetRoadmapSuggestionsRequestDto` + validator (`province` bắt buộc, `limit` 1–50, `radiusKm` ≤ 50, `lat` / `lng` đi cùng nhau, `maxPrice` ≥ 0, `mealSlot` hợp lệ), `GetRoadmapSuggestionsUseCase` (danh sách xếp hạng tối đa 200 món, cursor theo vị trí, `INVALID_CURSOR`, loại món đã có, vùng lọc ưu tiên GPS rồi điểm đã chấm), `AddRoadmapItemRequestDto` + validator (`dishId` > 0, `mealSlot` bắt buộc và hợp lệ, `sortOrder` và `recoRequestId` tùy chọn) và `AddRoadmapItemUseCase` (`ROADMAP_NOT_FOUND`, `DAY_NOT_FOUND`, `DISH_NOT_AVAILABLE`, `source = manual`, xếp cuối bữa khi không có `sortOrder`). Method, đường dẫn, tên tham số, tên và kiểu trường, enum, mã trạng thái và mã lỗi đều khớp.
