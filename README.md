# angi-frontend

Frontend ANGI dùng Next.js App Router, TypeScript và Tailwind CSS. Role, DTO và mã lỗi khớp với [angi-backend](https://github.com/predtn/angi-backend), nhánh `dev`, API Design v1.8.

## Mở dự án trên máy hiện tại

1. Bật Docker Desktop.
2. Mở thư mục `C:\Users\Tulas\Documents\ANGI` và chạy `START-ANGI.cmd`.
3. Mở [ANGI](http://localhost:3000) hoặc [tài liệu backend](http://localhost:5154/scalar).

File khởi động dùng .NET 10 SDK tại `.tools/dotnet`, PostgreSQL tại cổng **5433**, backend **5154** và frontend **3000**. Khóa JWT, mật khẩu tài khoản thử và log nằm trong `.tools`, bên ngoài hai repo Git.

| Email thử           | Role             | Trang sau đăng nhập |
| ------------------- | ---------------- | ------------------- |
| traveler@angi.local | TRAVELER         | /discovery          |
| owner@angi.local    | RESTAURANT_OWNER | /restaurant         |
| mod@angi.local      | MOD              | /moderation         |
| admin@angi.local    | ADMIN            | /administration     |

Mật khẩu nằm trong `C:\Users\Tulas\Documents\ANGI\.tools\dev-accounts.txt`. Đây là dữ liệu local; không đưa file này lên GitHub.

Trong PowerShell tại thư mục ANGI:

```powershell
.\start-angi.ps1 -Mode Status
.\start-angi.ps1 -Mode Stop
.\start-angi.ps1
```

`Stop` dừng frontend/backend do script khởi động; PostgreSQL vẫn giữ dữ liệu. Sau khi sửa code backend, dừng ứng dụng và build lại Release bằng `.tools\dotnet\dotnet.exe build angi-backend\ANGI.slnx -c Release` trước khi khởi động lại. Frontend chạy chế độ dev nên cập nhật khi lưu file.

## Cài trên máy khác

Yêu cầu Node.js 24, Docker Desktop và .NET 10 SDK. Khởi động backend theo [README backend](https://github.com/predtn/angi-backend#local-database); dùng cổng và thông tin database trong `.env` của backend. Backend Development tự chạy EF migrations khi khởi động.

Trong thư mục `angi-frontend`:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Điền `.env.local`:

```dotenv
API_BASE_URL=http://localhost:5154/api/v1
NEXT_PUBLIC_API_BASE_URL=/api
APP_URL=http://localhost:3000
SESSION_PASSWORD=<chuoi-ngau-nhien-it-nhat-32-ky-tu>
```

Tạo khóa bằng Node.js, rồi chép kết quả vào `SESSION_PASSWORD`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run dev
```

`API_BASE_URL` chỉ dùng trên server Next.js để gọi backend. `NEXT_PUBLIC_API_BASE_URL` trỏ đến Route Handlers của Next.js; giữ `/api` để cookie và API cùng origin. `APP_URL` phải đúng origin mở trên trình duyệt. Đổi biến public cần khởi động lại dev hoặc build lại. Không đặt khóa bí mật trong biến `NEXT_PUBLIC_*`.

## Cấu trúc và phần đã có

```text
src/app/
  (public)/login/             Đăng nhập
  (protected)/               Layout và các trang theo role
  api/auth/[action]/         login, session, refresh, logout
  api/backend/[...path]/     Proxy có danh sách endpoint được phép
src/components/              Header, sidebar, dashboard chung
src/features/auth/           DTO, role, guard, session, refresh
src/shared/api/              API client, ApiError, response helpers
src/shared/types/            ApiResponse<T>
src/shared/ui/               Button, Input, Card, Alert, Badge
tests/                       Unit tests API/auth
scripts/smoke-test.mjs        Kiểm tra tích hợp với backend local
```

Role guard chạy phía server: chưa đăng nhập chuyển đến `/login`; sai role chuyển về trang của role hiện tại. ADMIN được vào trang moderation. Backend quyết định quyền truy cập API. Redirect sau khi streaming bắt đầu có thể trả HTTP 200 kèm chỉ thị redirect; nội dung trang không được phép không được render.

Đã kết nối API backend thực tế: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. `/api/auth/session` đọc thông tin phiên đã ký/mã hóa và làm mới token khi cần; đây không phải API `/me` của backend. Scaffold Figma có các trang nghiệp vụ và tương tác qua adapter demo riêng. Backend chưa triển khai các API nghiệp vụ tương ứng; chế độ live hiển thị trạng thái chưa khả dụng, proxy giữ nguyên lỗi thực tế.

## API client và xử lý lỗi

```tsx
import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/error";
import type { AuthUserDto } from "@/features/auth/types";

try {
  // Chỉ dùng khi backend đã triển khai endpoint /me.
  const user = await api.get<AuthUserDto>("me");
  console.log(user.displayName); // nhận data, không phải toàn bộ ApiResponse
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "VALIDATION_FAILED":
        console.log(error.errors);
        break;
      case "ROUTE_NOT_FOUND":
        console.log("Backend chưa có endpoint này.");
        break;
      default:
        console.log(error.message);
    }
  }
}
```

Client trả `ApiResponse.data`, kể cả `null`. `ApiError` giữ `status`, `errorCode`, `errors`, `data` và `Retry-After`. Form đăng nhập hiển thị lỗi field và mã lỗi thực tế như `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_BANNED`; dữ liệu `suspendedUntil` được giữ lại.

Thêm API nghiệp vụ bằng cách thêm đúng tổ hợp method/path vào `allowedEndpoints` tại `src/app/api/backend/[...path]/route.ts`, export method tương ứng và tạo DTO theo API Design. Proxy không nhận URL tùy ý.

## Phiên đăng nhập và refresh token

- Token pair nằm trong cookie mã hóa `angi_session`, có `HttpOnly`, `SameSite=Lax`; `Secure` bật ở production. Browser chỉ nhận user DTO, không lưu token trong localStorage.
- Route Handlers kiểm tra Origin cho yêu cầu thay đổi dữ liệu và gọi backend bằng Bearer token.
- Token hết hạn hoặc backend trả `UNAUTHORIZED`: refresh và retry tối đa một lần. Lỗi quyền truy cập khác không kích hoạt refresh.
- Request cùng refresh token dùng chung một lần refresh. Registry giữ token pair mới nhất theo session để cookie từ response chậm không đưa phiên về token cũ.
- Refresh không hợp lệ, tài khoản bị khóa hoặc đăng xuất: xóa cookie và vô hiệu hóa session trong tiến trình hiện tại. Đăng nhập/đăng xuất chuyển trang đầy đủ để xóa cache trang đã bảo vệ.

Cấu hình này dùng cho **một tiến trình Next.js local**. Trước khi chạy nhiều instance hoặc serverless, thay registry và refresh coordination bằng session store dùng chung, có khóa refresh và lưu token pair mới nhất. Registry bộ nhớ không bảo đảm thu hồi phiên sau khi restart. Dùng HTTPS, khóa riêng cho từng môi trường, theo dõi giới hạn kích thước cookie và cấu hình IP client đáng tin cậy khi backend rate limit theo người dùng thực tế.

## Kiểm tra

```powershell
npm run lint
npm test
npm run build
npm run typecheck
```

Build sinh type route nên chạy trước typecheck trên checkout mới. CI chạy các bước này khi PR vào `dev`/`main`.

Khi backend và frontend local đang chạy, dùng tài khoản thử đã seed:

```powershell
npm run test:smoke
```

Smoke test chỉ chạy với backend local, đọc mật khẩu từ `../.tools/local-settings.json` hoặc `ANGI_TEST_PASSWORD`, tạo/đăng xuất phiên thử và kiểm tra 4 role, Origin, ApiResponse, refresh đồng thời và xóa phiên lỗi. Không in token/mật khẩu.

## Scaffold Figma và bản minh họa

Mở [bản minh họa](http://localhost:3000/demo) để thử các màn hình Guest, Traveler, Owner, Moderator và Admin. Có khám phá món/quán, cẩm nang, lập lịch ăn/bản đồ/ngân sách, quản lý nhà hàng/thực đơn, các luồng kiểm duyệt, quyền Mod, nhật ký và đồng bộ. Dữ liệu mẫu cập nhật trong bộ nhớ khi thao tác và đặt lại khi tải lại trang. Bản minh họa không tạo phiên đăng nhập hoặc gửi email.

- [Hướng dẫn cài đặt và biến môi trường](docs/setup.md)
- [Kiến trúc và ranh giới adapter](docs/architecture.md)
- [Đối chiếu route/frame/component với Figma](docs/design-coverage.md)
- [Kết quả kiểm tra và giới hạn còn lại](docs/verification.md)

Thư viện thành phần: `/dev/components`; 23 kịch bản trạng thái: `/dev/scenarios`. Cả hai chỉ bật mặc định trong development. Chế độ dữ liệu mặc định là `NEXT_PUBLIC_DATA_MODE=live`; `/demo` dùng fixtures riêng. Đặt `NEXT_PUBLIC_ENABLE_DEMO=false` để tắt preview và giữ `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY=false` khi build production.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npx playwright install chromium
npm run test:browser
```

Khi frontend đang chạy, `npm run test:visual` và `npm run test:states` tạo ảnh cùng manifest trong `artifacts/screenshots`. Không có backend mới hoặc bước deploy trong scaffold này. File `ANGI_API_Design_Ver1.8.xlsx` chưa có trong workspace; các model nghiệp vụ hiện là view model frontend và cần đối chiếu hợp đồng trước khi nối live API.
