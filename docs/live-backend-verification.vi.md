# Kiểm thử với backend thật

[English version](live-backend-verification.md).

`npm run test:live` chạy các spec Playwright trong `tests/live` trên bản build frontend thật và **backend cùng database local thật**. Không có API stub, không chặn request. Spec dùng tài khoản của bạn và tự khôi phục dữ liệu đã đổi.

Lịch sử: các bộ live cũ (nộp hồ sơ xác minh kèm upload private thật, duyệt thực đơn, nộp lại hồ sơ) phụ thuộc vào script seed và Docker của backend không còn tồn tại (`docker/local/Initialize.ps1`, `Start.ps1`, `docker-compose.local.yml`, `Seed`), nên đã bị xóa cùng đợt dọn demo. Kết quả đã ghi vẫn nằm trong các tệp bằng chứng lịch sử (`verification*.md`, `*-evidence.md`).

## Bộ kiểm thử bao gồm

| Spec                         | Thao tác thật                                                                                                                                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/live/account.spec.ts` | Đăng nhập (AUTH-04) mọi vai trò, trang đích sau đăng nhập, chuyển hướng khi sai vai trò, route đã bỏ trả 404, ME-01/02 (sửa hồ sơ, tải lại vẫn còn, rồi khôi phục), ME-03 (sai mật khẩu bị từ chối, đổi mật khẩu, đăng nhập bằng mật khẩu mới, khôi phục) |
| `tests/live/owner.spec.ts`   | OWN-01 đăng ký nhà hàng với Owner mới (bị bỏ qua kèm lý do nếu backend vẫn bắt buộc `district`), OWN-02/03 sửa mô tả rồi khôi phục, OWN-04 giờ mở cửa, OWN-05 đổi trạng thái rồi khôi phục, OWN-09..11/18 bật/tắt món và tạo rồi hủy bản nháp thực đơn    |

Chưa kiểm thử live: upload MEDIA-01 (ảnh bìa, ảnh nhà hàng, giấy tờ xác minh, ảnh món), OWN-06/07/08 (xác minh) và OWN-12..17 (sửa bản nháp, nộp duyệt thực đơn). Các phần này cần kho lưu file và quyết định của Moderator, nên chỉ có bộ stub (`npm run test:owner`).

## Chuẩn bị

1. Backend chạy được (mặc định `http://127.0.0.1:5154/api/v1`; cấu hình từ chối host không phải loopback) và database là bản **local dùng thử**.
2. Có năm tài khoản local: Traveler, Owner **đã có nhà hàng được xác minh và ít nhất một món**, Owner **chưa có nhà hàng**, Moderator và Administrator. Tự tạo trong database local của bạn; mật khẩu 8–64 ký tự, có chữ và số.
3. Đặt biến vào tệp `.env.integration` (đã bị ignore; không commit, không in ra):

```text
SESSION_PASSWORD=<chuỗi ngẫu nhiên từ 32 ký tự>
ANGI_TEST_PASSWORD=<mật khẩu chung của năm tài khoản>
ANGI_TEST_TRAVELER_EMAIL=...
ANGI_TEST_OWNER_EMAIL=...          # owner có nhà hàng đã xác minh
ANGI_TEST_OWNER_NEW_EMAIL=...      # owner chưa có nhà hàng
ANGI_TEST_MOD_EMAIL=...
ANGI_TEST_ADMIN_EMAIL=...
API_BASE_URL=http://127.0.0.1:5154/api/v1   # tùy chọn
```

## Chạy

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npm run test:live
$env:ANGI_TEST_DEV='1'; npm run test:live   # chạy snapshot bằng next dev thay vì build
```

Cấu hình tạo snapshot trong `.cache/owner-test-*` (bản preview đang chạy không bị ảnh hưởng), tắt Mapbox và Google, không ghi trace, dùng cổng 3001. Hãy chạy riêng vì chung cổng với các bộ browser khác.

## Chênh lệch backend đã biết

Frontend theo hợp đồng ngày 16/10: `district` là tùy chọn ở OWN-01 và form đăng ký không có ô quận/huyện. Bản backend mà `RegisterRestaurantRequestDtoValidator` còn bắt buộc `district` (như bản checkout ở commit `ff15dca`) trả `400 VALIDATION_FAILED` kèm `errors.district`. Form đã hiển thị thông báo đó; test live OWN-01 được bỏ qua thay vì báo lỗi. Hãy triển khai thay đổi backend tương ứng rồi chạy lại.
