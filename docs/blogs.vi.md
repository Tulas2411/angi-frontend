# Cẩm nang (blog): `/guides`

Các trang blog của ducbui (xem, Bài viết của tôi, viết, sửa, xóa, bình luận, thích, báo cáo) được làm lại theo giao diện hiện tại của dự án và nối vào API thật (BLOG-01..11, REP-02, MEDIA-01). Giao diện cũ (`WorkspaceShell`, `PlatformProvider`, dữ liệu mẫu) của các trang này đã bị xóa.

Mã nguồn nằm trong `src/features/blogs/`:

| File                                                            | Việc                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `blog-types.ts`, `blog-service.ts`                              | DTO và lời gọi API (đọc công khai, ghi cần phiên Traveler)            |
| `blog-rules.ts`                                                 | Bộ lọc ↔ URL, văn bản ↔ HTML, kiểm tra form, lỗi theo `errorCode`     |
| `blog-list-page.tsx`, `my-blogs-page.tsx`                       | `/guides`, `/guides/mine`                                             |
| `blog-detail-page.tsx`, `blog-comments.tsx`, `blog-content.tsx` | `/guides/{id}`: nội dung, lịch ăn đính kèm, thích, bình luận, báo cáo |
| `blog-editor-page.tsx`                                          | `/guides/new` và `/guides/{id}/edit`                                  |
| `blog-cards.tsx`, `blogs.css`                                   | Thẻ bài viết và kiểu dáng                                             |

Dùng chung với nhóm Khám phá: `src/components/domain/report-dialog.tsx` (hộp thoại báo cáo), `image-attachments.tsx` (tải ảnh thật lên), `src/shared/report-rules.ts`. Route nằm trong `src/app/(site)/guides/`, cùng khung `PublicShell` với `/dishes` và `/restaurants`.

## Thiết kế (làm lại với taste-skill)

Các màn blog được dựng lại theo quy trình "app screen" của taste-skill (`design-taste-frontend`), giữ nguyên bảng màu và kiểu chữ của dự án (`--keep palette,type`):

- **Kiểu được chọn:** `editorial-greeting` (seed 899982312): cột nội dung của trang, panel trắng trên nền trang ngăn bằng một đường 1px và không đổ bóng, một bậc tông cho phần bên trong panel (lịch ăn, bình luận), số liệu dạng tabular, màu chỉ ở một hành động chính. Hai hướng "page" được bốc thử (`contact-sheet`, `page-is-the-object`) bị bỏ vì cần hàng chục ảnh hoặc ảnh toàn màn hình mà dữ liệu blog thật không có, và vì đây là màn làm việc bên trong khung chung của site.
- **Danh sách:** tiêu đề là danh từ, dòng xám dưới tiêu đề là dữ kiện từ dữ liệu ("11 bài, mới nhất ngày …"); một thanh lọc gọn; bài đầu trang là bài dẫn (ảnh bìa 7/12 bên trái, chữ 5/12 bên phải; không có ảnh bìa thì chỉ chữ, cỡ lớn hơn, không có ô trống); các bài còn lại là hàng hai cột (ảnh 112px, tiêu đề, trích dẫn hai dòng, tác giả, lượt thích và bình luận với biểu tượng nét mảnh thay cho emoji).
- **Chi tiết:** tiêu đề 32px, dòng tác giả với lượt xem, hành động bên phải; ảnh bìa rộng 21:9 khi có; cột đọc 8/12 với lịch ăn đính kèm ở cột phải 4/12 (bài không có lịch ăn thì một cột đọc 760px ở giữa); bình luận là một panel.
- **Bài viết của tôi:** danh sách một cột, trạng thái là nhãn màu nhạt trên dòng ngay dưới tiêu đề (dòng trích dẫn bị ẩn), lý do kiểm duyệt ngay dưới, "Chỉnh sửa" và "Xóa" là hai icon (bút, thùng rác) ở góc phải trên của card, chỉ hiện khi rê chuột vào card (hoặc khi card có focus).
- **Số liệu:** lượt thích và bình luận nằm ở góc phải dưới của card bài viết (dòng `.blog-row-counts`), không còn nằm cạnh dòng tác giả.
- **Trình soạn thảo:** cột viết 8/12; cột phải 4/12 gồm panel đăng bài (nút chính), ảnh, và lộ trình đính kèm kèm xem trước những gì sẽ được đính (số ngày, số món, tổng chi).
- **Trạng thái:** đang tải là các khối xám phẳng đúng kích thước thật (không hiệu ứng nhấp nháy); lỗi nằm trong khối bị lỗi kèm "Thử lại".
- **Kiểm tra của skill:** `lint.mjs --app` cho 0 FAIL, 3 WARN (đều là viền focus khi dùng bàn phím, giữ lại có chủ ý). Không chạy `inspect.mjs` vì các trang cần backend stub và phiên đăng nhập; thay vào đó đã xem ảnh chụp ở 1440px và 390px qua Playwright.

## Lối vào

- Thanh điều hướng: **Cẩm nang** cho khách và Traveler. Trang chủ có liên kết "Cẩm nang" ở đầu và cuối trang.
- Menu tài khoản của Traveler: **Bài viết của tôi** và **Viết cẩm nang**.
- Trang chi tiết lộ trình có nút **Chia sẻ lộ trình** (Share My Roadmap): mở `/guides/new?roadmap={id}` với lộ trình đã được chọn.

## Hành vi

- **Danh sách (BLOG-01):** tìm theo tiêu đề, sắp xếp mới nhất / phổ biến, lọc "chỉ bài có lịch ăn đính kèm". Bộ lọc và trang nằm trong URL (`?q=&sort=&roadmap=1&page=`), 9 bài mỗi trang, trang vượt quá cuối tự quay về trang cuối. Khách chỉ thấy bài `published`.
- **Chi tiết (BLOG-02, BLOG-03):** tác giả, ngày đăng, lượt xem, ảnh bìa, nội dung, ảnh trong bài, lịch ăn đính kèm (tên lộ trình, ngày bắt đầu, tổng chi, từng ngày là một tab; mỗi món có bữa, tên món, quán là liên kết tới `/restaurants/{id}`, địa chỉ, giá lúc chụp). Nếu lộ trình gốc đã bị xóa thì thêm ghi chú. Bài không tồn tại, đã xóa hoặc bị ẩn (`BLOG_NOT_FOUND`) hiện "Bài viết không còn khả dụng".
- **Nội dung HTML an toàn:** backend trả HTML đã sanitize, nhưng FE không bao giờ đưa chuỗi đó vào `innerHTML`. `BlogContent` đọc bằng `DOMParser` rồi dựng lại React element từ danh sách thẻ cho phép (đoạn, tiêu đề, danh sách, trích dẫn, chữ đậm/nghiêng, liên kết web và mail, ảnh http/https). Thẻ lạ chỉ giữ phần chữ bên trong; `script`, `iframe`, `form`… bị bỏ hẳn; liên kết `javascript:` hoặc `data:` thành chữ thường; thuộc tính sự kiện (`onclick`…) không bao giờ được chép sang.
- **Thích (BLOG-08/09):** Traveler bấm để thích hoặc bỏ thích; số lượt hiển thị là số backend trả về. Khách và vai trò khác chỉ thấy số lượt.
- **Bình luận (BLOG-03/10/11):** danh sách một cấp, cũ nhất trước, 10 bình luận mỗi trang. Traveler gửi bình luận tối đa 1000 ký tự (nhập trống báo lỗi); xong thì nhảy tới trang cuối nơi bình luận mới nằm. Chỉ bình luận của mình có nút xóa, có `ConfirmDialog` ("Xóa bình luận?"). Khách được nhắc đăng nhập.
- **Báo cáo (REP-02):** Traveler (không phải tác giả) báo cáo bài với lý do `spam`, `offensive`, `wrong_info`, `scam`, `other`, mô tả tối đa 1000 ký tự (bắt buộc khi chọn "Lý do khác"), tối đa 5 ảnh bằng chứng (MEDIA-01, `report_evidence`). `REPORT_ALREADY_PENDING` (409) báo báo cáo trước đó đang chờ xử lý; `CANNOT_REPORT_OWN_CONTENT` báo không thể báo cáo bài của chính mình.
- **Bài viết của tôi (BLOG-05):** thẻ bài kèm trạng thái (đang hiển thị, đã bị ẩn, đã bị gỡ) và lý do kiểm duyệt; trạng thái nằm trên dòng ngay dưới tiêu đề, ba tab trạng thái nằm trong URL (`?status=`). Bài đã bị gỡ không có icon chỉnh sửa. Khách bị đưa về `/login`.
- **Xóa bài (BLOG-07):** từ Bài viết của tôi hoặc từ trang chi tiết (tác giả), có `ConfirmDialog` vì xóa là xóa mềm không hoàn tác; `BLOG_NOT_FOUND` xem như đã xóa.
- **Viết bài (BLOG-04):** tiêu đề (bắt buộc, tối đa 255), nội dung (bắt buộc), ảnh bìa (1 ảnh), ảnh trong bài (tối đa 20), lộ trình đính kèm (chọn trong 50 lộ trình mới nhất của RM-02). Ảnh được tải lên ngay (MEDIA-01, `purpose=blog`). Bài đăng ngay, không chờ duyệt; xong thì mở trang chi tiết. Trình soạn thảo là văn bản thuần: một dòng trống sang đoạn mới, xuống dòng giữ nguyên; FE gửi `<p>`/`<br>` với mọi ký tự đặc biệt đã được escape.
- **Sửa bài (BLOG-06):** chỉ gửi những trường thực sự đổi (`title`, `content`, `coverMediaId`, `imageMediaIds`, `refreshRoadmapSnapshot`); không đổi gì thì không gọi API. Ảnh hiện có chỉ có URL nên có nút "Đổi ảnh bìa", "Bỏ ảnh bìa" (`coverMediaId: null`) và "Thay toàn bộ ảnh trong bài". Bài có lộ trình còn tồn tại có hộp "Chụp lại lộ trình theo dữ liệu hiện tại". `BLOG_REMOVED` (409) báo bài đã bị gỡ nên không sửa được; bài của người khác báo "Bạn không có bài viết này để chỉnh sửa".
- **Rời trang khi chưa đăng:** có thay đổi chưa gửi thì bấm liên kết hoặc "Hủy" mở `ConfirmDialog` "Rời trang khi chưa đăng?" ("Ở lại" / "Rời trang"), tải lại trang cũng được trình duyệt nhắc.
- **Phiên:** đọc công khai gửi kèm token khi đã đăng nhập (để có `likedByMe`, `isMine`), gọi ẩn danh khi không có.

## Khác với bản cũ

| Bản cũ (ducbui)                                             | Bản mới                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Dữ liệu mẫu trong bộ nhớ ("bản minh họa")                   | API thật; lỗi hiện thông báo và nút thử lại                         |
| Like, bình luận, báo cáo chỉ đổi dữ liệu trong bộ nhớ       | BLOG-08..11 và REP-02 gửi lên backend                               |
| Ảnh "tải lên" giả lập                                       | MEDIA-01 thật                                                       |
| Lịch ăn đính kèm lấy từ lịch mẫu                            | Lộ trình thật của Traveler (RM-02), backend chụp snapshot (BLOG-04) |
| `/demo/traveler/my-guides`, `/demo/traveler/roadmaps/share` | `/guides/mine`, nút "Chia sẻ lộ trình" ở trang chi tiết lộ trình    |

## Giới hạn hiện tại

- Soạn thảo là văn bản thuần: một bài do client khác viết với định dạng phong phú sẽ mất định dạng (chỉ còn đoạn và xuống dòng) khi tác giả sửa bằng màn này.
- Ảnh hiện có của bài chỉ có URL, nên không sửa từng ảnh được: chỉ giữ nguyên hoặc thay toàn bộ.
- Chưa có tìm theo tác giả (`authorId`) và danh sách bình luận chưa cập nhật tự động khi người khác bình luận.
- Task Jira của ducbui dùng dữ liệu mẫu; quy tắc dự án cấm màn dùng dữ liệu mẫu và các API blog đã có ở backend, nên màn mới gọi API thật ngay.

## Kiểm tra

| Kiểm tra                                 | Kết quả                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/blogs.test.ts`                    | 11 test: văn bản ↔ HTML (escape, đoạn, xuống dòng), kiểm tra form, liên kết an toàn, bộ lọc ↔ URL, mã lỗi, allowlist proxy (đọc công khai, ghi chỉ Traveler, không cho PUT `blogs/{id}`…), lời gọi dịch vụ đúng đường dẫn và method                                                                                                                              |
| `tests/browser/blogs.spec.ts` (API stub) | 21 test: danh sách (khách, tìm, sắp xếp, lọc, phân trang, lỗi), chi tiết (nội dung an toàn, lịch ăn, bình luận), thích/bỏ thích, bình luận và xóa bình luận, báo cáo, tác giả sửa/xóa, vai trò khác, Bài viết của tôi, xóa bài, viết bài với ảnh và lộ trình, "Chia sẻ lộ trình", rời trang, sửa chỉ gửi trường đổi, `BLOG_REMOVED`, không tràn ngang 320–1440px |
| Mapbox                                   | Không có request nào: backend được stub, các trang không dùng bản đồ                                                                                                                                                                                                                                                                                             |
| Backend thật (`test:live`)               | Chưa chạy                                                                                                                                                                                                                                                                                                                                                        |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-26 18:28, nội dung không đổi giữa hai lần).

- Sheet "Backend API": BLOG-01..BLOG-11 (r46..r56), REP-02 (r57), MEDIA-01.
- Sheet "Chi tiết Request-Response": BLOG-01 (r205), BLOG-02 (r210), BLOG-03 (r211), BLOG-04 (r216..r221), BLOG-05 (r222), BLOG-06 (r227..r232), BLOG-07 (r233), BLOG-08 (r234), BLOG-09 (r236), BLOG-10 (r238..r239), BLOG-11 (r240), REP-02 (r241..r245).
- Sheet "DTO": BlogCard (r241), BlogDetail (r252), RoadmapSnapshot (r225), Comment (r260), MyBlogCard (r314), UserSummary (r7). Sheet "Mã lỗi": `BLOG_NOT_FOUND`, `COMMENT_NOT_FOUND`, `NOT_OWNER`, `BLOG_REMOVED`, `ROADMAP_NOT_FOUND`, `REPORT_ALREADY_PENDING`, `CANNOT_REPORT_OWN_CONTENT`, `VALIDATION_FAILED`.

Đối chiếu code backend: `BlogsController` (`GET`, `POST`, `GET {blogId}`, `GET {blogId}/comments`, `PATCH`, `DELETE`, `PUT/DELETE {blogId}/like`, `POST {blogId}/comments`; `[AllowAnonymous]` cho ba lệnh đọc, `TRAVELER` cho phần còn lại), `BlogCommentsController` (`DELETE {commentId}`), `MeBlogController` (`GET me/blogs`), `ReportsController` (`POST blogs/{blogId}/reports`) và các DTO `BlogCardDto`, `BlogDetailDto`, `MyBlogCardDto`, `CommentDto`, `RoadmapSnapshotDto`, `BlogLikeResponseDto`, `CreateBlogRequestDto`, `EditBlogRequestDto` (chỉ trường được gửi mới đổi), `ReportBlogRequestDto`, `CreateReportResponseDto`, cùng `BlogContentSanitizer`. Method, đường dẫn, tên và kiểu trường, enum, mã trạng thái và mã lỗi khớp với FE.
