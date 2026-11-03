# Tổng quan nhà hàng (owner)

Trang `/restaurant` (`src/features/owner/owner-overview-page.tsx`) chỉ dùng dữ liệu OWN-02. Nhánh riêng: `feat/owner-overview-profile`, tạo từ `origin/dev`; thay đổi để chủ dự án tự review và commit.

## Bố cục card hồ sơ

- **Ảnh bìa** (`coverUrl`) là banner tràn viền ở đầu card (tỉ lệ 4:1, dưới 900px là 5:2), kiểu ảnh bìa trang cá nhân Facebook/YouTube. Góc dưới phải có nút **Đổi ảnh bìa** (hoặc **Thêm ảnh bìa** khi chưa có) dẫn tới `/restaurant/profile?tab=photos`. Chưa có ảnh bìa thì hiện nền nhạt với dòng "Chưa có ảnh bìa".
- Cột trái là **thư viện ảnh nhà hàng** (`images`, theo thứ tự chủ quán sắp): một ảnh lớn (tối thiểu 240px, co giãn để cột ảnh cao bằng cột thông tin; dưới 900px là 4:3), hàng thumbnail (5 cột) để đổi ảnh lớn (`aria-pressed` đánh dấu ảnh đang xem), cuối cùng là dòng "Ảnh nhà hàng · N" kèm link **Quản lý ảnh**. Ảnh bìa không được ghép vào thư viện. Chưa có ảnh thì hiện khung nét đứt kèm link **Thêm ảnh**.
- Tên nhà hàng không lặp lại trong card vì đã có ở tiêu đề trang (`h1`). Phần giới thiệu mở đầu bằng ba badge trạng thái độc lập theo thứ tự xác minh, hoạt động, kiểm duyệt (component `RestaurantStatusBadges`, danh sách có nhãn truy cập "Trạng thái nhà hàng"; mỗi badge chỉ hiện giá trị, tên trạng thái nằm ở `title` khi rê chuột), rồi `description` (giữ xuống dòng của chủ quán, chạy hết bề ngang cột, tối đa 3 dòng trên màn rộng và 5 dòng dưới 900px; toàn văn nằm ở `title`). Khi chưa có mô tả, hiện gợi ý thêm mô tả trong Quản lý hồ sơ.
- Danh sách thông tin: địa chỉ (`addressLine`, `ward`, `provinceName`), và chỉ khi có giá trị thì hiện điện thoại (`tel:`), email (`mailto:`), website (mở tab mới, ẩn `http(s)://`).
- Nút **Quản lý hồ sơ** nằm dưới cùng, ghim đáy cột thông tin cho thẳng hàng với dòng "Ảnh nhà hàng". Vùng nội dung dưới ảnh bìa có padding `--space-6`; hai cột cao bằng nhau.

Card "Trạng thái nhà hàng" riêng đã bỏ; lưới trạng thái đầy đủ (`RestaurantStatusGrid`) vẫn dùng ở trang Trạng thái hoạt động. Dưới 900px nội dung xếp một cột: trạng thái, mô tả và thông tin nằm ngay dưới ảnh bìa, thư viện ảnh xuống sau.

## Kiểm thử

`tests/browser/owner-overview.spec.ts` (chạy trong `npm run test:owner`) kiểm tra badge, mô tả, liên hệ, ảnh bìa, thư viện ảnh và các trạng thái trống. `tests/live/owner.spec.ts` chờ trang tải xong bằng danh sách "Trạng thái nhà hàng" thay cho tiêu đề card cũ.
