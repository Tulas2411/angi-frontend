# Nhập địa chỉ ba cấp (tỉnh/thành, quận/huyện, phường/xã)

> Tên file giữ nguyên để liên kết cũ không gãy. Từ ngày 27/10/2026 các ô địa chỉ dùng **danh mục trước sáp nhập** (Provinces Open API **V1**: 63 tỉnh/thành, có cấp quận/huyện), thay cho V2 (34 tỉnh/thành, không có quận/huyện).

## Vì sao đổi

Backend OWN-01 (`RegisterRestaurantRequestDtoValidator`) bắt buộc `district` ("Quận/huyện là bắt buộc."), đúng với API Design v1.8 (sheet "Chi tiết Request-Response" r253: `district` bắt buộc ở OWN-01; r270: không bắt buộc ở OWN-03). Danh mục V2 không có cấp quận/huyện nên form đăng ký không gửi được giá trị hợp lệ. Chủ dự án yêu cầu thêm ô Quận/huyện và dùng lại danh mục cũ.

## Cách hoạt động

- **Tỉnh / thành phố:** `GET /api/locations/provinces` → `https://provinces.open-api.vn/api/v1/` (63 tỉnh/thành, cache 1 ngày).
- **Quận / huyện:** `GET /api/locations/provinces/{code}/districts` → `api/v1/p/{code}?depth=2`. Chỉ tải quận/huyện của tỉnh đã chọn; route kiểm tra mã tỉnh (1–99) và `province_code` của từng quận/huyện.
- **Phường / xã:** `GET /api/locations/districts/{code}/wards` → `api/v1/d/{code}?depth=2`. Chỉ tải phường/xã của quận/huyện đã chọn; route kiểm tra mã quận/huyện (1–999) và `district_code`.
- Route cũ `/api/locations/provinces/{code}/wards` (V2) đã bị xóa.
- Ô nào cũng gõ được tên đầy đủ khi gợi ý lỗi, có nút tải lại danh sách và không mất nội dung đang nhập. Tìm không dấu ("ba dinh" ra "Quận Ba Đình"); "Quận Hải Châu" và "Hải Châu" được xem là một.
- Đổi tỉnh/thành xóa quận/huyện và phường/xã; đổi quận/huyện xóa phường/xã, để không lưu địa chỉ lệch cấp.
- Mã hành chính chỉ dùng để lấy gợi ý; hồ sơ nhà hàng lưu tên.

## Form đăng ký nhà hàng (OWN-01)

- Ô **Quận / huyện \*** bắt buộc (tối đa 100 ký tự), nằm giữa Tỉnh/thành và Phường/xã; FE gửi `district` trong body.
- Lỗi `District` từ backend hiện ngay dưới ô, không còn là thông báo chung.
- Bố cục mới: ba mục "Thông tin nhà hàng", "Địa chỉ và vị trí", "Hình ảnh nhà hàng", mỗi mục có phần giới thiệu ngắn bên trái và khung nhập bên phải (xếp chồng khi màn hình dưới 900px). Trong mục địa chỉ, khối chọn vị trí trên bản đồ đứng đầu (chọn vị trí sẽ điền sẵn địa chỉ), sau đó là địa chỉ chi tiết và ba ô tỉnh/quận/phường trên một hàng. Nút "Hủy" và "Đăng ký nhà hàng" nằm bên phải cuối form.

## Hồ sơ nhà hàng (OWN-03)

Ô Quận/huyện cũng có trong tab Thông tin. `district` được gửi như các trường địa chỉ khác: chỉ khi thay đổi, `null` khi xóa trống. FE không còn tự gửi `district: null` khi chủ quán sửa tỉnh/thành hay phường/xã như cách làm với V2 trước đây.

## Điền địa chỉ từ bản đồ

Khi lưu một điểm mới, FE dùng ngữ cảnh địa chỉ của bản đồ: tỉnh/thành từ `region`, quận/huyện từ `place` hoặc phần "Quận …/Huyện …/Thị xã …" trong địa chỉ đầy đủ, rồi phường/xã từ `locality`/`neighborhood` trong danh sách phường/xã của quận/huyện đó. Không đoán khi có hơn một kết quả trùng tên, và không lấy tên quận/huyện làm phường/xã.

## Ảnh hưởng tới màn khác

Các ô tỉnh/thành ở trang Khám phá, lập lộ trình và trợ lý món ăn dùng chung danh mục, nên giờ cũng gợi ý 63 tỉnh/thành theo tên cũ. Tên tỉnh/thành mà backend dùng để lọc phải khớp tên này.

## Kiểm tra

| Kiểm tra                                                                                                                                                  | Kết quả                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit test (`tests/wards.test.ts`, `provinces.test.ts`, `restaurant-registration.test.ts`, `restaurant-profile.test.ts`, `restaurant-map-address.test.ts`) | Đạt: route quận/huyện và phường/xã V1 (kiểm tra mã, dữ liệu lệch cấp, lỗi nhà cung cấp), cache theo mã cha, đăng ký bắt buộc và gửi `district`, hồ sơ gửi `district` khi đổi, đối chiếu quận/huyện từ bản đồ |
| Spec trình duyệt `restaurant-registration`, `restaurant-profile`, `provinces` (bộ `playwright.map.config.ts`)                                             | Đã cập nhật cho ba cấp nhưng **chưa chạy**, vì bộ này gắn với Mapbox (để chủ dự án tự chạy)                                                                                                                  |
| Ảnh chụp form đăng ký 1440px và 390px (danh mục được stub)                                                                                                | Đã xem                                                                                                                                                                                                       |
| Backend thật                                                                                                                                              | Chưa chạy                                                                                                                                                                                                    |
