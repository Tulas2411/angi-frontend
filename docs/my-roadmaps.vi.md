# F-20 Xem danh sách lộ trình của tôi (ANGI-110)

Màn `/roadmaps` (chỉ `TRAVELER`) gọi thật RM-02 `GET /api/v1/roadmaps?page=&pageSize=`. Mã nguồn nằm trong `src/features/roadmaps/` (`my-roadmaps-page.tsx`, `roadmap-list-rules.ts`, `my-roadmaps.css`, `roadmap-service.ts`); trang ở `src/app/(protected)/(app)/roadmaps/page.tsx`. Màn demo cũ `pages.tsx` (`/demo/traveler/roadmaps/*`) không bị sửa.

## Hành vi

- **Phân trang theo URL:** `/roadmaps?page=2`. Mỗi trang 9 thẻ (`pageSize=9`, nằm trong khoảng 1–100 của API; 3 thẻ mỗi hàng). `page` hỏng (`abc`, `0`, `-1`, số lẻ) được coi là trang 1 nên backend không bao giờ nhận tham số sai. Trang vượt quá cuối (ví dụ vừa xóa bớt lộ trình) tự chuyển về trang cuối.
- **Thứ tự:** mới nhất trước, đúng thứ tự backend trả về (`createdAt` giảm dần, rồi `id` giảm dần). FE không sắp xếp lại.
- **Thẻ lộ trình** chỉ hiển thị dữ liệu có trong `RoadmapSummary`:
  - Ảnh bìa (`coverUrl`, ảnh món đầu tiên); không có ảnh thì dùng khung dự phòng.
  - Tên, khoảng ngày (`startDate`–`endDate`, hoặc "Chưa chọn ngày đi"), số ngày, số món ("Chưa có món" khi `itemCount = 0`).
  - Ngân sách, chi phí dự kiến (`totalEstimatedCost`), điểm xuất phát (tên điểm đã chấm hoặc "Vị trí hiện tại"; ẩn khi `originMode = none`).
  - Nhãn "Vượt ngân sách" khi `totalEstimatedCost > budgetAmount` (cùng quy tắc `budget.isOverBudget` của RoadmapDetail). Không hiện khi chưa đặt ngân sách.
  - Tiền hiển thị `1.500.000 VND`, cùng định dạng với ô ngân sách của F-19.
- **Trạng thái:** đang tải (skeleton), lỗi (thông báo theo `errorCode` kèm nút "Thử lại", không dùng dữ liệu mẫu thay thế), chưa có lộ trình (nút "Lập lộ trình mới"), có dữ liệu (kèm bộ chuyển trang khi có hơn một trang).
- **Lối vào:** liên kết "Lộ trình của tôi" trên thanh điều hướng và trong menu tài khoản của Traveler; nút "Xem lộ trình của tôi" ở thẻ kết quả của màn lập lộ trình (F-19).
- Proxy: thêm `GET roadmaps` vào allowlist; query `page` và `pageSize` được chuyển nguyên cho backend.

## Giới hạn hiện tại

- Thẻ chưa mở được chi tiết, sửa hay xóa: chi tiết (F-21, RM-03) và xóa (F-22, RM-05) chưa làm, nên thẻ không phải liên kết.
- Figma: kho inventory chỉ ghi khung trạng thái trống "Lịch ăn của tôi · Trống sau khi xóa" (`447:28816`); khung danh sách mặc định chưa được liệt kê, nên bố cục dựa trên bản `TripList` cũ và phong cách hiện tại của web. Gửi ảnh khung Figma để chỉnh sát hơn.
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-02 đã có ở backend, nên màn gọi API thật ngay.

## Kiểm tra (2026-10-24)

| Kiểm tra                                                                         | Kết quả                                                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`, `npx tsc --noEmit`, `npm run build`                              | Đạt; route `ƒ /roadmaps`                                                                                                       |
| `npm test`                                                                       | 22 file, 150 test đạt (`tests/roadmap-list.test.ts`: 6 test)                                                                   |
| `npm run test:browser` (bản build production cô lập, API stub cổng 5164, 3 lượt) | 186 lượt đạt, 0 lỗi, 3 bỏ qua (bài kiểm tra hộp bản đồ của F-19)                                                               |
| `tests/browser/my-roadmaps.spec.ts`                                              | Quyền truy cập, thẻ theo JSON mẫu, giá trị rỗng, phân trang và trang ngoài khoảng, trống, lỗi + thử lại, tràn ngang 320–1440px |
| Mapbox                                                                           | Màn không dùng bản đồ; không có request nào                                                                                    |
| Backend thật (`test:live`)                                                       | Chưa chạy                                                                                                                      |

Ngoài màn này, `tests/browser/routes.spec.ts` và `tests/live/account.spec.ts` được sửa vì `/roadmaps` không còn là đường dẫn không tồn tại; hàm `loginAs` dùng chung thử lại khi `goto` bị hủy bởi điều hướng cũ.

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-24 15:48, nội dung trích lại sau khi code giống hệt bản đầu task).

- Sheet "Tổng quan": quy ước phân trang (r55, `page` từ 1, `pageSize` mặc định 20 tối đa 100).
- Sheet "Backend API": RM-02 (r32).
- Sheet "Chi tiết Request-Response": r120–r124 (items, page, pageSize, totalItems, totalPages).
- Sheet "JSON mẫu": RM-02 r866–r894.
- Sheet "DTO": RoadmapSummary (r178–r192).
- Sheet "Mã lỗi": `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`.

Đối chiếu code backend: `RoadmapsController.GetMyRoadmaps`, `GetMyRoadmapsRequestDto` (`Page = 1`, `PageSize = 20`), `GetMyRoadmapsRequestDtoValidator` (`page ≥ 1`, `pageSize 1–100`), `GetMyRoadmapsUseCase` (chỉ roadmap của người gọi, chưa xóa) và `RoadmapRepository.GetByUserAsync` (sắp xếp `createdAt` giảm dần, `id` giảm dần). Method, đường dẫn, tên và kiểu trường, null, thứ tự và giới hạn tham số đều khớp.
