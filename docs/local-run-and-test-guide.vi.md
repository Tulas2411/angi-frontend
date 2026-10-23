# Hướng dẫn chạy và kiểm thử cục bộ

Dành cho Windows + PowerShell, với hai repository `angi-frontend` và `angi-backend` nằm cạnh nhau (ví dụ `C:\FPTU\Capstone`). Tóm tắt nhanh có trong [README](../README.md); trang này đi sâu hơn cho việc tự kiểm tra.

> Lưu ý: các script cũ của backend (`docker/local/Initialize.ps1`, `Start.ps1`, `docker-compose.local.yml`) và các script `prepare-live-tests.ps1`, `cleanup-live-tests.ps1` của frontend **không còn tồn tại**. Hướng dẫn cũ dùng chúng đã được thay bằng nội dung dưới đây.

## 1. Chạy backend

Làm theo `angi-backend/README.md`:

```powershell
cd ..\angi-backend
docker compose up -d --wait     # PostgreSQL 16 + pgvector (container angi-postgres)
dotnet run --project ANGI.WebApi --launch-profile http
```

Ở môi trường Development, backend tự áp dụng migration khi khởi động. API mặc định ở `http://localhost:5154` (tài liệu Scalar tại `/scalar`, OpenAPI tại `/openapi/v1.json`). Cổng PostgreSQL và mật khẩu lấy từ `.env` của backend. Nếu bạn chạy API trong container riêng, hãy kiểm tra `http://127.0.0.1:5154/openapi/v1.json` trả 200 trước khi chạy frontend.

## 2. Chạy frontend

```powershell
cd ..\angi-frontend
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Điền `SESSION_PASSWORD` (≥ 32 ký tự ngẫu nhiên) và đặt `API_BASE_URL=http://127.0.0.1:5154/api/v1` (dùng `127.0.0.1`, không dùng `localhost`, để tránh lỗi IPv6 `503 SERVICE_UNAVAILABLE` khi đăng nhập). `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` và `NEXT_PUBLIC_GOOGLE_CLIENT_ID` là tùy chọn.

```powershell
npm run dev
```

Mở <http://localhost:3000>. Trang chủ chạy không cần backend; các màn khác cần đăng nhập.

## 3. Tài khoản để tự thử

Tự tạo tài khoản trong database local của bạn, hoặc dùng `/register` (cần xác minh email) rồi kích hoạt bằng cơ sở dữ liệu local. Đừng dùng dữ liệu chung hoặc môi trường thật. Nên có đủ: một Traveler, một Owner **đã có nhà hàng đã xác minh**, một Owner **chưa có nhà hàng**, một Moderator và một Administrator.

| Đăng nhập bằng         | Kết quả mong đợi                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Traveler / Mod / Admin | Về `/`; menu tài khoản có "Tài khoản của tôi" và "Đăng xuất"; `/restaurant` quay về `/` |
| Owner chưa có nhà hàng | Về `/restaurant` với "Bạn chưa có nhà hàng" → `/restaurant/register`                    |
| Owner có nhà hàng      | Về `/restaurant`; menu Tổng quan, Nhà hàng, Xác minh, Thực đơn                          |
| Chưa đăng nhập         | `/account` và `/restaurant/*` chuyển về `/login`; `/demo`, `/dishes`, … trả 404         |

## 4. Kiểm tra thủ công

1. **Tài khoản (`/account`)**: sửa tên, số điện thoại, giới thiệu → lưu → tải lại trang vẫn còn. Xóa số điện thoại/giới thiệu gửi `null`. Đổi mật khẩu: sai mật khẩu hiện tại báo lỗi ngay trên ô đó; đổi xong các phiên khác bị đăng xuất.
2. **Đăng ký nhà hàng** (`/restaurant/register`, OWN-01): nhập tên, điện thoại, địa chỉ, tỉnh/thành, phường/xã tùy chọn, vị trí (bản đồ hoặc nhập tọa độ). Nếu backend của bạn vẫn bắt buộc `district`, form sẽ hiện thông báo "Quận/huyện là bắt buộc." — đó là chênh lệch backend, không phải lỗi frontend (xem [live-backend-verification.vi.md](live-backend-verification.vi.md)).
3. **Hồ sơ, giờ mở cửa, trạng thái** (`/restaurant/profile`, các thẻ `?tab=hours|status|photos`): sau mỗi lần lưu hãy **tải lại trang** để chắc dữ liệu đã được lưu. Mỗi lần đổi trạng thái đều qua hộp thoại xác nhận.
4. **Xác minh** (`/restaurant/verification`) và **thực đơn** (`/restaurant/menu`): chi tiết trong [xác minh](restaurant-verification.vi.md), [trạng thái và lịch sử](verification-status.vi.md), [nộp lại](verification-resubmission.vi.md), [thực đơn](restaurant-menu.vi.md), [duyệt thực đơn](menu-approval.vi.md). Upload ảnh/tài liệu đi qua kho lưu file thật của backend nên chỉ thử bằng tài khoản dùng thử.
5. **Bàn phím**: Tab đi qua liên kết "Đến nội dung chính", header, nội dung; Escape đóng menu tài khoản và hộp thoại rồi trả focus về nút đã mở.
6. **Responsive**: thu nhỏ trình duyệt xuống 320px — không được xuất hiện thanh cuộn ngang của cả trang.

Ranh giới Mapbox: không mở bản đồ hay chạy test dùng token thật nếu không cần; ở máy không có token, form vẫn nhập tọa độ thủ công được.

## 5. Chạy test tự động

| Lệnh                   | Nội dung                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint                                                                                                      |
| `npm run typecheck`    | TypeScript (chạy `npm run build` trước trên máy mới)                                                        |
| `npm test`             | Vitest                                                                                                      |
| `npm run build`        | Build production                                                                                            |
| `npm run test:browser` | Trang chủ, auth, chuyển hướng theo vai trò, trang tài khoản                                                 |
| `npm run test:owner`   | Giờ mở cửa, trạng thái, xác minh, thực đơn với API stub                                                     |
| `npm run test:map`     | Đăng ký, hồ sơ, bản đồ, tỉnh/phường (Mapbox bị chặn bằng stub)                                              |
| `npm run test:live`    | Backend thật với tài khoản của bạn — xem [live-backend-verification.vi.md](live-backend-verification.vi.md) |

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npx playwright install chromium
```

Các bộ browser tạo snapshot trong `.cache/owner-test-*`, dùng cổng 3001 (frontend) và 5164 (API stub) nên **chạy từng bộ một**. Đặt `ANGI_TEST_DEV=1` để chạy snapshot bằng `next dev` thay vì build. Nếu máy thiếu bộ nhớ (build hoặc Chromium bị dừng đột ngột), đóng bớt ứng dụng, tắt extension tự gắn vào Node (ví dụ Console Ninja) và chạy từng nhóm nhỏ.

## 6. Xử lý sự cố

| Triệu chứng                                    | Cách xử lý                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Đăng nhập báo 503                              | Backend chưa chạy hoặc `API_BASE_URL` dùng `localhost`; đổi sang `127.0.0.1` và kiểm tra `/openapi/v1.json` |
| Mutation báo `FORBIDDEN`                       | `APP_URL` phải trùng đúng origin của trình duyệt (cả cổng)                                                  |
| `/restaurant/register` báo "Quận/huyện…"       | Backend bản cũ vẫn bắt buộc `district`; cập nhật backend theo hợp đồng 16/10                                |
| Test báo cổng 3001/5164 đã được dùng           | Dừng bộ test hoặc server preview đang giữ cổng đó rồi chạy lại                                              |
| Build/test bị dừng giữa chừng, "out of memory" | Giải phóng bộ nhớ, tăng page file Windows, chạy từng nhóm nhỏ                                               |
