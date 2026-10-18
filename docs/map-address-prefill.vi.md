# Tự điền địa chỉ khi lưu vị trí nhà hàng

Ngày sửa: **18/10/2026**. Nhánh: `feat/ANGI-36-prefill-address-from-map`, tạo từ `origin/dev`, không theo dõi nhánh dev/main. Phạm vi gồm đăng ký nhà hàng (ANGI-36/F-43) và sửa hồ sơ (ANGI-43/F-44), cả live/demo.

## Hành vi

1. Mở **Chọn vị trí trên bản đồ**, tìm quán hoặc chấm một vị trí, nhập tọa độ hay dùng vị trí hiện tại.
2. Bấm **Lưu vị trí**. Hệ thống hiển thị tiến trình và tra địa chỉ bằng Mapbox Geocoding V6 reverse cho đúng tọa độ đã chọn.
3. Địa chỉ số nhà/đường điền vào **Địa chỉ**. Tỉnh/thành và phường/xã được đối chiếu với danh mục Provinces Open API V2 theo tỉnh rồi điền bằng tên chuẩn.
4. Địa chỉ tìm được thay địa chỉ cũ trong bản nháp; tên quán/điện thoại/website đã nhập vẫn giữ nguyên. Người dùng có thể sửa lại số nhà hoặc thông tin chi tiết sau khi đóng modal.
5. Chỉ bấm **Đăng ký nhà hàng** hoặc **Lưu thay đổi** mới gửi các dữ liệu đó tới OWN-01/OWN-03.

Ghim giữ tọa độ người dùng đã chấm, không dịch sang tọa độ của căn nhà/đường gần đó do geocoder trả về. Đóng modal, đổi điểm hoặc sửa tọa độ khi đang lấy địa chỉ sẽ hủy/bỏ kết quả cũ. Các nút tìm/chọn không tự gửi đăng ký hay PATCH hồ sơ.

## Dữ liệu thiếu và giới hạn

- Không tự tra địa chỉ khi gõ, rê bản đồ hoặc zoom. Mỗi lần bấm lưu chỉ gọi tối đa một reverse lookup. Điểm đã có đủ địa chỉ chuẩn trong bộ nhớ form được dùng lại nếu không đổi lựa chọn.
- Chỉ điền phường/xã khi tên đối chiếu được duy nhất trong tỉnh đang chọn. Không suy đoán địa giới sáp nhập, không đưa tên quận/huyện vào ô phường/xã. Dữ liệu Mapbox chưa cập nhật có thể cần người dùng chọn lại từ gợi ý.
- Nếu tìm được tỉnh mới nhưng chưa tìm được phường/xã, ô phường/xã được xóa để tránh giữ nhầm tên của vị trí cũ.
- Nếu Mapbox lỗi, hết lượt, thiếu token hoặc không có địa chỉ, tọa độ vẫn được chọn và có thông báo phần cần kiểm tra. Các ô chưa có dữ liệu mới có thể giữ giá trị người dùng nhập để bổ sung thủ công. Không âm thầm báo đã điền đủ.
- Nếu danh mục tỉnh/phường chưa tải được, vẫn có thể nhận địa chỉ đường; hệ thống nhắc kiểm tra phần hành chính. Danh mục dùng các route/cơ chế cache hiện có, không thêm provider thứ hai.
- Reverse dùng `permanent=true` vì địa chỉ có thể được lưu vào hồ sơ ANGI. Quyền dùng permanent tùy cấu hình tài khoản Mapbox; một public token tải được bản đồ không xác nhận quyền này. Theo [tài liệu Mapbox](https://docs.mapbox.com/api/search/geocoding/#storing-geocoding-results), permanent yêu cầu tài khoản có thẻ hợp lệ hoặc enterprise contract. Không tự hạ xuống kết quả temporary để lưu lâu dài.

## Hợp đồng và kiểm tra source

- Nguồn ANGI: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, **Backend API** hàng 58/60 (OWN-01/03), **DTO** hàng 97/99/113 (addressLine/provinceName/ward), **JSON mẫu** request OWN-01 hàng 1746–1768 và OWN-03 hàng 1899–1914; **Mã lỗi** hàng 10 (`VALIDATION_FAILED`). Đã mở lại từ disk sau khi sửa code ngày 18/10/2026; không có bản mới hơn trong các thư mục tài liệu BE/workspace. SHA-256: `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`.
- Request builder hiện có tiếp tục gửi riêng `addressLine`, `provinceName`, `ward`, `latitude`, `longitude`; không gửi `addressContext`, `addressDetails`, thông báo UI hay response provider. OWN-03 giữ quy tắc chỉ gửi trường đã đổi; xóa ward dùng `null`.
- Validation BE đọc tại `RegisterRestaurantRequestDtoValidator` và `UpdateRestaurantRequestDtoValidator`: địa chỉ 255 ký tự; tỉnh/phường 100; latitude −90..90, longitude −180..180. FE không cắt bớt địa chỉ để vượt validation.
- Workbook cũ còn ghi `district*` ở OWN-01, trong khi BE hiện tại chỉ kiểm tra chiều dài khi có district. Luồng hai cấp theo yêu cầu trước của chủ dự án tiếp tục bỏ district khi đăng ký; PATCH giữ cơ chế hiện có để xóa dữ liệu district cũ khi đổi tỉnh/phường. Không thêm lại ô quận/huyện trong lần sửa này.
- Nguồn provider: [Mapbox V6 reverse](https://docs.mapbox.com/api/search/geocoding/#reverse-geocoding), [cấu trúc Search Box context](https://docs.mapbox.com/api/search/search-box/). Chỉ đọc tài liệu, không gọi API provider.

## Trạng thái kiểm thử

**Chưa chạy test, build, lint hoặc TypeScript cho thay đổi này**, theo yêu cầu code-only của chủ dự án với các thay đổi Mapbox, đã ghi trong `.agents/coding_rule.md`. Không đọc token thật, mở map, gọi geocoding hoặc dùng usage Mapbox để kiểm tra. Đã định dạng source và review diff/hợp đồng offline.

Đã viết thêm 6 unit case dùng dữ liệu/fetch giả trong `tests/restaurant-map-address.test.ts` và 2 browser case stub reverse trong `tests/browser/restaurant-registration.spec.ts`; tất cả chưa chạy. Các case bao phủ tách địa chỉ, giữ tọa độ, tên hành chính chuẩn, tên phường mơ hồ/cũ, thay địa chỉ cũ, không đưa metadata vào DTO, lỗi provider và kết quả đến muộn sau khi hủy.

## Bạn tự kiểm thử

1. Vào `/restaurant/register` với Owner chưa có nhà hàng. Chọn một điểm có địa chỉ và lưu. Kiểm tra ba ô địa chỉ, tọa độ giữ nguyên và chưa có request OWN-01.
2. Chọn một điểm khác rồi lưu, kiểm tra địa chỉ cũ được thay và phường/xã cũ không còn nếu không tìm được phường mới. Chỉnh lại số nhà nếu cần.
3. Tại `/restaurant/profile`, đổi pin rồi lưu vị trí. Kiểm tra bản nháp; chỉ khi bấm **Lưu thay đổi** mới có PATCH. Tải lại để kiểm tra dữ liệu lưu.
4. Chọn điểm, bấm lưu rồi đóng modal trước khi tra xong. Mở lại, xác nhận kết quả muộn không ghi đè lựa chọn/form.
5. Mô phỏng reverse trả lỗi hoặc tên phường cũ: phải giữ pin, báo phần cần bổ sung và còn nhập tay/gợi ý tỉnh/phường. Form cuối vẫn áp dụng validation hiện có.
6. Trong Network, không có `/geocode/v6/reverse` khi chỉ gõ hoặc rê/zoom; bấm **Lưu vị trí** mới có tối đa một request. Chức năng tương tự trên màn demo.
