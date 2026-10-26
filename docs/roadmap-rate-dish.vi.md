# F-30 Đánh giá món (Like / Dislike) (ANGI-152)

Use case F-30 "Rate Dish": Traveler đánh giá mức độ thích một món sau khi dùng thử; hệ thống lưu đánh giá (like / dislike) và dùng làm phản hồi để cá nhân hóa gợi ý. Endpoint: RM-13 `POST /api/v1/roadmaps/{roadmapId}/items/{itemId}/feedback`.

Mã nguồn nằm trong `src/features/roadmaps/`: `roadmap-rate-item.tsx` (hai nút đánh giá), `roadmap-rate-rules.ts` (nhãn, lỗi), phần nối vào `roadmap-itinerary.tsx`, `roadmap-detail-view.tsx`, `roadmap-detail-page.tsx`, kiểu dáng trong `roadmap-detail.css` và `roadmap-service.ts` (`rateItem`). Proxy cho phép thêm `POST roadmaps/{id}/items/{id}/feedback` trong `src/shared/api/roadmap-proxy.ts` (trả `201` mặc định của POST, đúng tài liệu).

## Hành vi

- **Hai nút ở góc dưới bên phải của mỗi món:** nút "Thích" và "Không thích" (biểu tượng ngón cái cùng chữ), nằm cùng hàng với "Xóa món" ở góc dưới bên trái thẻ. Chỉ là đánh giá chủ quan của chính người dùng: màn hình **không hiển thị** số lượt thích / không thích của món (`dish.likeCount` / `dislikeCount` không được dùng ở đây). Tên truy cập: "Thích {món}" và "Không thích {món}" (đã chọn: "Bạn đã thích {món}"), nhóm có nhãn "Đánh giá {món}".
- **Không có bước xác nhận:** theo yêu cầu của chủ dự án, bấm "Thích" hoặc "Không thích" là gửi `{ "value": "like" | "dislike" }` ngay, không có hộp thoại hỏi lại. Tài liệu RM-13 ghi mỗi món chỉ đánh giá một lần và "Không sửa/xóa được", nên nút có `title` nhắc điều đó. Trong lúc lưu, bấm lần nữa không gửi thêm.
- **Sau khi gửi:** trang đọc lại RM-03 nên `myFeedback` là của backend (FE không dùng `likeCount` / `dislikeCount` trong phản hồi RM-13). Nút đã chọn được tô màu (xanh cho thích, đỏ cho không thích) với `aria-pressed="true"`, nút còn lại mờ đi; cả hai không bấm được nữa (`aria-disabled`, vẫn focus được). Tiêu điểm vẫn ở nút vừa bấm và vùng `role="status"` ẩn đọc "Đã ghi nhận bạn thích {món}." Món đã đánh giá từ trước (`myFeedback` khác `null` trong RM-03) hiển thị đúng như vậy; nhãn "Bạn đã thích / không thích món này" cũ của F-21 được thay bằng chính trạng thái nút.
- **Lỗi theo `errorCode`:** `FEEDBACK_ALREADY_EXISTS` (409, món đã được đánh giá, ví dụ từ tab khác): đọc lại lộ trình, báo trong ngày "{món} đã được đánh giá trước đó, nên không đánh giá lại được…" và nút hiện đúng đánh giá cũ; `ROADMAP_ITEM_NOT_FOUND` (404, món đã rời lộ trình): báo "{món} không còn trong lộ trình…" và danh sách được cập nhật; `VALIDATION_FAILED` và lỗi khác (mạng, 5xx): ngày hiện cảnh báo "Chưa ghi nhận được đánh giá cho {món}. {lý do}" và hai nút vẫn bấm lại được. Lưu được mà đọc lại RM-03 thất bại thì báo "Đã ghi nhận đánh giá nhưng chưa tải lại được lộ trình…". Các thông báo trong ngày là cảnh báo nên không tự ẩn.
- **Giao diện:** hai nút dạng viên thuốc có chữ, cao 36px (40px trên màn cảm ứng) theo kiểu nút phụ của trang; dưới 700px hàng hành động xuống dòng, không tràn ngang từ 320px đến 1440px.

## Giới hạn hiện tại

- **Không đổi hay bỏ được đánh giá:** đúng hợp đồng RM-13. Vì FE không hỏi xác nhận, nút chỉ gửi khi người dùng bấm, và món đã đánh giá thì không bấm lại được.
- Tài liệu ghi RM-13 "chỉ có ở màn View Roadmap Item Detail" (RM-12); màn chi tiết một món (RM-12) chưa có trong ứng dụng, nên nút nằm trực tiếp trên thẻ món của lộ trình, dùng đúng `myFeedback` của RM-03.
- Backend tự ghi nhận phản hồi cho gợi ý (outbox `FEEDBACK_CREATED` tới reco), FE không gọi thêm gì.
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-13 đã có ở backend (PR #90), nên màn gọi API thật ngay.

## Kiểm tra (2026-10-26)

| Kiểm tra                                        | Kết quả                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/roadmap-rate.test.ts`                    | 6 test: tên nút (không kèm số lượt), câu thông báo, lỗi theo `errorCode` (đã đánh giá, món đã rời lộ trình, còn lại cho thử lại), allowlist proxy chỉ cho `POST …/feedback` (không PUT, PATCH, DELETE, GET), `rateItem` gọi đúng đường dẫn và body                                   |
| `tests/browser/roadmap-rate.spec.ts` (API stub) | 9 test: vị trí hai nút và không có số lượt, bấm là gửi RM-13 và đọc lại, không thích và món đã đánh giá không bấm lại được, bấm đúp chỉ gửi một lần, lỗi báo trong ngày và thử lại, đã đánh giá ở tab khác (409), món đã bị xóa (404), đọc lại thất bại, không tràn ngang 320–1440px |
| `tests/browser/roadmap-detail.spec.ts` (F-21)   | Cập nhật: món có `myFeedback = "like"` nay được kiểm tra qua nút đã chọn thay vì nhãn chữ                                                                                                                                                                                            |
| Mapbox                                          | Không có request nào: backend được stub, token rỗng (bản đồ của trang chi tiết tắt)                                                                                                                                                                                                  |
| Backend thật (`test:live`)                      | Chưa chạy                                                                                                                                                                                                                                                                            |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-26 18:28, nội dung không đổi giữa hai lần).

- Sheet "Tổng quan": ghi chú RM-13 đánh giá món (r112: chỉ chủ roadmap chưa xóa, món đã ẩn hoặc quán đóng vẫn đánh giá được, khóa dòng item và unique index cho 409).
- Sheet "Backend API": RM-13 (r43) `POST /api/v1/roadmaps/{roadmapId}/items/{itemId}/feedback`, TRAVELER, body `value*: like | dislike`, `201 Created`, lỗi `404 ROADMAP_ITEM_NOT_FOUND` / `409 FEEDBACK_ALREADY_EXISTS`, ghi chú "Không sửa/xóa được".
- Sheet "Chi tiết Request-Response": RM-13 (r178–r184): `value` (like | dislike; mỗi item chỉ đánh giá 1 lần), trả `feedbackId`, `value`, `dishId`, `likeCount`, `dislikeCount`, `createdAt`. Sheet "JSON mẫu": RM-13 (r1372–r1387). Sheet "UC ↔ API": "Rate Dish → RM-13" (r28). Sheet "DTO": RoadmapItem (`myFeedback`). Sheet "Mã lỗi": `FEEDBACK_ALREADY_EXISTS` (409), `*_NOT_FOUND`, `VALIDATION_FAILED`.

Đối chiếu code backend: `RoadmapsController` (RM-13 `POST items/{itemId}/feedback`), `RateRoadmapItemRequestDtoValidator` (`value` là like hoặc dislike) và `RateRoadmapItemUseCase` (khóa item của người dùng, `ROADMAP_ITEM_NOT_FOUND` khi không thuộc lộ trình của mình, `FEEDBACK_ALREADY_EXISTS` khi item đã có phản hồi hoặc vi phạm unique index, tăng bộ đếm món trong cùng transaction, trả `feedbackId`, `value`, `dishId`, `likeCount`, `dislikeCount`, `createdAt`). Method, đường dẫn, tên và kiểu trường, enum, mã trạng thái và mã lỗi đều khớp.
