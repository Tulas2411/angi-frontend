# ANGI-65 — F-48 Xem trạng thái xác minh

## Cách mở

- Đăng nhập bằng tài khoản Restaurant Owner, vào **Xác minh nhà hàng** → **Trạng thái xác minh**.
- Mở trực tiếp `/restaurant/verification?tab=status` để chọn thẻ trạng thái ngay khi vào trang.
- Màn minh họa không cần BE: `/dev/scenarios?state=owner-verification-history`, `owner-verification-approved` hoặc `owner-verification-feedback`.

## Chức năng

- OWN-02 tiếp tục tải nhà hàng cho trang xác minh dùng chung với F-47. Khi mở thẻ trạng thái, OWN-07 lấy trạng thái hiện tại và toàn bộ lịch sử. FE không thay lỗi API thật bằng fixture.
- **Trạng thái nhà hàng** có `unverified`, `pending`, `verified`, `rejected`. **Trạng thái hồ sơ** có `pending`, `approved`, `rejected`, `needs_more_info`, `cancelled`. Hai trạng thái được hiển thị riêng; không suy ra trạng thái nhà hàng từ một hồ sơ cũ.
- Hồ sơ gần nhất hiển thị thông tin pháp lý, ngày gửi, ghi chú của chủ nhà hàng, người duyệt, ngày phản hồi, phản hồi của người duyệt và tài liệu đính kèm. Giá trị chưa có được ghi rõ, không tạo phản hồi/người duyệt giả.
- Lịch sử hiển thị mới nhất trước theo thứ tự BE trả về. **Xem hồ sơ #...** mở popup chi tiết chỉ đọc; nếu có `previousId` trong lịch sử, có thể xem tiếp hồ sơ trước.
- URL tài liệu có chữ ký chỉ được mở khi bấm liên kết; không tự tải ảnh/PDF hoặc avatar người duyệt. **Tải lại lịch sử** gọi lại OWN-07 để lấy trạng thái và URL mới. Không polling tự động.
- `items: []` là chưa có hồ sơ. `404 RESTAURANT_NOT_FOUND` là chưa có nhà hàng. Lỗi dịch vụ có nút thử lại và không bị hiển thị như lịch sử rỗng.
- Nhà hàng chưa xác minh có thể chuyển sang chuẩn bị hồ sơ F-47. F-49 đã bổ sung **Gửi lại hồ sơ** cho hồ sơ mới nhất bị từ chối/cần bổ sung qua OWN-08; xem [hướng dẫn gửi lại](verification-resubmission.vi.md).

## API

```http
GET /api/v1/owner/restaurant/verifications
```

Không có body hoặc tham số phân trang. Kết quả 200 theo API Design v1.8:

```json
{
  "success": true,
  "message": null,
  "errorCode": null,
  "data": {
    "verificationStatus": "pending",
    "items": [
      {
        "id": 21,
        "restaurantId": 7,
        "status": "pending",
        "legalName": "Hộ kinh doanh Bún Bò Bà Diệu",
        "businessLicenseNo": "32A8012345",
        "taxCode": "0401234567",
        "ownerNote": "Bổ sung giấy ATTP",
        "documents": [
          {
            "docType": "business_license",
            "mediaId": 9001,
            "url": "https://cdn.angi.vn/private/9001.pdf?sig=..."
          }
        ],
        "previousId": null,
        "submittedAt": "2026-10-01T03:00:00Z",
        "reviewedBy": null,
        "reviewedAt": null,
        "reviewNote": null
      }
    ]
  }
}
```

Mẫu trên lấy từ sheet **JSON mẫu**, hàng 2054–2084. URL trong mẫu không phải liên kết tài liệu thật. Mốc giờ API được hiển thị theo giờ Việt Nam; dữ liệu gốc không bị sửa.

FE gọi proxy cùng origin `/api/backend/owner/restaurant/verifications`. Session thật được dùng ở chế độ `live`; BE giới hạn dữ liệu theo tài khoản đang đăng nhập. Chỉ role `RESTAURANT_OWNER` được phép dùng endpoint này. Không cần thêm biến môi trường; `API_BASE_URL` vẫn trỏ đến BE của dự án.

## Tự kiểm thử với BE thật

1. Chạy BE/FE theo [hướng dẫn dự án](local-run-and-test-guide.vi.md). Dùng Owner đã có nhà hàng, nộp hồ sơ qua F-47 nếu cần.
2. Mở `/restaurant/verification?tab=status`. Trong Network, kiểm tra GET OWN-07 trả 200, `verificationStatus` và `items` đúng dữ liệu BE.
3. Kiểm tra hồ sơ mới nhất, mở một hồ sơ cũ để xem phản hồi, ngày duyệt, người duyệt, tài liệu và `previousId`.
4. Khi BE có luồng duyệt/từ chối/yêu cầu bổ sung, bấm **Tải lại lịch sử** sau khi người duyệt xử lý. Trạng thái trên trang phải cập nhật; nội dung hồ sơ cũ vẫn còn nguyên. BE local hiện chỉ có các endpoint phía Owner, chưa có endpoint Moderator để chạy bước duyệt này từ đầu đến cuối.
5. Bấm liên kết tài liệu để kiểm tra URL riêng tư. Nếu hết hạn, tải lại lịch sử để nhận URL mới.
6. Kiểm tra Owner chưa có hồ sơ, chưa có nhà hàng, BE tạm ngừng hoạt động và phiên đăng nhập hết hạn. Lịch sử không bị thay bằng fixture khi lỗi.
7. Thử trên điện thoại, dùng Tab/Enter/Escape để mở/đóng popup. Việc xem hồ sơ không được tạo upload hoặc gọi POST.

Kiểm tra tự động bằng API stub riêng, không tiêu hao Mapbox hoặc upload thật:

```powershell
npm test -- tests/verification-status.test.ts
npx playwright test --config=playwright.verification-status.config.ts
```

Browser config build/chạy FE production trong thư mục cache riêng trên cổng 3001, API stub trên 5164. Bộ kiểm tra cũng chạy hồi quy F-47; chạy tuần tự với các bộ Owner khác vì dùng chung cổng.

### Bộ kiểm tra BE thật F-47/F-48

BE local phải đang chạy bằng `docker-compose.local.yml`, database `angi_local`, có cấu hình Cloudinary hợp lệ. Chạy từ thư mục `angi-frontend`; cổng 3001 phải trống. Script chuẩn bị tạo tài khoản mới và ghi lại `.env.integration` riêng cho lượt chạy, không thay `.env` của FE/BE. Giữ lại cấu hình kiểm thử cũ trước nếu cần.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-live-tests.ps1
$env:NODE_OPTIONS = ""
try {
  node --env-file=.env.integration node_modules/@playwright/test/cli.js test --config=playwright.verification-live.config.ts
} finally {
  powershell -ExecutionPolicy Bypass -File scripts/cleanup-live-tests.ps1
}
```

Bộ này đăng nhập thật, tạo nhà hàng bằng API trên tài khoản mới, upload một PDF kiểm thử riêng tư lên Cloudinary, nộp qua popup F-47 rồi xem lịch sử F-48. Có kiểm tra reload, lỗi 400/409, thiếu nhà hàng, quyền 401/403 ở cả proxy/BE và cách ly Owner. Cần tài khoản mới cho mỗi lượt; không tự retry để tránh tạo upload dư. Cleanup xóa asset của đúng Owner kiểm thử; giữ metadata trong database local.

Mapbox bị tắt ở cấu hình FE kiểm thử; không mở bản đồ hoặc dò token. Bộ kiểm tra có một lượt tải tài liệu tổng hợp từ Cloudinary để kiểm tra URL riêng tư. Trace, video và ảnh tự động đều tắt để tránh ghi thông tin đăng nhập/URL có chữ ký. Kết quả an toàn được ghi trong `artifacts/verification-live-evidence.json`; xem [báo cáo kiểm thử thật](verification-live.vi.md) để phân biệt phần đã chạy với phần còn thiếu.

## Phạm vi kiểm chứng

Code đã nối OWN-07 và có mock theo cấu trúc API Design. Bộ stub kiểm tra đầy đủ trạng thái/phản hồi; bộ live kiểm tra dữ liệu và dịch vụ thật trong phạm vi [báo cáo kiểm thử BE](verification-live.vi.md). Chưa kiểm được luồng duyệt từ Moderator do BE chưa cung cấp endpoint tương ứng. Không gọi Mapbox hoặc kiểm tra/thay token. Chi tiết nguồn hợp đồng: [báo cáo F-48](verification-status-evidence.md).
