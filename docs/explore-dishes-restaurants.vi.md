# Khám phá món ăn và quán ăn (`/dishes`, `/restaurants`)

Các trang công khai của ducbui (danh sách và chi tiết món, danh sách và chi tiết quán, đánh giá, báo cáo quán) được làm lại theo giao diện hiện tại của dự án và nối vào API thật. Giao diện cũ (`WorkspaceShell`, `PlatformProvider`, dữ liệu mẫu `src/mocks`) của các trang này đã bị xóa.

Mã nguồn nằm trong `src/features/explore/`:

| File                                                                | Việc                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `explore-types.ts`, `explore-service.ts`                            | DTO và lời gọi API (đọc công khai, ghi cần phiên Traveler)         |
| `explore-rules.ts`                                                  | Nhãn, định dạng, bộ lọc ↔ URL, kiểm tra form, lỗi theo `errorCode` |
| `dish-list-page.tsx`, `dish-detail-page.tsx`                        | `/dishes`, `/dishes/{id}`                                          |
| `restaurant-list-page.tsx`, `restaurant-detail-page.tsx`            | `/restaurants`, `/restaurants/{id}`                                |
| `review-dialog.tsx`, `report-dialog.tsx`, `explore-attachments.tsx` | Viết đánh giá, báo cáo quán, tải ảnh thật lên (MEDIA-01)           |
| `explore-cards.tsx`, `explore.css`, `use-remote.ts`                 | Thẻ món/quán, kiểu dáng, hook tải dữ liệu theo khóa                |

Khung trang: `src/components/public-shell.tsx` (route group `src/app/(site)`), cùng `SiteHeader`, `SiteNav`, `AccountMenu`, `SiteFooter` với trang chủ và khu làm việc. Thanh điều hướng dùng chung ở `src/components/site/navigation.ts`.

## Lối vào

- Thanh điều hướng: **Món ăn** và **Quán ăn** cho khách và Traveler (Traveler còn có Lộ trình của tôi, Lập lộ trình). Trang chủ có thêm hai liên kết cùng tên ở đầu và cuối trang.
- Khách xem được mọi trang, không bị đẩy sang `/login`; header hiện "Đăng nhập" và "Tham gia ANGI". Người đã đăng nhập ở mọi vai trò thấy menu tài khoản; chỉ Traveler có nút viết đánh giá và báo cáo.

## Hành vi

- **Danh sách món (DISH-01):** tìm theo tên, tỉnh/thành, loại món, mức giá trần và thẻ (CAT-02). Bộ lọc nằm trong URL (`?q=&province=&form=&price=&tag=`) nên chia sẻ được và nút Back hoạt động. Phân trang bằng `cursor`: nút "Xem thêm món" gửi `nextCursor`; `INVALID_CURSOR` báo "Danh sách đã thay đổi, hãy tìm lại từ đầu". Mỗi trang 12 món. Thẻ món không hiển thị số like/dislike (đúng yêu cầu chủ dự án).
- **Chi tiết món (DISH-02):** ảnh (bìa và ảnh phụ), giá, loại món, thẻ, mô tả, trạng thái "Tạm hết món", quán bán món (ảnh, địa chỉ, giờ mở cửa, đánh giá) và liên kết Google Maps theo tọa độ. `DISH_NOT_FOUND` hoặc id không hợp lệ cho trang "Không tìm thấy" / 404.
- **Danh sách quán (REST-01):** tìm theo tên, tỉnh/thành, mức giá, số sao tối thiểu, "chỉ quán đang mở cửa" và sắp xếp (đánh giá cao nhất, mới nhất). Phân trang theo URL (`?page=`), 12 quán mỗi trang, trang vượt quá cuối tự quay về trang cuối. Sắp xếp theo khoảng cách chưa có vì FE không gửi vị trí.
- **Chi tiết quán (REST-02, REST-03, REST-04):** ba tab. Thực đơn (REST-03). Đánh giá (REST-04): điểm trung bình, phân bố 5 sao (bấm một hàng để lọc theo sao), lọc "chỉ đánh giá có ảnh", sắp xếp, phân trang, ảnh và phản hồi của chủ quán (chỉ khi `visible`). Thông tin: giờ mở cửa từ Thứ hai, địa chỉ, điện thoại, email, website.
- **Viết đánh giá (REV-01):** chọn 1–5 sao (bắt buộc), nội dung tối đa 2000 ký tự, tối đa 5 ảnh. Ảnh được tải lên ngay (MEDIA-01, `purpose=review`) và chỉ gửi `imageMediaIds`. Xong thì trang đọc lại quán (nút đổi thành "Bạn đã đánh giá quán này", `myReview`) và danh sách đánh giá. `REVIEW_ALREADY_EXISTS` (409) báo đã đánh giá trước đó; lỗi khác giữ hộp thoại để thử lại.
- **Báo cáo quán (REP-01):** chọn lý do (`wrong_info`, `closed`, `spam`, `offensive`, `hygiene`, `scam`, `other`), mô tả tối đa 1000 ký tự (bắt buộc khi chọn "Lý do khác"), tối đa 5 ảnh bằng chứng (`purpose=report_evidence`). `REPORT_ALREADY_PENDING` (409) báo báo cáo trước đó đang chờ xử lý.
- **Bản đồ:** nút "Chỉ đường trên Google Maps" mở liên kết theo tọa độ; trang này không gọi Mapbox.
- **Phiên:** với đọc công khai, proxy gửi kèm token nếu người dùng đã đăng nhập (để có `myReview` và xếp hạng cá nhân hóa) và gọi ẩn danh khi không có hoặc phiên hết hạn.

## Khác với bản cũ

| Bản cũ (ducbui)                                               | Bản mới                                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Hiển thị dữ liệu mẫu trong bộ nhớ; gọi BE nền chỉ để thử      | Dữ liệu và thao tác lấy từ API thật; lỗi hiện thông báo và nút thử lại, không dùng dữ liệu mẫu |
| Đánh giá và báo cáo chỉ ghi vào bộ nhớ ("trong bản minh họa") | REV-01 và REP-01 gửi lên backend                                                               |
| Hộp thoại bản đồ Mapbox cho từng quán                         | Liên kết Google Maps theo tọa độ                                                               |
| Tải ảnh giả lập (đọc ra data URL)                             | Tải ảnh thật (MEDIA-01)                                                                        |
| Số like/dislike hiển thị trên thẻ món                         | Không hiển thị                                                                                 |

## Giới hạn hiện tại

- **Impressions (IMP-01):** FE chưa báo các món đã hiển thị cho reco; xếp hạng cá nhân hóa của DISH-01 vẫn hoạt động nhưng bộ đếm hiển thị chưa được cập nhật. Sẽ làm cùng bộ theo dõi hiển thị của Traveler.
- Chưa có lọc theo khoảng cách (cần vị trí người dùng), `excludeTagIds`, `district`, `restaurantId` trong danh sách món.
- Quay món (DISH-03) và trang chủ HOME-01 không thuộc nhóm này.
- Task Jira của ducbui dùng dữ liệu mẫu; quy tắc dự án cấm màn dùng dữ liệu mẫu và các API đã có ở backend, nên màn mới gọi API thật ngay.

## Kiểm tra

| Kiểm tra                                   | Kết quả                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/explore.test.ts`                    | 16 test: nhãn và định dạng, giờ mở cửa từ Thứ hai, bộ lọc ↔ URL, kiểm tra form và lỗi theo `errorCode`, allowlist proxy (đọc công khai, ghi chỉ POST đánh giá/báo cáo), `queryString`, dịch vụ gọi đúng đường dẫn                                                        |
| `tests/browser/explore.spec.ts` (API stub) | 19 test: khách và Traveler (token), bộ lọc trong URL, "Xem thêm" và cursor hết hạn, thử lại khi lỗi, chi tiết món và quán, tab thực đơn/đánh giá/thông tin, lọc theo sao và ảnh, viết đánh giá và tải ảnh, báo cáo, 409, quyền theo vai trò, không tràn ngang 320–1440px |
| Mapbox                                     | Không có request nào: backend được stub, trang không dùng bản đồ                                                                                                                                                                                                         |
| Backend thật (`test:live`)                 | Chưa chạy                                                                                                                                                                                                                                                                |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (781341 byte, sửa lần cuối 2026-10-26 18:28, nội dung không đổi giữa hai lần).

- Sheet "Backend API": DISH-01 (r20), DISH-02 (r21), REST-01 (r23), REST-02 (r24), REST-03 (r25), REST-04 (r26), REV-01 (r27), REP-01 (r28), CAT-02 (r18).
- Sheet "Chi tiết Request-Response": DISH-01 (r61..r63), DISH-02 (r64), REST-01 (r77..r81), REST-02 (r82), REST-03 (r83..r84), REST-04 (r85..), REV-01 (r93..r97), REP-01 (r98..r102), MEDIA-01 (r51..r53), CAT-02 (r54).
- Sheet "DTO": Tag (r63), RestaurantMini (r67), DishCard (r74), DishDetail (r85), BusinessHour (r90), RestaurantCard (r93), RestaurantDetail (r108), ReviewReply (r164), Review (r168), Paged (r303), UserSummary (r7). Sheet "Mã lỗi": `INVALID_CURSOR`, `VALIDATION_FAILED`, `REVIEW_ALREADY_EXISTS` (409), `REPORT_ALREADY_PENDING` (409).

Đối chiếu code backend: `DishesController` (`GET dishes`, `GET dishes/{dishId:int}`), `RestaurantsController` (`GET`, `GET {id}`, `GET {id}/menu`, `GET {id}/reviews`, `POST {id}/reviews` với `[Authorize(Roles = "TRAVELER,Traveler")]`, trả `201`), `RestaurantReportsController` (`POST api/v1/restaurants/{id}/reports`, `201`), `TagsController` (`[AllowAnonymous]`) và các DTO `DishCardDto`, `DishDetailDto`, `RestaurantMiniDto`, `RestaurantCardDto`, `RestaurantDetailDto`, `ReviewDto`, `ReviewReplyDto`, `RestaurantReviewsDto`, `CreateRestaurantReviewRequestDto`, `CreateRestaurantReportRequestDto`. Method, đường dẫn, tên và kiểu trường, enum, mã trạng thái và mã lỗi khớp với FE.
