# Hướng dẫn chạy ANGI và tự kiểm thử trên máy local

Hướng dẫn dành cho Windows + PowerShell, với hai repository nằm trong `C:\FPTU\Capstone`. Các lệnh và giới hạn bên dưới được đối chiếu với cấu hình hiện có ngày **15/10/2026**. Đây là hướng dẫn sử dụng môi trường local; kết quả kiểm thử đã thực hiện nằm trong [báo cáo ba task Owner](owner-tasks-live-verification.vi.md).

**Lưu ý về phiên bản FE:** tại thời điểm viết, nhánh đang mở `test/real-backend-integration` ở `7bb3e1d` chưa có phần cập nhật trạng thái ANGI-55. Local `dev` ở `4bda386` đã có. Để tự kiểm thử đủ ANGI-36, ANGI-48 và ANGI-55 ngay trong workspace hiện tại, dùng **cách chạy bản sao `dev` tại mục 4.1**. Cách này giữ nguyên nhánh và các file chưa commit. Chạy `npm run dev` trực tiếp sẽ dùng mã nguồn của nhánh đang mở.

## 1. Chuẩn bị môi trường

Bạn cần:

- **Docker Desktop** đang chạy Linux containers, có Docker Compose v2.
- **Node.js 24 và npm**, dùng `package-lock.json` của FE.
- **Git**, PowerShell và trình duyệt Chrome/Edge. Cách chạy bản sao `dev` còn sử dụng lệnh `tar` của Windows.
- Internet cho lần đầu tải image Docker, NuGet/npm và Chromium; upload ảnh thật cần kết nối Cloudinary.

Không cần cài .NET SDK hoặc PostgreSQL trực tiếp lên Windows khi dùng stack Docker trong hướng dẫn này.

Kiểm tra trong PowerShell:

```powershell
node --version
npm --version
git --version
docker version
docker compose version
Get-Command tar
```

`docker version` cần hiển thị được cả Client và Server. Nếu không tìm thấy `docker`, mở lại terminal sau khi cài Docker Desktop; CLI thường nằm trong `C:\Program Files\Docker\Docker\resources\bin`.

| Thành phần               | Địa chỉ mặc định                        | Mục đích                                            |
| ------------------------ | --------------------------------------- | --------------------------------------------------- |
| FE chạy mã nguồn đang mở | `http://localhost:3000`                 | Phát triển và thao tác thủ công trên nhánh hiện tại |
| FE bản sao/kiểm thử live | `http://localhost:3001`                 | Kiểm thử riêng, có thể chọn mã nguồn local `dev`    |
| BE thật                  | `http://127.0.0.1:5154/api/v1`          | API .NET chạy trong Docker                          |
| Scalar                   | `http://localhost:5154/scalar`          | Xem và thử API                                      |
| OpenAPI                  | `http://localhost:5154/openapi/v1.json` | Kiểm tra API đã khởi động                           |
| PostgreSQL từ Windows    | `127.0.0.1:5434`                        | Database local `angi_local`                         |

Luồng thao tác thật là: trình duyệt → API cùng origin của Next.js → BE .NET → PostgreSQL/Cloudinary. Đăng nhập trên FE sẽ tạo phiên HttpOnly; bạn không cần tự chép JWT vào trình duyệt.

## 2. Khởi tạo và chạy backend

### 2.1. Tạo cấu hình local lần đầu

Mở **Terminal BE**:

```powershell
Set-Location C:\FPTU\Capstone\angi-backend
./docker/local/Initialize.ps1
```

Script tạo `.env` từ `.env.example` nếu chưa tồn tại, sinh mật khẩu database, JWT và mật khẩu tài khoản local. Nếu `.env` đã có, script giữ nguyên. Với máy hiện tại đã được cấu hình, bạn tiếp tục dùng file đó.

Mở `angi-backend/.env` trong IDE để kiểm tra/điền cấu hình. Không chép đè file đang có bằng example.

| Nhóm            | Biến                                                                            | Cách sử dụng                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Database local  | `POSTGRES_PORT`, `ANGI_DB_NAME`, các biến user/password database                | Dùng cấu hình do initializer tạo: cổng `5434`, database `angi_local`; seed chỉ hỗ trợ database local này                       |
| Cổng API        | `ANGI_API_PORT`                                                                 | Mặc định `5154`; FE phải trỏ đúng cổng nếu thay đổi                                                                            |
| JWT             | `Jwt__SecretKey`                                                                | Giữ khóa riêng do initializer tạo                                                                                              |
| Tài khoản local | `ANGI_LOCAL_ACCOUNT_PASSWORD`                                                   | Mật khẩu dùng để đăng nhập các tài khoản seed; không phải khóa JWT                                                             |
| Ảnh thật        | `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret`          | Cần cấu hình đúng để kiểm thử Owner và upload ảnh; một số API đọc cũng khởi tạo Cloudinary nên thiếu khóa có thể gây lỗi `500` |
| Email           | `Brevo__ApiKey`, `Brevo__SenderEmail`, `Brevo__SenderName`, `Frontend__BaseUrl` | Cần cho luồng email; tài khoản seed đã kích hoạt nên kiểm thử ba task Owner không cần nhận email                               |
| Google          | `Google__ClientId`                                                              | Cần cho Google sign-in; FE cần client ID tương ứng và origin OAuth phù hợp                                                     |
| Recommendation  | `Recommendation__BaseUrl`, `Recommendation__ApiKey`                             | Chỉ cấu hình khi có service thật; không bắt buộc cho ba task Owner                                                             |
| Mapbox phía BE  | `Mapbox__AccessToken`                                                           | Cấu hình BE; không tự bật bản đồ trên FE                                                                                       |

Giữ giá trị bí mật trong file local được Git bỏ qua. Không đưa khóa Cloudinary, Brevo, JWT hoặc mật khẩu database vào biến `NEXT_PUBLIC_*` hay tài liệu chia sẻ.

### 2.2. Chạy PostgreSQL, migration, seed và API

Tại **Terminal BE**:

```powershell
./docker/local/Start.ps1
docker compose -f docker-compose.local.yml ps
(Invoke-WebRequest http://127.0.0.1:5154/openapi/v1.json -UseBasicParsing).StatusCode
```

Kết quả mong đợi: script thông báo `API ready`, service `postgres` healthy, service `api` đang chạy, OpenAPI trả **200**. Lần đầu có thể lâu do tải image/restore/build. Có thể mở Scalar để xem endpoint.

Luôn dùng **`docker-compose.local.yml` độc lập** trong các lệnh này. Stack có tên `angi-local`, volume riêng và dữ liệu được giữ qua những lần dừng/chạy. .NET không tự đọc `.env`; Compose truyền các biến vào process API. Không thay bước này bằng `dotnet run` trực tiếp rồi kỳ vọng `.env` được nạp tự động.

### 2.3. Tài khoản có sẵn

Các tài khoản sau được tạo và kích hoạt trực tiếp trong database local:

| Email                   | Vai trò/dữ liệu ban đầu                                 |
| ----------------------- | ------------------------------------------------------- |
| `owner@angi.local`      | Restaurant Owner, ban đầu chưa có nhà hàng              |
| `menu-owner@angi.local` | Restaurant Owner, có nhà hàng đã xác minh và món ăn mẫu |
| `traveler@angi.local`   | Traveler                                                |
| `security@angi.local`   | Traveler dùng cho kiểm thử mật khẩu                     |
| `mod@angi.local`        | Moderator                                               |
| `admin@angi.local`      | Administrator                                           |

Mật khẩu nằm tại **`ANGI_LOCAL_ACCOUNT_PASSWORD` trong BE `.env`**. Xem trong IDE của bạn, không cần gửi vào chat. Seed giữ nguyên tài khoản/mật khẩu đã tồn tại: đổi biến này rồi chạy lại seed không đổi mật khẩu tài khoản cũ. Các thao tác trước đó có thể đã làm thay đổi dữ liệu của tài khoản trên; dùng tài khoản theo lượt ở mục 4.1 khi cần trạng thái ban đầu mới.

Đây là dữ liệu hỗ trợ đăng nhập local, không chứng minh luồng gửi email xác minh đã hoạt động.

## 3. Chuẩn bị frontend

Mở **Terminal FE**:

```powershell
Set-Location C:\FPTU\Capstone\angi-frontend
npm ci
```

`npm ci` cài dependency đúng lockfile. Chỉ cần cài lại khi setup lần đầu hoặc dependency thay đổi.

### 3.1. Cấu hình cho cách chạy thông thường ở cổng 3000

Máy hiện tại đã có FE `.env`: mở file đang dùng và giữ các giá trị đã cấu hình. Nếu chưa có cả `.env` lẫn `.env.local`, có thể tạo lần đầu:

```powershell
if (!(Test-Path .env) -and !(Test-Path .env.local)) {
    Copy-Item .env.example .env.local
}
```

Các giá trị cần có cho FE chạy với BE local:

```dotenv
API_BASE_URL=http://127.0.0.1:5154/api/v1
NEXT_PUBLIC_API_BASE_URL=/api
APP_URL=http://localhost:3000
SESSION_PASSWORD=<khoa-ngau-nhien-rieng-it-nhat-32-ky-tu>
NEXT_PUBLIC_DATA_MODE=live
NEXT_PUBLIC_ENABLE_DEMO=true
NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY=false
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

Thay placeholder `SESSION_PASSWORD` bằng khóa ngẫu nhiên thực sự, khác với mật khẩu đăng nhập. Có thể sinh khóa mới để tự chép vào file local bằng:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Nếu đã có session key hợp lệ thì giữ nguyên. Đổi khóa làm phiên đăng nhập cũ không còn dùng được.

Trong development, thứ tự ưu tiên cấu hình là biến của terminal/process → `.env.development.local` → `.env.local` → `.env.development` → `.env`. Vì vậy, sửa `.env` sẽ không có tác dụng nếu cùng biến đang được đặt ở nguồn ưu tiên cao hơn. Giữ browser API base là `/api`; `API_BASE_URL` mới là địa chỉ BE phía server. Khởi động lại FE sau khi sửa env, build lại nếu đang dùng bản production.

Tất cả bộ chọn vị trí và bản đồ lịch ăn hiện dùng Mapbox, kể cả trong workspace demo. Khi token public đã có ở BE `.env`, chạy từ FE root:

```powershell
./scripts/sync-mapbox-env.ps1
```

Script chỉ đồng bộ token `pk.*` vào `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` của FE, ưu tiên `.env.local` nếu file đó tồn tại và giữ các cấu hình khác. Khởi động lại FE sau khi đồng bộ. Token bí mật không được chép sang biến public. Nếu thiếu token hoặc provider lỗi, giao diện báo lỗi/cung cấp nhập tọa độ thay vì dùng bản đồ minh họa. Tìm địa chỉ để lưu lâu dài còn cần quyền permanent geocoding của tài khoản Mapbox. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` chỉ cần cho Google sign-in; để trống không cản đăng nhập bằng email/mật khẩu local.

Phần modal/Mapbox mới đang ở mã nguồn làm việc: dùng cách chạy cổng 3000 tại mục 4.2 để xem. Bản sao `dev` ở mục 4.1 chỉ chứa code đã có trong local `dev`, không chứa các chỉnh sửa chưa commit này.

Sau khi cập nhật các ô gợi ý tỉnh/thành, khởi động lại tiến trình FE đã chạy từ trước bằng `Ctrl+C` rồi `npm run dev`. Tiến trình dev cũ có thể giữ HTML server cũ trong khi trình duyệt đã tải component mới, gây lỗi hydration và làm mất nội dung vừa nhập. Các thay đổi này không cần thêm biến môi trường.

## 4. Chọn cách chạy FE để tự thao tác

### 4.1. Kiểm thử đủ ba task bằng bản sao local `dev` — dùng cho workspace hiện tại

Đảm bảo BE đã chạy và đã `npm ci`. Ở **Terminal FE**:

```powershell
Set-Location C:\FPTU\Capstone\angi-frontend
./scripts/prepare-live-tests.ps1
$env:ANGI_TEST_SOURCE_REF = 'dev'
$env:NEXT_PUBLIC_API_BASE_URL = '/api'
node --env-file=.env.integration scripts/owner-test-server.mjs
```

Chờ Next.js báo sẵn sàng, rồi mở **<http://localhost:3001/login>**. Giữ terminal này chạy trong lúc thao tác.

Các lệnh trên:

1. Tạo bộ tài khoản/dữ liệu mới cho lượt kiểm thử và file riêng **`angi-frontend/.env.integration`**.
2. Chụp mã nguồn tại commit của **local `dev`** vào `.cache/owner-test-*`, chạy FE ở cổng **3001**. Terminal in commit được sử dụng. Không chuyển nhánh, merge hoặc chép đè source đang mở.
3. Nạp API base, origin và session key từ `.env.integration`. Bản sao không sao chép `.env`/`.env.local` của FE; biến `/api` được đặt riêng trong terminal như trên.

`dev` ở đây là nhánh local, không tự tải thay đổi mới từ remote. Trong trạng thái được kiểm tra ngày 15/10/2026, commit `4bda386` có đủ ba task. Khi làm việc trên máy khác, cần có local `dev` chứa ANGI-55 và các script hỗ trợ nêu trong hướng dẫn.

Mở **`.env.integration` trong IDE** để lấy email và mật khẩu của lượt hiện tại:

| Biến                              | Dùng để kiểm thử                                                 |
| --------------------------------- | ---------------------------------------------------------------- |
| `ANGI_TEST_OWNER_EMAIL`           | Owner mới chưa có nhà hàng: F-43 Register Restaurant             |
| `ANGI_TEST_HOURS_OWNER_EMAIL`     | Owner có nhà hàng, chưa khai báo lịch: F-45 Update Business Hour |
| `ANGI_TEST_STATUS_OWNER_EMAIL`    | Owner có nhà hàng đã xác minh, đang mở: F-46 Update Status       |
| `ANGI_TEST_SUSPENDED_OWNER_EMAIL` | Owner có nhà hàng bị đình chỉ, đang tạm đóng: thử từ chối mở lại |
| `ANGI_TEST_EMPTY_OWNER_EMAIL`     | Owner chưa có nhà hàng: thử chuyển tới đăng ký từ trang hồ sơ    |
| `ANGI_TEST_PASSWORD`              | Mật khẩu chung cho các tài khoản của lượt này                    |

Không điền nguyên tên biến vào form; dùng giá trị ở bên phải dấu `=`. Đăng xuất trước khi đổi tài khoản. Nếu FE ở cả 3000 và 3001 cùng chạy, cookie cùng hostname có thể ảnh hưởng lẫn nhau; nên dùng một FE khi tự test hoặc tách profile trình duyệt.

Bước chuẩn bị hiện lấy thêm public token Mapbox từ BE vào `.env.integration` để chạy bản đồ trong bản sao. Nếu file này được tạo trước thay đổi đó, hoàn tất/dọn lượt cũ rồi chuẩn bị lượt mới. Bản sao vẫn dùng source của local `dev`, không tự dùng code chưa commit hoặc FE `.env`. Bộ kiểm thử tự động ở mục 6 chủ động tắt Mapbox và nhập tọa độ; bộ kiểm tra riêng Mapbox là `npx playwright test --config=playwright.map.config.ts`.

**Sau khi tự test xong:** nhấn `Ctrl+C` ở terminal FE. Nếu đã upload ảnh bằng `ANGI_TEST_OWNER_EMAIL` và không cần xem lại ảnh nữa, dọn ảnh của lượt đó:

```powershell
./scripts/cleanup-live-tests.ps1
Remove-Item Env:ANGI_TEST_SOURCE_REF -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN -ErrorAction SilentlyContinue
```

Cleanup xóa file Cloudinary của **đúng Owner đăng ký mới thuộc lượt hiện tại**, giữ metadata/database. Vì vậy ảnh có thể không tải được khi xem lại nhà hàng của lượt đã dọn. Công cụ này không dọn ảnh tải lên bởi các tài khoản khác. Chỉ dọn sau khi xem/chụp xong; dọn lượt cũ **trước** lần `prepare-live-tests.ps1` tiếp theo, vì bước chuẩn bị ghi lại `.env.integration` cho lượt mới. Chuẩn bị mới không xóa nhà hàng/tài khoản của lượt cũ.

### 4.2. Chạy mã nguồn đang mở để phát triển hằng ngày

Sau khi cấu hình mục 3.1, dùng một terminal FE mới:

```powershell
Set-Location C:\FPTU\Capstone\angi-frontend
npm run dev -- --port 3000
```

Mở <http://localhost:3000/login> và đăng nhập tài khoản seed tại mục 2.3. Các đường dẫn ở mục 5 cũng dùng được bằng cách thay origin thành `http://localhost:3000`.

Cách này dùng source đang mở, bao gồm thay đổi local. Với nhánh cũ `7bb3e1d`, F-43/F-45 có tích hợp thật nhưng tab trạng thái còn chỉ đọc. Nếu muốn thử ANGI-55 ngay, quay lại mục 4.1. Thay đổi file source hiện tại cũng không tự xuất hiện trong bản sao `dev` đang chạy.

## 5. Tự kiểm thử trên giao diện với BE thật

Các URL trong mục này dùng bản sao ở cổng **3001**. Mở DevTools → **Network**, bật Preserve log nếu cần. Lọc `owner/restaurant` hoặc `media` để quan sát request. Không chia sẻ request đăng nhập, cookie, token hoặc ảnh chụp chứa thông tin bí mật.

Sau mỗi thao tác lưu, **tải lại trang** để kiểm tra dữ liệu vẫn còn. Trang `/demo/owner` là fixture minh họa, không dùng để xác nhận dữ liệu đã lưu vào BE.

### 5.1. ANGI-36 — F-43 Register Restaurant

Đăng nhập bằng giá trị `ANGI_TEST_OWNER_EMAIL` / `ANGI_TEST_PASSWORD`, mở <http://localhost:3001/restaurant/register>.

1. Bấm đăng ký khi chưa nhập gì: phải có lỗi tại trường bắt buộc và chưa tạo nhà hàng.
2. Nhập dữ liệu dễ nhận ra, ví dụ tên `Quán tự kiểm thử ANGI`, điện thoại `0901234567`, địa chỉ `24 Nguyễn Hữu Huân`. Tại tỉnh/thành, thử gõ `ha noi` rồi chọn `Thành phố Hà Nội` từ gợi ý; điền quận/huyện `Quận Hoàn Kiếm` và các trường bắt buộc còn lại. Các ô tỉnh/thành, điểm đến và tìm địa điểm dùng chung Provinces Open API, kể cả demo. Danh mục hiện là v1 trước sáp nhập để khớp API nhà hàng còn bắt buộc quận/huyện. Khi API lỗi vẫn nhập tay được; bấm **Tải lại danh sách tỉnh/thành** để thử lại mà không mất nội dung. Kiểm thử riêng: `npx playwright test --config=playwright.province.config.ts`.
3. Bấm **Chọn vị trí trên bản đồ**. Lăn chuột trong modal để phóng to/thu nhỏ, không cần giữ Ctrl; nhấn giữ chuột trái trên bản đồ rồi kéo để di chuyển. Kéo/zoom chỉ đổi góc nhìn, ghim vẫn gắn với tọa độ đã chọn. Bấm một điểm trên bản đồ để chọn vị trí mới, hoặc tìm địa chỉ ở góc trên trái. Dùng bàn phím: focus vào bản đồ, phím mũi tên để di chuyển rồi Enter/Space để chọn tâm. Muốn nhập thủ công, bấm **Nhập tọa độ**, nhập vĩ độ `21.0285`, kinh độ `105.8542`, rồi bấm **Lưu** ở phía dưới. Khi thiếu token, không hỗ trợ WebGL hoặc không tải được bản đồ, bảng nhập tọa độ tự mở. Hai thẻ thông tin phía trên ghim và chính giữa phía dưới có nút `×` riêng: đóng thẻ vẫn giữ ghim/tọa độ; kéo/zoom không tự mở lại thẻ, bấm ghim để hiện lại.
4. Bấm khung ảnh xám có dấu `+` để chọn ảnh bìa/ảnh nhà hàng. Ảnh hiển thị preview; nút `×` nhỏ dùng để bỏ ảnh khỏi form. Thử thêm hai ảnh nhà hàng rồi bỏ một ảnh.
5. Thử PDF, file vượt `5 * 1024 * 1024` byte hoặc hơn 10 ảnh nhà hàng: phải báo lỗi. Loại được hỗ trợ là JPG/PNG/WEBP, tối đa một ảnh bìa và 10 ảnh nhà hàng.
6. Khi đang có thay đổi, bấm **Hủy**: phải hiện modal xác nhận; chọn tiếp tục đăng ký để giữ dữ liệu.
7. Bấm **Đăng ký nhà hàng**. Upload ảnh đi qua `POST /api/backend/media`; tạo nhà hàng đi qua `POST /api/backend/owner/restaurant`, thành công **201**.
8. Mở <http://localhost:3001/restaurant/profile>, tải lại trang: tên, địa chỉ, tọa độ và ảnh đã chọn phải giữ đúng. Nhà hàng mới có trạng thái xác minh **chưa xác minh / `unverified`**.
9. Quay lại trang đăng ký bằng cùng tài khoản: phải thông báo đã có nhà hàng, không tạo bản thứ hai. BE từ chối tạo trùng bằng **409 / `OWNER_ALREADY_HAS_RESTAURANT`**.

Mỗi Owner chỉ có một nhà hàng. Để tự đăng ký lại từ đầu, kết thúc/dọn lượt cũ rồi chạy bước chuẩn bị cho lượt mới. Không xóa database để lặp lại kịch bản này. Bỏ ảnh khỏi form không đồng nghĩa file vừa upload đã được xóa trên Cloudinary; cleanup theo lượt thực hiện việc dọn file riêng.

### 5.2. F-44 — xem/sửa hồ sơ, kiểm tra thêm nếu cần

Sau khi đăng ký hoặc khi dùng Owner đã có nhà hàng, mở <http://localhost:3001/restaurant/profile>. Sửa tên/mô tả/địa chỉ, lưu và tải lại. Việc đọc dùng `GET /api/backend/owner/restaurant`, sửa thông tin dùng `PATCH` cùng đường dẫn. Sửa hồ sơ không được tự đổi lịch giờ hoặc trạng thái hoạt động. Nếu thử thay ảnh với tài khoản ngoài `ANGI_TEST_OWNER_EMAIL`, lưu ý cleanup ở mục 4.1 không dọn ảnh của tài khoản đó.

### 5.3. ANGI-48 — F-45 Update Business Hour

Đăng xuất rồi đăng nhập bằng `ANGI_TEST_HOURS_OWNER_EMAIL`, mở <http://localhost:3001/restaurant/profile?tab=hours>.

| Thao tác                                                                    | Kết quả cần thấy                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Thứ hai thêm `06:00–11:00` và `22:00–02:00`, thứ ba thêm `02:00–05:00`; lưu | Hỗ trợ nhiều khung/ngày và qua đêm; hai khoảng tiếp giáp ở `02:00` hợp lệ |
| Tải lại trang                                                               | Các khoảng vừa lưu vẫn đúng                                               |
| Đổi thứ ba thành `01:00–05:00` rồi lưu                                      | Báo chồng lấn với khoảng qua đêm thứ hai; không ghi lịch sai              |
| Nhập giờ mở bằng giờ đóng                                                   | Báo lỗi; không diễn giải thành mở 24 giờ                                  |
| Thử thứ bảy `23:00–02:00`, chủ nhật `01:00–03:00`                           | Báo chồng lấn qua ranh giới tuần                                          |
| Chỉnh giờ rồi bấm **Hủy thay đổi** → xác nhận **Bỏ thay đổi**               | Modal xuất hiện và form trở về giá trị đã lưu                             |
| Bấm **Xóa lịch tuần** → xác nhận, sau đó bấm lưu                            | Lưu lịch rỗng; tải lại vẫn chưa khai báo giờ                              |
| Thu nhỏ trình duyệt về chiều rộng khoảng 390 px                             | Có thể nhập/lưu, không tràn ngang toàn trang                              |

Lưu lịch gửi **PUT `/api/backend/owner/restaurant/business-hours`**, BE tương ứng **OWN-04**. Request thay toàn bộ lịch bằng `{ "hours": [...] }`, lịch rỗng là `{ "hours": [] }`. Mỗi khoảng có `dayOfWeek`, `openTime`, `closeTime`; Chủ nhật là `0`, thứ hai là `1`, giờ `HH:mm` theo Việt Nam UTC+7. Phản hồi thành công **200**, có `hours` và `isOpenNow`.

`isOpenNow` theo lịch và trạng thái hoạt động do Owner chọn là hai thông tin riêng. Lưu giờ không tự đổi trạng thái hoạt động ở tab bên cạnh.

### 5.4. ANGI-55 — F-46 Update Status

Đăng nhập bằng `ANGI_TEST_STATUS_OWNER_EMAIL`, mở <http://localhost:3001/restaurant/profile?tab=status>.

1. Phải thấy trường **Trạng thái mới** và **Lý do (không bắt buộc)**. Nếu chỉ thấy thẻ trạng thái chỉ đọc thì kiểm tra phiên bản FE theo mục 4.
2. Chọn tạm đóng, nhập lý do rồi bấm **Cập nhật trạng thái**: hiện modal xác nhận. Chọn **Tiếp tục chỉnh sửa**, tải lại: trạng thái đã lưu vẫn đang mở.
3. Thực hiện lại và **Xác nhận cập nhật**. Request **PUT `/api/backend/owner/restaurant/operating-status`** thành công **200**; tải lại vẫn tạm đóng.
4. Lần lượt thử đóng vĩnh viễn và mở lại trên tài khoản fixture bình thường. Ba giá trị API là `open`, `temporarily_closed`, `permanently_closed`.
5. Thử lý do dài tối đa 500 ký tự. Giao diện/BE phải bảo vệ giới hạn, không lưu lý do vượt 500 ký tự.
6. Đổi sang `ANGI_TEST_SUSPENDED_OWNER_EMAIL`. Thử mở lại nhà hàng bị đình chỉ: BE trả **409 / `RESTAURANT_SUSPENDED`**, FE hiển thị lỗi và không đổi sang mở. Các lựa chọn đóng vẫn được xử lý theo quy tắc của BE.

Cập nhật trạng thái hoạt động không tự đổi trạng thái xác minh hoặc trạng thái kiểm duyệt. Các yêu cầu xác nhận cần hiện **popup modal**, không phải `alert`/`confirm` mặc định của trình duyệt.

### 5.5. Phân quyền và tài khoản chưa có nhà hàng

- Đăng nhập bằng `ANGI_TEST_EMPTY_OWNER_EMAIL`, vào trang hồ sơ/giờ/trạng thái: cần có hướng dẫn đăng ký nhà hàng. BE đọc nhà hàng của tài khoản này trả **404** là đúng vì chưa có dữ liệu.
- Đăng nhập Traveler rồi truy cập đường dẫn Owner: không được xem/sửa nghiệp vụ Owner. API Owner với sai vai trò phải bị từ chối.
- Đăng xuất, thử vào lại trang Owner: cần đăng nhập lại.

## 6. Chạy bộ kiểm thử FE với BE thật

Các lệnh sau dùng lại cổng **3001**. **Dừng FE bản sao đang chạy thủ công bằng `Ctrl+C` trước khi chạy test.** Có thể giữ BE hoạt động. Nếu lượt thủ công đã upload ảnh, dọn lượt đó trước khi chuẩn bị lượt tự động mới.

### 6.1. Cài Chromium một lần

Tại FE root, sau `npm ci`:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.cache\browsers'
npx playwright install chromium
```

### 6.2. Bộ riêng cho ANGI-36, ANGI-48, ANGI-55

Chạy trong một terminal FE mới. Khối lệnh tự dừng khi bước chuẩn bị hoặc test thất bại và vẫn thử dọn ảnh sau khi test:

```powershell
Set-Location C:\FPTU\Capstone\angi-frontend
./scripts/prepare-live-tests.ps1
if (!$?) { throw 'Chuan bi du lieu live that bai.' }

$env:ANGI_TEST_OWNER_TASKS = '1'
$env:ANGI_TEST_SOURCE_REF = 'dev'
try {
    npm run test:live
    if ($LASTEXITCODE -ne 0) { throw 'Kiem thu live that bai; xem log truoc khi chay lai.' }
    ./scripts/check-owner-task-persistence.ps1
} finally {
    try {
        ./scripts/cleanup-live-tests.ps1
    } finally {
        Remove-Item Env:ANGI_TEST_OWNER_TASKS -ErrorAction SilentlyContinue
        Remove-Item Env:ANGI_TEST_SOURCE_REF -ErrorAction SilentlyContinue
    }
}
```

Playwright tự chạy FE trong bản sao local `dev`, đăng nhập thật, gọi BE thật và upload Cloudinary thật. Lần chạy đã ghi trong báo cáo là **8 passed, 1 skipped**: case skipped là chẩn đoán riêng cho nhánh cũ, không phải tính năng bị bỏ kiểm thử. Đây là mốc để so sánh, không phải cam kết mọi lần chạy sau đều có kết quả đó. Thời gian chờ khởi động FE được đặt tối đa 240 giây.

`check-owner-task-persistence.ps1` đọc lại database/audit của đúng lượt, kiểm tra trạng thái cuối `Open`, `Verified`, `Visible`, có ít nhất ba chuyển trạng thái và lý do được lưu đúng. Chỉ dùng sau bộ Owner tự động chạy đủ thành công; các thao tác thủ công tùy ý hoặc bộ smoke mặc định không tạo đúng điều kiện cho kiểm tra audit này.

Muốn kiểm thử source đang mở, bỏ `ANGI_TEST_SOURCE_REF` và chuẩn bị lượt mới. Với nhánh cũ, kết quả từng ghi là **7 passed, 2 skipped**, trong đó một case pass là chẩn đoán xác nhận thiếu ANGI-55. Không diễn giải kết quả đó thành cả ba tính năng đã đạt; cũng không áp dụng kiểm tra audit đầy đủ cho nhánh thiếu ANGI-55.

Mỗi lần lặp lại bộ đăng ký cần dữ liệu mới. Luôn cleanup lượt cũ trước khi prepare lượt mới. Nếu muốn xem ảnh nhà hàng sau khi test, chờ hoàn tất việc xem trước khi chạy cleanup thay vì dùng khối tự dọn ở trên.

### 6.3. Bộ live mặc định và nơi xem kết quả

Không đặt `ANGI_TEST_OWNER_TASKS` thì `npm run test:live` chạy `tests/live/real-backend.spec.ts`: bộ 3 test kiểm tra tích hợp chung, khác với bộ riêng ba task. Cũng cần chuẩn bị lượt mới và dọn ảnh sau khi hoàn tất.

| File/thư mục trong FE                   | Ý nghĩa                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `artifacts/owner-tasks-dev.json`        | Kết quả bộ Owner chạy bản sao `dev`                                                                    |
| `artifacts/owner-tasks-working.json`    | Kết quả bộ Owner chạy source đang mở                                                                   |
| `artifacts/owner-task-persistence.json` | Kiểm tra trạng thái/audit PostgreSQL sau bộ Owner thành công                                           |
| `artifacts/owner-dev-*.png`             | Ảnh chụp minh họa các màn hình trong bộ Owner                                                          |
| `test-results/.last-run.json`           | Tóm tắt lượt Playwright gần nhất, có thể bị bộ khác ghi lại; không phải báo cáo đầy đủ của tất cả task |

Các suite `playwright.owner.config.ts`, `playwright.profile.config.ts`, `playwright.hours.config.ts` dùng API stub phục vụ kiểm thử FE. `npm run test:browser` cũng không thay thế bộ `test:live` để chứng minh tích hợp BE thật. Chạy các suite dùng cổng 3001 tuần tự.

## 7. Kiểm tra thêm API, database và chất lượng code

### 7.1. HTTP smoke gọi BE đang chạy

Tại **BE root** sau khi Start/seed thành công:

```powershell
Set-Location C:\FPTU\Capstone\angi-backend
node --env-file=.env docker/local/test-http.mjs
```

Script gọi API đang chạy với đăng nhập/JWT thật và dữ liệu local, kiểm tra 15 nhóm hành vi gồm auth/session, profile, discovery/menu và một số nghiệp vụ Owner. Kết quả ở **`angi-backend/TestResults/local/http-checks.json`**. Script có cập nhật dữ liệu fixture local; không trỏ nó vào môi trường dùng chung hoặc production. Bộ này không bao phủ mọi endpoint hay mọi luồng thành công của Sprint 1.

### 7.2. Toàn bộ test BE và kiểm tra Cloudinary riêng

Tại **BE root**:

```powershell
docker compose -f docker-compose.local.yml run --rm tests
```

Unit test và integration test được chạy bằng .NET trong container. Các bài PostgreSQL dùng database riêng **`angi_test`** và reset schema test; dữ liệu ứng dụng local nằm ở `angi_local`. TRX nằm trong **`TestResults/local/`**. Factory của suite integration thay thế ranh giới email, Google, Cloudinary và recommendation; kết quả suite này không chứng minh tất cả nhà cung cấp thật đã hoạt động.

Sau khi đã build test bằng lệnh trên, muốn kiểm tra Cloudinary thật riêng:

```powershell
docker compose -f docker-compose.local.yml run --rm -e RUN_CLOUDINARY_LIVE_TESTS=1 tests dotnet test ANGI.IntegrationTests/ANGI.IntegrationTests.csproj -c Release --no-build --filter CloudinaryLiveTests
```

Bài provider này upload rồi xóa asset của chính bài test, có sử dụng dịch vụ Cloudinary thật. Không tự bật kiểm tra gửi email tới người khác.

### 7.3. Kiểm tra FE và chạy bản production local

Tại **FE root**:

```powershell
npm run lint
npm test
npm run build
npm run typecheck
```

Build trước standalone typecheck trên checkout mới để Next tạo route types. Những lệnh này kiểm tra source đang mở, không phải bản sao `dev` của mục 4.1. Muốn chạy output production local sau khi build thành công, dừng FE đang dùng cổng 3000 rồi chạy:

```powershell
npm run start -- --port 3000
```

Cấu hình `APP_URL` vẫn phải khớp `http://localhost:3000`; biến public được chọn lúc build. Khi thử đăng nhập qua HTTP local, dùng development ở mục 4 cho quy trình chính; session production yêu cầu kiểm tra thêm cấu hình HTTPS/secure cookie. Kết quả local không thay thế kiểm thử triển khai production.

## 8. Dừng, mở lại và xem lỗi

### 8.1. Những lần chạy sau

1. Mở Docker Desktop.
2. Ở BE root chạy `./docker/local/Start.ps1`.
3. Chạy FE theo mục 4.1 nếu muốn đủ ba task từ local `dev`, hoặc mục 4.2 nếu muốn source đang mở. Không cần `npm ci` lại khi dependency không đổi.
4. Đăng nhập, thao tác và tải lại trang để xác nhận dữ liệu.

Muốn tiếp tục xem dữ liệu lượt thủ công cũ, dùng lại `.env.integration` hiện có và chỉ chạy lệnh server ở mục 4.1; không prepare lượt mới. Ảnh chỉ còn dùng được nếu chưa cleanup.

Dừng FE bằng `Ctrl+C`. Dừng BE nhưng giữ dữ liệu, tại BE root:

```powershell
docker compose -f docker-compose.local.yml stop
```

Không cần xóa volume để khởi động lại hoặc tạo Owner mới.

### 8.2. Xem log và nạp lại cấu hình BE

Tại BE root:

```powershell
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs --tail=100 api
docker compose -f docker-compose.local.yml logs --tail=100 postgres
```

Sau khi sửa khóa/cấu hình BE `.env`, tạo lại container API để nạp env:

```powershell
docker compose -f docker-compose.local.yml up -d --force-recreate api
```

Sau khi sửa mã BE, có thể `docker compose -f docker-compose.local.yml restart api` để `dotnet run` build/chạy lại; chờ OpenAPI trả 200 rồi test tiếp. Không chia sẻ log chứa thông tin nhạy cảm. Nếu chỉ muốn kiểm tra cú pháp Compose, dùng `docker compose -f docker-compose.local.yml config --quiet` để tránh in toàn bộ cấu hình đã thay biến.

### 8.3. Lỗi thường gặp

**Đăng nhập trả `503 SERVICE_UNAVAILABLE` dù mở được OpenAPI:** kiểm tra `API_BASE_URL` trong FE. Với stack Docker local, dùng `http://127.0.0.1:5154/api/v1`. Node.js trên máy này phân giải `localhost` thành IPv6 `::1`, trong khi Compose chỉ mở cổng BE trên IPv4 `127.0.0.1`; đã tái hiện lỗi `ECONNREFUSED ::1` khi dùng `localhost`. Trình duyệt/PowerShell mở OpenAPI được không chứng minh process Node.js kết nối được qua cùng hostname. Sau khi sửa `.env`, khởi động lại FE nếu vẫn còn lỗi. Giữ `APP_URL=http://localhost:3000` khi trình duyệt đang mở FE ở cổng 3000. Cảnh báo thiếu Google Client ID là cấu hình Google sign-in riêng, không gây lỗi kết nối đăng nhập email/mật khẩu này. Thay đổi địa chỉ local không thay method, DTO hoặc contract API.

| Hiện tượng                                                | Kiểm tra/cách xử lý                                                                                                                                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PowerShell chặn `.ps1`                                    | Nếu execution policy cho phép, mở quyền trong terminal hiện tại bằng `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`; sau đó chạy lại script. Thiết lập này hết khi đóng terminal, không ghi đè Group Policy của máy |
| PowerShell chặn `npm.ps1`/`npx.ps1`                       | Dùng `npm.cmd`/`npx.cmd` với cùng tham số                                                                                                                                                                                         |
| Docker báo không kết nối engine/named pipe                | Mở Docker Desktop, chờ engine sẵn sàng, kiểm tra lại `docker version`                                                                                                                                                             |
| API không lên hoặc OpenAPI chưa có `200`                  | Xem log `api`/`postgres`; kiểm tra restore/build, env và sức khỏe database. Gọi `/api/v1` đơn thuần không phải phép kiểm tra readiness vì không nhất thiết có endpoint tại đó                                                     |
| API Owner/upload trả `500` liên quan Cloudinary           | Kiểm tra đủ ba biến Cloudinary trong BE `.env`, rồi recreate `api`. Có khóa nhưng sai/quá hạn vẫn không upload được                                                                                                               |
| FE báo lỗi `SESSION_PASSWORD`                             | Khóa FE cần ít nhất 32 ký tự; sửa đúng nguồn env ưu tiên, khởi động lại FE và đăng nhập lại                                                                                                                                       |
| Sửa `.env` nhưng hành vi không đổi                        | Kiểm tra `.env.local`, `.env.development.local`, biến terminal; FE cần restart/build lại, BE cần recreate API để nhận env mới                                                                                                     |
| FE gửi mutation nhận `403` do Origin                      | Mở bằng đúng `http://localhost:3000` hoặc `http://localhost:3001` tương ứng `APP_URL`; không đổi hostname/cổng tùy ý trong browser                                                                                                |
| Tab trạng thái chỉ đọc hoặc PUT trả `404 ROUTE_NOT_FOUND` | FE đang chạy nhánh cũ thiếu ANGI-55. Dùng bản sao `dev` theo mục 4.1 và xem commit in ở terminal                                                                                                                                  |
| Owner profile trả `404` với tài khoản mới                 | Chưa có nhà hàng; vào đăng ký. Khác với lỗi proxy `ROUTE_NOT_FOUND` ở trên                                                                                                                                                        |
| Đăng ký nhà hàng trả `409 OWNER_ALREADY_HAS_RESTAURANT`   | Tài khoản đã đăng ký; dùng bộ Owner mới sau khi dọn lượt cũ, không đăng ký tiếp bằng cùng Owner                                                                                                                                   |
| Đăng nhập seed thất bại sau khi sửa mật khẩu env          | Seed không thay mật khẩu tài khoản đã tồn tại. Dùng mật khẩu gốc của tài khoản hoặc tạo lượt mới để lấy user mới với mật khẩu hiện tại                                                                                            |
| PostgreSQL báo sai mật khẩu sau khi sửa `.env`            | Đổi env không đổi mật khẩu role trong volume đã khởi tạo; khôi phục cấu hình khớp role hoặc xử lý role riêng. Không xóa volume như bước sửa lỗi thông thường                                                                      |
| Cổng 3000/3001/5154/5434 đang được dùng                   | Kiểm tra tiến trình/container đang giữ cổng. Dừng đúng phiên của mình; test live và helper dùng cố định 3001 nên không chạy đồng thời                                                                                             |
| Playwright không tìm thấy Chromium                        | Cài bằng mục 6.1 và dùng đúng `.cache/browsers`; file `.env.integration` được chuẩn bị cũng trỏ về cache này                                                                                                                      |
| Playwright timeout khi khởi động                          | Đảm bảo cổng 3001 trống, dependency có đủ, BE đã sẵn sàng; xem lỗi compiler trong log. Tránh chạy nhiều suite cùng cổng                                                                                                           |
| Ảnh của lượt cũ không còn tải được                        | Nếu đã cleanup thì file Cloudinary đã xóa, database vẫn giữ metadata. Tạo lượt mới để test upload lại                                                                                                                             |
| Không hiện bản đồ/tìm địa chỉ                             | FE chưa có public Mapbox token hoặc chưa đủ quyền geocoding. Nhập tọa độ thủ công để kiểm thử nghiệp vụ; BE token không tự truyền sang FE                                                                                         |

Nếu dùng công cụ database như DBeaver/pgAdmin, kết nối Windows tới `127.0.0.1:5434`, database `angi_local`, user/password backend trong BE `.env`, schema `core`. Bên trong Docker, API dùng `postgres:5432`; không thay connection string container bằng cổng host 5434.

## 9. Phạm vi hiện có và các phần chưa thể kết luận chạy đầy đủ

- **Ba task Owner:** bản local `dev` đã có tích hợp thật trong phạm vi báo cáo. Nhánh làm việc cũ còn thiếu ANGI-55. Upload thật trong lượt kiểm thử riêng đã dùng PNG; JPG/WEBP và sự cố mạng/provider cần tự thử thêm nếu muốn mở rộng kết luận.
- **Trạng thái nhà hàng mới:** mẫu JSON OWN-01 trong API Design v1.8 ghi `verified`, nhưng mô tả endpoint và data dictionary quy định `unverified`. BE tạo mới `unverified` là hành vi được dùng trong hướng dẫn này; không coi thiếu xác minh là lỗi đăng ký.
- **Demo và các màn hình khác:** `/demo` dùng dữ liệu minh họa; nhiều màn hình ngoài các tích hợp được ghi nhận vẫn chưa có adapter nghiệp vụ live. Thấy demo thao tác được không chứng minh BE đã lưu. Xem [trạng thái triển khai](../README.md#current-implementation-status) và báo cáo để phân biệt.
- **Email/Google:** đăng nhập bằng account seed giúp thử Owner độc lập với hai luồng này. Gửi/nhận email thật chưa được xác minh trong lượt Owner; FE còn vấn đề route gửi lại xác minh email và xử lý role/tài khoản Google mới, được nêu trong báo cáo Sprint 1. Chỉ dùng mailbox của bạn hoặc người đã đồng ý khi tự thử email.
- **Recommendation:** chưa có service recommendation chạy cùng workspace này. Khi chưa có base URL, một số API dùng fallback hoặc trả `503`; không phải bước bắt buộc cho đăng ký, lịch giờ và trạng thái nhà hàng. Muốn thử thành công cần repository/service riêng, base URL nhìn được từ container, API key khớp và dữ liệu cần thiết. Nếu service chạy trên Windows ở cổng 8000, địa chỉ từ container là `http://host.docker.internal:8000`.
- **Bản đồ/GPS và deployment:** chưa xác nhận chọn bản đồ/tìm kiếm/GPS trên thiết bị thật hay môi trường production. Có thể tự kiểm thử các phần đó sau khi cấu hình tương ứng.

Tài liệu liên quan:

- [Báo cáo chi tiết ANGI-36, ANGI-48, ANGI-55 với BE thật](owner-tasks-live-verification.vi.md).
- [Báo cáo tích hợp Sprint 1 bằng tiếng Việt](live-backend-verification.vi.md).
- [Báo cáo tích hợp Sprint 1 bằng tiếng Anh](live-backend-verification.md).
- [Setup FE](setup.md) và [stack BE local](../../angi-backend/docker/local/README.md).
