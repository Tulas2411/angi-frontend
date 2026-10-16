# Nhập địa chỉ theo mô hình hai cấp

Các ô tỉnh/thành dùng Provinces Open API V2, gồm 34 tỉnh/thành sau sáp nhập tháng 07/2025. Form đăng ký và hồ sơ nhà hàng chỉ còn địa chỉ chi tiết, tỉnh/thành và phường/xã.

- Chọn tỉnh/thành, sau đó nhập phường/xã để tìm gợi ý trực thuộc tỉnh đó. Có thể tìm không dấu và chọn bằng chuột hoặc phím mũi tên/Enter.
- Đổi tỉnh/thành sẽ xóa phường/xã đang nhập để tránh lưu sai địa chỉ. Tải danh mục không tự chuyển đổi hồ sơ cũ. Tên tỉnh cũ không còn trong V2 vẫn được giữ nguyên cho đến khi chủ quán sửa.
- Nếu API gợi ý lỗi, có thể nhập tên đầy đủ bằng tay và tải lại danh sách mà không mất nội dung. Gợi ý không thay đổi tọa độ đã chọn trên bản đồ.
- Các ô tìm địa điểm, điểm đến lịch ăn và tìm nhà hàng cũng dùng danh mục tỉnh/thành V2.

FE lấy tỉnh/thành qua `GET /api/locations/provinces`. Phường/xã được lấy qua `GET /api/locations/provinces/{code}/wards`, tương ứng `https://provinces.open-api.vn/api/v2/p/{code}?depth=2`. Chỉ tải phường/xã của tỉnh được chọn; không tải cây hành chính toàn quốc. Mã hành chính phục vụ gợi ý, không được gửi thay cho tên trong hồ sơ nhà hàng.

## Đồng bộ backend và hợp đồng API

Yêu cầu ngày 16/10/2026 thay thế việc bắt buộc nhập quận/huyện. Backend OWN-01 chấp nhận thiếu hoặc `null` ở `district`; OWN-03 cho phép xóa giá trị cũ bằng `district: null`. Trường dữ liệu này vẫn được giữ để đọc hồ sơ cũ. Cột database đã cho phép null nên không cần migration.

Khi đăng ký mới, FE không gửi `district`. Khi chỉnh tỉnh/thành hoặc phường/xã của hồ sơ cũ, FE gửi `district: null`; sửa các thông tin khác không tự xóa địa chỉ cũ. Phường/xã vẫn là trường tùy chọn theo hợp đồng hiện có.

API Design v1.8 hiện còn đánh dấu `district` bắt buộc ở OWN-01 và không cho null trong mô tả OWN-03. Đây là chênh lệch tài liệu cần cập nhật theo yêu cầu mới, không được che bằng cách điền giả quận/huyện. Chi tiết đối chiếu và kết quả kiểm thử nằm trong [verification.md](verification.md).

Sau khi lấy thay đổi, khởi động lại FE và backend để dùng cùng hợp đồng mới. Nếu dùng Docker local, chạy lại dịch vụ API theo cấu hình local của bạn; dữ liệu địa chỉ cũ được giữ nguyên.
