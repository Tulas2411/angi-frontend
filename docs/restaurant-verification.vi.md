# ANGI-61 — F-47 Gửi hồ sơ xác minh nhà hàng

## Phạm vi đã triển khai

- Mở `/restaurant/verification` sau khi đăng nhập bằng tài khoản Restaurant Owner.
- Đọc nhà hàng và hồ sơ gần nhất bằng OWN-02. Nhà hàng `unverified` được nộp lần đầu; `pending`, `verified`, `rejected` chỉ xem thông tin và hướng dẫn phù hợp.
- Nhập tên pháp lý (bắt buộc, tối đa 255 ký tự), số giấy phép kinh doanh (bắt buộc, tối đa 50), mã số thuế (không bắt buộc, tối đa 20), ghi chú (không bắt buộc, tối đa 1.000).
- Chọn tài liệu bằng ô dấu cộng. JPG/PNG/WEBP tối đa 5 MB mỗi ảnh; PDF tối đa 10 MB. Tệp rỗng và định dạng khác bị chặn trước khi tải lên.
- Tải tài liệu bằng MEDIA-01, multipart gồm `file` và `purpose=verification_doc`. Chỉ gửi ID media hợp lệ trong hồ sơ, không gửi tên tệp hay URL thay cho ID.
- Hỗ trợ 5 loại: `business_license`, `food_safety_cert`, `id_card`, `storefront_photo`, `other`. Phải có ít nhất một `business_license`; API hiện không quy định tối đa 5 tài liệu.
- Gửi OWN-06 sau popup xác nhận; trong lúc gửi không thể gửi lặp. Thành công chuyển sang chờ duyệt và hiển thị hồ sơ API trả về.
- Lỗi tải lên có thể thử lại các tệp còn lại; không tải lại tệp đã thành công. Lỗi gửi giữ bản nháp, ID tài liệu và hiển thị lỗi theo từng trường, kể cả `Documents[n].MediaId`.
- Bỏ tài liệu, hủy bản nháp và tải lại khi có thay đổi đều dùng modal. Bỏ tài liệu chỉ bỏ khỏi bản nháp, không gọi API xóa media.
- Liên kết tài liệu riêng tư chỉ được mở khi người dùng bấm. Khi hết hạn, bấm **Tải lại trạng thái** để lấy URL mới. Hồ sơ thật không được lưu vào localStorage/sessionStorage.

## API được sử dụng

| Mục đích     | Endpoint                                      | Kết quả                                        |
| ------------ | --------------------------------------------- | ---------------------------------------------- |
| Đọc nhà hàng | `GET /api/v1/owner/restaurant`                | 200 `OwnerRestaurant`, có `latestVerification` |
| Tải tài liệu | `POST /api/v1/media`                          | 201 `MediaFile`, `purpose=verification_doc`    |
| Nộp lần đầu  | `POST /api/v1/owner/restaurant/verifications` | 201 `Verification`, `status=pending`           |

Request mẫu từ sheet **JSON mẫu**:

```json
{
  "legalName": "Hộ kinh doanh Bún Bò Bà Diệu",
  "businessLicenseNo": "32A8012345",
  "taxCode": "0401234567",
  "ownerNote": "Bổ sung giấy ATTP",
  "documents": [{ "docType": "business_license", "mediaId": 9001 }]
}
```

`mediaId=9001` chỉ là dữ liệu mẫu; khi thử thật phải dùng ID vừa tải lên bằng chính tài khoản đó. Backend kiểm tra quyền sở hữu và purpose của media. FE không gọi Cloudinary trực tiếp.

Các lỗi trạng thái `VERIFICATION_ALREADY_PENDING`, `RESTAURANT_ALREADY_VERIFIED`, `VERIFICATION_RESUBMIT_REQUIRED` được giải thích bằng tiếng Việt và chặn gửi thêm cho đến khi tải lại trạng thái. `VALIDATION_FAILED` gắn với trường nhập; lỗi mạng/dịch vụ cho phép thử lại. Đăng nhập hết hạn xử lý qua cơ chế session chung.

## Tự kiểm thử

1. Chạy BE và FE theo [hướng dẫn chạy dự án](local-run-and-test-guide.vi.md). Không cần cấu hình env mới cho F-47.
2. Dùng tài khoản Owner có nhà hàng chưa xác minh. Mở `/restaurant/verification` hoặc chọn **Xác minh nhà hàng** trên menu.
3. Thử gửi trống: phải báo thiếu tên pháp lý, giấy phép và tài liệu; chưa gọi OWN-06.
4. Chọn PDF/ảnh hợp lệ, chọn loại tài liệu. Bỏ loại giấy phép khỏi toàn bộ tài liệu: phải chặn gửi.
5. Điền thông tin, bấm gửi, đóng popup: thông tin/tài liệu vẫn còn và chưa có hồ sơ mới.
6. Gửi lại và xác nhận: kiểm tra Network có multipart `purpose=verification_doc`, sau đó POST OWN-06 chỉ có các trường nêu trên. Kết quả 201; trạng thái chờ duyệt. Tải lại trang vẫn thấy kết quả do BE lưu.
7. Thử tài khoản chưa có nhà hàng, nhà hàng đã xác minh/đang chờ/bị từ chối; không được tạo hồ sơ lần đầu trái trạng thái.
8. Thử ngắt BE khi tải/gửi rồi khôi phục: thấy lỗi, dữ liệu đang soạn không mất, thử lại được. Thử trên màn hình điện thoại và điều khiển bằng Tab/Enter/Escape.

Không cần BE để xem form minh họa: mở `/dev/scenarios?state=owner-verification-new`. Mock chỉ lưu metadata trong bộ nhớ; tải lại toàn bộ trang sẽ khôi phục fixture. Owner mặc định ở `/demo/owner/verification` đã xác minh nên không hiện form nộp mới.

Bộ kiểm tra tự động riêng, dùng FE 3001/API stub 5164, chạy lần lượt với các bộ Owner khác:

```powershell
npm test -- tests/restaurant-verification.test.ts
npx playwright test --config=playwright.verification.config.ts
```

Config để trống Mapbox token và chặn các request trình duyệt ra ngoài localhost. Không mở bản đồ, không upload thật, không kiểm tra token Mapbox.

## Giới hạn

F-47 nộp hồ sơ lần đầu và hiển thị hồ sơ gần nhất từ OWN-02. Chưa kết nối danh sách lịch sử OWN-07 (F-48) hoặc gửi bổ sung OWN-08 (F-49). Không hiển thị nút gửi lại giả cho nhà hàng bị từ chối/cần bổ sung. Việc kiểm thử Cloudinary riêng tư, URL có chữ ký và lưu dữ liệu trên BE thật cần được thực hiện thủ công; kiểm tra bằng stub không chứng minh các dịch vụ thật hoạt động.

Kết quả kiểm tra và lần đối chiếu API Design cuối cùng được ghi trong [báo cáo kỹ thuật F-47](restaurant-verification-evidence.md).
