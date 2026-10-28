# Thông báo (`/notifications`) và Hôm nay ăn gì? (`/roll`)

Nhóm 3 của việc chuyển các màn cũ của ducbui sang giao diện hiện tại. Màn thông báo được làm lại và nối vào API thật; các màn cũ dùng dữ liệu mẫu (`ProfileViewPage`, `PreferencesPage`, `NotificationsPage`) đã bị xóa.

| Màn              | Use case                                                | API                                                                                                                  | Ai dùng                  |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `/notifications` | F-09 View Notifications, F-10 Mark Notification as Read | NOTI-01 `GET /me/notifications`, NOTI-02 `GET /me/notifications/unread-count`, NOTI-03 `POST /me/notifications/read` | Mọi vai trò đã đăng nhập |
| `/roll`          | F-18 Roll Dish                                          | DISH-03 `POST /dishes/roll`, DISH-01 `GET /dishes`, CAT-02 `GET /tags`                                               | Traveler                 |

Mã nguồn: `src/features/notifications/` và `src/features/roll/`. Route nằm trong `src/app/(protected)/(app)/`, dùng khung `AppShell` như trang Tài khoản.

## Thông báo

- **Chuông trên header** (cạnh avatar, mọi trang khi đã đăng nhập): số chưa đọc từ NOTI-02, tối đa hiển thị `99+`. Số được đếm lại khi chuyển trang, khi quay lại tab và ngay sau khi đánh dấu đã đọc. Lỗi khi đếm chỉ ẩn con số, không chuyển người dùng sang trang đăng nhập (`getOptional`).
- **Danh sách:** mới nhất trước, 20 thông báo mỗi trang, tab "Tất cả" và "Chưa đọc" (`isRead=false`); bộ lọc và trang nằm trên URL (`?filter=unread&page=2`). Thông báo chưa đọc có chấm màu coral, nền trắng và tiêu đề đậm.
- **Đánh dấu đã đọc:** nút "Đã đọc" trên từng dòng (`ids: [id]`), mở một thông báo cũng đánh dấu nó đã đọc rồi mới chuyển trang, và nút "Đánh dấu tất cả đã đọc" (`all: true`).
- **Thông báo dẫn tới đâu** (theo `type` và `data`):

  | `type`                                             | Mở                                    |
  | -------------------------------------------------- | ------------------------------------- |
  | `BLOG_*`                                           | `/guides/{blog_id}`                   |
  | `ROADMAP_GENERATED`                                | `/roadmaps/{roadmap_id}`              |
  | `REVIEW_REPLIED`                                   | `/restaurants/{restaurant_id}`        |
  | `VERIFICATION_*` (chủ nhà hàng)                    | `/restaurant/verification?tab=status` |
  | `MENU_*` (chủ nhà hàng)                            | `/restaurant/menu`                    |
  | `RESTAURANT_REVIEWED` (chủ nhà hàng)               | `/restaurant/reviews`                 |
  | `RESTAURANT_*` khác (chủ nhà hàng)                 | `/restaurant/profile`                 |
  | `REPORT_RESOLVED`, `ACCOUNT_SANCTIONED`, loại khác | Chỉ hiển thị, không có liên kết       |

- Các đường dẫn thông báo cũ trong khung làm việc cũ (`/restaurant/notifications`, `/moderation/notifications`, `/administration/notifications`) chuyển sang `/notifications`.

**Chênh lệch tài liệu:** API Design v1.8 ghi ví dụ `data` dạng camelCase (`{"blogId": 45}`), còn backend lưu snake_case (`blog_id`, `roadmap_id`, `restaurant_id`). FE đọc được cả hai dạng; nên sửa lại ví dụ trong API Design.

## Hôm nay ăn gì? (Roll Dish, `/roll`)

F-18, chỉ Traveler. Giữ bố cục của ducbui (nhãn nhỏ, tiêu đề, bốn tab, dải thẻ chạy dưới mũi tên, thẻ "Chốt món này nhé!"), nhưng chạy trên dữ liệu thật thay cho 5 món mẫu:

- **Tab → điều kiện của DISH-03** `POST /dishes/roll`: "Món Việt" không thêm điều kiện (mọi món trên ANGI); "Ăn nhẹ" là `mealTime: "snack"`; "Ăn chay" là `tagIds` của thẻ `dietary` có tên hoặc mã chứa "chay"/"vegetarian" (lấy từ CAT-02 `GET /tags`, vì mã thẻ là dữ liệu trong DB); "Dưới 50k" là `maxPrice: 50000`. Không có thẻ chay thì tab báo "Chưa có thẻ món chay" thay vì roll.
- **Dải thẻ:** các món thật cùng điều kiện từ DISH-01 `GET /dishes?limit=8` (5 thẻ đầu). Khi roll xong, món được chọn nằm giữa, dưới mũi tên, các thẻ khác mờ đi. Dải quay ít nhất 1,6 giây (bỏ qua khi người dùng bật giảm chuyển động).
- **Thẻ kết quả:** tên món, "Khoảng {giá}", quán · tỉnh/thành · điểm đánh giá, mô tả; "Xem quán ăn", "Xem món" và "Roll lại". "Roll lại" gửi `excludeDishIds` gồm các món đã ra trong lượt (tối đa 50); đổi tab là bắt đầu lượt mới.
- **Lỗi:** `404 NO_CANDIDATE` khuyên đổi lựa chọn và có nút "Roll lại từ đầu"; lỗi khác có "Thử lại" (giữ nguyên lượt). Món roll ra được backend tự ghi impression (RECO-06).
- **Giao diện:** CSS riêng trong `src/features/roll/roll-dish.css` dùng token chung, không còn nằm trong `legacy-workspace.css`. Thẻ theo homepage: nền trắng, bo 24px, không viền, bóng mềm hai lớp; tiêu đề dùng Fraunces 900. Bản mock cũ (`RollDishPage` trong `roadmaps/pages.tsx`, `roll-dish-service.ts`) đã bị xóa; `/demo/traveler/roll` chuyển sang `/roll`.
- **Focus thẻ (28/10/2026):** bóng nghỉ dùng cùng công thức với card khẩu vị trên homepage; hover làm thẻ nổi lên, bóng rộng hơn, các thẻ còn lại chỉ blur nhẹ 3px, giữ nguyên độ sáng và opacity. Focus bàn phím có cùng phản hồi và viền rõ. Khi quay dải thẻ, nút mở chi tiết bị khóa; bản sao dùng cho animation không nhận focus. Chế độ giảm chuyển động bỏ hiệu ứng nâng/zoom.
- **Popup chi tiết món:** bấm thẻ thường hoặc món đã roll mở `RollDishDialog` dùng `Dialog` chung. Chỉ khi bấm mới gọi DISH-02 `GET /dishes/{dishId}` qua `exploreService.dish`; hover không gọi API. Modal có ảnh bìa/ảnh phụ, giá, mô tả, tag, tình trạng món và thông tin quán từ BE; có link xem quán/trang món. Mở lại sẽ đọc dữ liệu mới. Đang tải có skeleton; lỗi mạng có Thử lại; `DISH_NOT_FOUND` báo món không còn hiển thị, không dùng dữ liệu mẫu. Escape, nút đóng và Tiếp tục roll giữ nguyên kết quả/lượt roll và trả focus về thẻ. Modal vào/ra nhẹ, backdrop blur; giảm chuyển động tắt transition.
- **Lối vào:** menu tài khoản của Traveler ("Hôm nay ăn gì?").

## Chưa làm được

- **Khảo sát khẩu vị (F-17, PREF-02/03):** API yêu cầu `optionCode` có sẵn trong `recommendation.survey_option_vectors`, nhưng bộ câu hỏi và danh sách mã thuộc task T149 (nhóm Reco) và chưa được bàn giao; tài liệu chỉ có một mã mẫu `broth_rich`. FE không tự đặt mã. Màn "Khẩu vị của bạn" cũ cũng không có API (không có endpoint cập nhật sở thích), nên đã bỏ.
- **Hồ sơ:** màn "Hồ sơ của tôi" cũ hiển thị lộ trình và bài viết mẫu. Nghiệp vụ thật (ME-01..03) đã có ở `/account`; lộ trình và bài viết có ở `/roadmaps` và `/guides/mine`.

## Kiểm thử

- Unit: `tests/notifications.test.ts`, `tests/roll.test.ts`.
- Trình duyệt (stub API ở cổng 5164, không gọi Mapbox hay backend chung): `tests/browser/notifications.spec.ts`, `tests/browser/roll.spec.ts`, đã thêm vào `playwright.config.ts`.

### Kiểm tra cập nhật card và modal Roll — 28/10/2026

- ESLint các file sửa và `tsc --noEmit`: đạt.
- `tests/roll.test.ts`: 6 test đạt. `tests/browser/roll.spec.ts`: 11 test đạt trên bản build production cô lập, bao gồm 7 ca roll cũ và 4 ca focus/modal/lỗi/responsive mới. Không gọi BE thật, Recommendation, AI hay Mapbox trong các test này.
- Đã xem ảnh desktop 1440px và modal mobile 320px; thêm kiểm tra 390px, không tràn ngang. Ảnh kiểm tra nằm trong thư mục tạm `angi-roll-card-preview` của Windows. Server kiểm thử riêng ở 3001/5164 đã dừng; không tác động server người dùng hoặc `angi-frontend-union`.
- Đối chiếu trước và **mở lại sau khi code/kiểm thử**: workbook `ANGI_API_Design_Ver1.8.xlsx` lấy bằng thao tác đọc `origin/dev:.docs/ANGI_API_Design_Ver1.8.xlsx` của BE, commit `951115cbf2c758d47c9c74f2c37deb6d61b7ffc7`; SHA-256 `EF1E765849999D771A910152EEAAB9B8BFD2BC8D356F3B450059B6877605F21C`, không đổi trong task.
- Vùng đối chiếu: `Backend API` r21–r22 (DISH-02/03), `Chi tiết Request-Response` r64 và phần DISH-03 bắt đầu r65, `DTO` r67–r107 (DishCard/DishDetail/RestaurantMini/RestaurantCard), `JSON mẫu` r440–r483 (DISH-02); có đọc sheet `Mã lỗi`. Mã `DISH_NOT_FOUND` được quy định trực tiếp tại `Backend API` r21. Controller `Discovery/DishesController` trên cùng ref đã có GET chi tiết public, 200 và 404 đúng hợp đồng. Không thêm endpoint, sửa proxy hay sửa BE.
- Hợp đồng BE hiện dùng `ward`; popup đọc `ward` và `provinceName`, không dùng `district`. Việc chuyển toàn bộ type Explore cũ từ `district` sang `ward` vẫn là phần tồn đọng đã ghi trong handoff, ngoài phạm vi chỉnh card lần này.

Điều chỉnh tiếp theo cùng ngày: theo yêu cầu mới, bỏ `brightness(0.28)` và giảm blur của các thẻ xung quanh từ 12px xuống 3px. Chỉ đổi CSS và kỳ vọng của test focus, không có thay đổi API/mapping. Đã kiểm tra định dạng; chưa chạy lại browser suite cho lần chỉnh nhỏ này. Kết quả 11 test phía trên thuộc lần kiểm tra trước khi giảm blur.
