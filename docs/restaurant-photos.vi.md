# Hồ sơ nhà hàng — tab Hình ảnh

Tab `/restaurant/profile?tab=photos` (`src/features/owner/restaurant-profile-page.tsx`) gửi ảnh qua OWN-03 (`coverMediaId`, `imageMediaIds`), ảnh được tải lên trước bằng MEDIA-01. Nhánh riêng: `feat/owner-overview-profile`; thay đổi để chủ dự án tự review và commit.

## Ảnh bìa

- Một khung duy nhất (`RestaurantCoverField`, `src/features/owner/restaurant-cover-field.tsx`), tỉ lệ 4:1 giống banner ở trang tổng quan để chủ quán thấy đúng phần ảnh bị cắt.
- Khung hiện ảnh mới vừa tải, nếu không có thì hiện ảnh bìa đã lưu (trừ khi đang bỏ). Có thay đổi chưa lưu thì góc khung có nhãn **Chưa lưu**.
- **Đổi ảnh bìa** / **Thêm ảnh bìa**: chọn ảnh mới, thay luôn ảnh mới chọn trước đó.
- **Bỏ ảnh bìa**: bỏ ảnh bìa đã lưu cần xác nhận qua modal và gửi `coverMediaId: null` khi lưu; bỏ ảnh vừa chọn (chưa lưu) thì không hỏi.
- **Khôi phục ảnh bìa đã lưu**: chỉ hiện khi có thay đổi và nhà hàng đã có ảnh bìa; bỏ mọi thay đổi ảnh bìa.

## Thư viện ảnh

- Tiêu đề **Thư viện ảnh** kèm số đếm `N / 10`, ảnh đầu tiên có nhãn **Ảnh đầu** (ảnh lớn ở trang tổng quan).
- Sửa từng ảnh (`RestaurantGalleryField`, `src/features/owner/restaurant-gallery-field.tsx`), dựa trên `imageMediaIds` mà OWN-02 trả cùng thứ tự với `images` (API Design Ver1.8, DTO OwnerRestaurant; backend ANGI-42):
  - Mỗi ảnh có nút **←** (đưa lên trước), **→** (đưa ra sau) và **×** (bỏ ảnh); ô **+** (`Thêm ảnh nhà hàng`) tải thêm nhiều ảnh, nối vào cuối, tối đa 10 ảnh.
  - Thay đổi chỉ là bản nháp; **Lưu thay đổi** gửi OWN-03 `imageMediaIds` là danh sách cuối cùng (ảnh cũ giữ mã cũ, ảnh mới là mã MEDIA-01). Danh sách trùng với bản đã lưu thì không gửi.
  - **Khôi phục thư viện đã lưu** bỏ mọi thay đổi thư viện. **Xóa toàn bộ ảnh** hỏi xác nhận, lưu thì gửi `imageMediaIds: []`.

## Mã nguồn chung

Phần kiểm tra file (JPG/PNG/WEBP, tối đa 5 MB, tối đa 10 ảnh — khớp BE), tải lần lượt và thử lại nằm trong hook `useRestaurantImageUpload` (`restaurant-image-upload.tsx`), dùng chung cho `RestaurantImageUpload` (đăng ký), khung ảnh bìa và thư viện ảnh.

## Kiểm thử

`tests/browser/restaurant-profile.spec.ts` (`npm run test:map`): bỏ ảnh bìa gửi `coverMediaId: null`; thư viện bỏ một ảnh, thêm ảnh, đưa ảnh mới lên đầu, khôi phục rồi làm lại và lưu gửi đúng `imageMediaIds`; khung ảnh bìa đúng tỉ lệ 4:1, đổi ảnh, khôi phục, bỏ ảnh vừa chọn rồi lưu ảnh mới.
