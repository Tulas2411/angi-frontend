# F-27 Đổi thứ tự món trong lộ trình (ANGI-147) và giới hạn 7 ngày

Phần này làm hai việc trên trang lộ trình:

1. **Đổi thứ tự món bằng cách kéo thả** (và bằng bàn phím): mỗi thẻ món có một biểu tượng nắm kéo ở góc trên bên phải. Dùng RM-08 `PATCH /api/v1/roadmaps/{roadmapId}/items/{itemId}` với `sortOrder` và `mealSlot`. Đây là một phần của use case F-27 "Edit Roadmap Item" (Jira ANGI-147); phần **thay món khác** (gửi `dishId` của RM-08, chọn từ gợi ý RM-06) chưa làm.
2. **Lộ trình mới tối đa 7 ngày** ở màn lập lộ trình (`/roadmaps/new`).

Mã nguồn nằm trong `src/features/roadmaps/`: `roadmap-reorder-rules.ts` (tính các lần gọi), `roadmap-item-drag.ts` (kéo thả bằng pointer), phần nối vào `roadmap-itinerary.tsx`, `roadmap-detail-view.tsx`, `roadmap-detail-page.tsx`, kiểu dáng trong `roadmap-detail.css`, `roadmap-service.ts` (`updateItem`) và `roadmap-rules.ts` (`roadmapLimits.maxDays`). Proxy cho phép thêm `PATCH roadmaps/{id}/items/{id}` trong `src/shared/api/roadmap-proxy.ts`.

## Đổi thứ tự món

- **Biểu tượng nắm kéo:** ô vuông 32px (40px trên màn cảm ứng) có sáu chấm, màu xám nhạt như ảnh mẫu, nằm ở góc trên bên phải của thẻ món (tiêu đề chừa chỗ nên tên dài không chạy dưới biểu tượng). Tên truy cập "Đổi thứ tự {tên món}", gợi ý "Kéo biểu tượng ở góc thẻ món để đổi thứ tự, hoặc bấm phím mũi tên lên xuống…".
- **Kéo thả:** giữ biểu tượng rồi kéo (chuột, bút hoặc cảm ứng; biểu tượng có `touch-action: none` nên chỉ khi chạm vào nó mới chặn cuộn trang). Chỉ **thẻ món (thông tin món và ảnh)** đi theo con trỏ; dòng nối "x km · y phút" phía trên thẻ đứng yên, một vạch đỏ san hô báo vị trí sẽ rơi, trang tự cuộn khi kéo gần mép trên hoặc dưới. Thả vào đâu trong cùng ngày cũng được: thả vào bữa khác thì món đổi sang bữa đó (RM-08 có `mealSlot`). **Escape** hoặc hủy con trỏ thì không lưu gì; bấm mà không kéo cũng không gửi gì.
- **Bàn phím:** đặt tiêu điểm vào biểu tượng rồi bấm mũi tên **lên / xuống** để đổi một vị trí. Ở món đầu hoặc cuối của một bữa, lần bấm tiếp theo chuyển món sang bữa kế bên (đầu hoặc cuối bữa đó); ở món đầu và cuối của cả ngày thì không có gì xảy ra. Sau khi chuyển, tiêu điểm trở lại đúng biểu tượng của món vừa chuyển. Vùng `role="status"` ẩn đọc "Đã chuyển {món} tới vị trí N của {bữa}."
- **Cách lưu (đúng hành vi backend):** theo mã backend `UpdateRoadmapItemUseCase`, RM-08 chỉ sửa **đúng item được gọi**, không dồn các món bên cạnh; RM-03 sắp theo bữa, rồi `sortOrder`, rồi id. Vì vậy sau mỗi lần thả, FE tính lại thứ tự của bữa đích (0, 1, 2…) và gửi một PATCH cho **từng món đổi vị trí**, món vừa kéo gửi trước (body chỉ gồm trường đổi: `sortOrder`, và `mealSlot` khi đổi bữa). Cách này cũng gỡ các món trùng `sortOrder` do lần tạo trước để lại. Các lần gọi chạy lần lượt, không chạy song song.
- **Hiển thị ngay:** thứ tự mới hiện ngay (tạm tính ở FE), rồi trang đọc lại RM-03 và dùng đúng thứ tự backend trả về. Đang lưu thì không bắt đầu lần kéo khác (nút nắm bị khóa bằng `aria-disabled`, vùng ngày có `aria-busy`). Các dòng nối quãng đường **tự tính lại khi thả**: trong lúc đang lưu, FE chưa hỏi RM-14 (backend còn trả theo thứ tự cũ) và hiện "Đang tính quãng đường…"; sau khi đọc lại RM-03 với thứ tự backend xác nhận, chặng RM-14 của ngày đó được hỏi đúng một lần (khóa cache có thứ tự món). Số thứ tự và ghim trên bản đồ theo thứ tự mới.
- **Lỗi:** một lần PATCH lỗi thì dừng, trả thứ tự về như backend, đọc lại RM-03 và báo trong ngày: "Chưa lưu được thứ tự mới: … Danh sách đã được tải lại." (`ROADMAP_ITEM_NOT_FOUND`: "Món này không còn trong lộ trình nên chưa đổi được thứ tự…"). Đọc lại cũng lỗi thì báo "Chưa lưu được thứ tự mới và cũng chưa tải lại được lộ trình…".

## Giới hạn 7 ngày

- `roadmapLimits.maxDays` đổi từ 30 sang **7**: ô "Số ngày" có `max=7`, chữ trợ giúp "Từ 1 đến 7 ngày.", lỗi "Số ngày phải là số nguyên từ 1 đến 7.", tóm tắt và tên gợi ý chỉ nhận 1–7.
- Đây là **quy định của ứng dụng**, không phải của API: RM-01 / RM-04 ở backend vẫn nhận 1–30 (API Design v1.8), nên các lộ trình cũ dài hơn 7 ngày vẫn mở và xem được bình thường; chỉ màn lập và sửa thông tin ngay sau khi lập mới giới hạn.

## Giới hạn hiện tại

- Chỉ đổi thứ tự **trong cùng một ngày**. RM-08 có `dayId` để chuyển món sang ngày khác nhưng giao diện chưa có (các ngày khác thường đang gập, thao tác kéo qua ngày phức tạp hơn nhiều); chưa dùng `dishId` (thay món), chưa làm hoàn tác.
- Tên bữa quyết định thứ tự trong ngày (sáng, trưa, tối, ăn vặt, ăn khuya) nên một món chỉ có thể "ăn trước" món khác trong cùng bữa, hoặc chuyển sang bữa khác; không có thứ tự tự do vượt qua ranh giới bữa. Kéo vào bữa chưa có món thì chưa được (chưa có khung bữa đó); dùng "+ Thêm món" cho bữa đó.
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-08 đã có ở backend, nên màn gọi API thật ngay.

## Kiểm tra (2026-10-26)

| Kiểm tra                                                             | Kết quả                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/roadmap-reorder.test.ts`                                      | 18 test: kế hoạch gọi RM-08 (lên, xuống, cuối bữa, đã đúng chỗ, sang bữa khác, gỡ trùng `sortOrder`), thứ tự hiển thị sau khi lưu, bước bàn phím, body PATCH, thông báo, allowlist và đường dẫn / body của `updateItem`                                                                                                                                  |
| `tests/roadmap-plan.test.ts`, `tests/browser/roadmap-plan.spec.ts`   | Giới hạn 1–7 ngày (0, 8, 30, 2.5, chữ bị từ chối; 7 hợp lệ; thông báo "từ 1 đến 7")                                                                                                                                                                                                                                                                      |
| `tests/browser/roadmap-reorder.spec.ts` (bản build cô lập, API stub) | 9 test: biểu tượng ở góc trên bên phải thẻ, kéo thả trong bữa (vạch báo vị trí, các PATCH theo thứ tự, đọc lại RM-03), chỉ thẻ di chuyển còn dòng nối đứng yên và RM-14 hỏi lại sau khi thả, thả sang bữa khác, Escape và bấm không kéo, bàn phím (giữ tiêu điểm, qua bữa, ở hai đầu ngày), lỗi lưu, món đã bị xóa nơi khác, không tràn ngang 320–1440px |
| Mapbox                                                               | Không có request nào: backend được stub, token rỗng (bản đồ của trang chi tiết tắt)                                                                                                                                                                                                                                                                      |
| Backend thật (`test:live`)                                           | Chưa chạy                                                                                                                                                                                                                                                                                                                                                |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (bản sửa 2026-10-26 18:28; so với bản trích đầu ngày 2026-10-25 chỉ đổi mô tả điện thoại của OWN-01, OWN-03 và DTO nhà hàng, không động tới RM-01, RM-04, RM-08).

- Sheet "Tổng quan": ghi chú đổi món RM-08 (r66: đổi `dishId` tạo item mới, id mới) và quy ước phản hồi.
- Sheet "Backend API": RM-08 (r38) `PATCH /api/v1/roadmaps/{roadmapId}/items/{itemId}`, "Đổi món (quán đổi theo), hoặc đổi ngày, bữa, thứ tự của item", lỗi `404 ROADMAP_ITEM_NOT_FOUND` / `400 DISH_NOT_AVAILABLE`; RM-01 (r31) và RM-04 (r34) với `numDays` 1..30.
- Sheet "Chi tiết Request-Response": RM-08 (r144–r149): `dishId?`, `recoRequestId?`, `dayId?`, `mealSlot?`, `sortOrder?` (smallint, "Thứ tự mới"), trả `200 OK` với `RoadmapItem`.
- Sheet "JSON mẫu": RM-08 (r1188–r1239). Sheet "DTO": RoadmapItem. Sheet "Enum": `mealSlot`. Sheet "Mã lỗi": `*_NOT_FOUND`.

Đối chiếu code backend: `RoadmapsController` (RM-08 `PATCH items/{itemId}`), `UpdateRoadmapItemRequestDtoValidator` (`dishId` và `dayId` > 0, `mealSlot` hợp lệ) và `UpdateRoadmapItemUseCase` (khóa và lấy item của người dùng, `ROADMAP_ITEM_NOT_FOUND` khi không có hoặc ngày đích không thuộc lộ trình, không có `dishId` thì sửa tại chỗ `mealSlot` / `sortOrder` / ngày của đúng item đó và giữ nguyên id, like / dislike). Sắp xếp RM-03 và RM-14: `GetRoadmapDetail` / `RoadmapMapper.MapDay` và `GetRoadmapDayRouteUseCase.OrderItems` đều theo `MealSlot`, `SortOrder`, `Id`. Method, đường dẫn, tên và kiểu trường, mã trạng thái và mã lỗi đều khớp. Giới hạn 7 ngày chặt hơn hợp đồng (1..30) nên mọi giá trị FE gửi đều hợp lệ với backend.
