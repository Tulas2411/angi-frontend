# Kiểm thử ANGI-36, ANGI-48 và ANGI-55 với backend thật

Ngày kiểm tra: **15/10/2026**. Báo cáo này tập trung vào ba task Owner do bạn giao, bổ sung kết quả mới cho báo cáo Sprint 1 trước đó. Tất cả lời gọi nghiệp vụ trong các lượt kiểm thử dưới đây đi qua FE Next.js, BE Kestrel và PostgreSQL thật; các lượt upload hợp lệ sử dụng Cloudinary thật. Không giả lập phản hồi API.

## Kết luận theo từng task

| Task                                    | Nhánh đang mở: `test/real-backend-integration`, gốc `7bb3e1d`                                                        | Bản `dev` đã merge ANGI-55: `4bda386`                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ANGI-36 — F-43 Register Restaurant**  | Các luồng đăng ký, upload ảnh, validation và chống đăng ký trùng đã đạt.                                             | Đạt các kịch bản đã kiểm thử, có kiểm tra thêm bỏ ảnh đã chọn trước khi lưu. Vị trí được nhập bằng tọa độ; bản đồ cần cấu hình thêm như nêu bên dưới. |
| **ANGI-48 — F-45 Update Business Hour** | Đạt: nhiều khung giờ, qua đêm, ranh giới tuần, validation, hủy thay đổi và xóa lịch.                                 | Đạt cùng các nhóm hành vi, dữ liệu giữ đúng sau khi tải lại trang.                                                                                    |
| **ANGI-55 — F-46 Update Status**        | **Chưa hoạt động.** Tab trạng thái chỉ đọc, không có form cập nhật; FE trả `404 ROUTE_NOT_FOUND` cho PUT trạng thái. | **Đạt.** Có form cập nhật, xác nhận bằng modal, lưu được ba trạng thái và xử lý đúng lỗi nhà hàng bị đình chỉ.                                        |

**Cả ba task đã chạy thành công với BE thật trên bản `dev` tại commit `4bda386ed2e9520870a465828281498f339fd4e3`, trong phạm vi kịch bản ghi ở báo cáo này. Nhánh đang mở vẫn thiếu ANGI-55; chạy FE từ nhánh đó sẽ chưa cập nhật được trạng thái.**

## Những chỗ hiện chưa hoạt động đúng hoặc còn thiếu

### 1. Nhánh đang mở chưa có code ANGI-55 mới nhất

- Nhánh làm việc hiện tại có HEAD `7bb3e1d0dd9b585d1768c31a3e0ce766f9317fae`, chậm hơn local `dev` 2 commit. Local `dev` đã có merge PR #15 của ANGI-55.
- Tái hiện: đăng nhập Owner, mở `/restaurant/profile?tab=status`. Nhánh cũ chỉ hiển thị thẻ **Trạng thái nhà hàng**, không có trường **Trạng thái mới**.
- Gửi `PUT /api/backend/owner/restaurant/operating-status` trên nhánh cũ nhận **404 / `ROUTE_NOT_FOUND`**. Trạng thái trong BE không đổi.
- Nguyên nhân nằm ở phiên bản FE đang chạy: proxy cũ chưa cho phép endpoint và router cũ chưa dùng màn hình cập nhật trạng thái. API BE thật vẫn hoạt động.
- Cần đưa FE chạy về bản có đủ thay đổi của `dev`/ANGI-55, đồng thời giữ các thay đổi local chưa commit. Lần kiểm tra này dùng bản sao chỉ đọc của commit `dev` để xác minh, không merge, chuyển nhánh hay sửa lịch sử Git.
- Bằng chứng: `artifacts/owner-working-missing-status-integration.png` và `artifacts/owner-tasks-working.json`.

### 2. Bản đồ trực quan/tìm địa chỉ chưa được bật trong cấu hình FE hiện tại

- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` trong `.env` FE đang để trống tại thời điểm kiểm tra. Bộ kiểm thử cũng chủ động để trống biến này.
- Vì vậy, chưa sử dụng được bản đồ Mapbox để chấm điểm hoặc tìm địa chỉ. Popup vẫn cho nhập **Vĩ độ/Kinh độ**; cách này đã tạo nhà hàng thành công và lưu đúng tọa độ trong BE.
- Để dùng bản đồ thật cần cấu hình public token Mapbox `pk.*` cho FE và khởi động lại FE. Khóa `Mapbox__AccessToken` phía BE phục vụ cấu hình BE, không tự truyền sang biến public của FE.
- Đây là phần thiếu cấu hình của chọn vị trí, không phải lỗi của `POST /api/v1/owner/restaurant`. Báo cáo chưa xác nhận tìm địa chỉ, chấm bản đồ hoặc GPS trên thiết bị thật đã hoạt động.

### 3. Mẫu JSON đăng ký nhà hàng chưa đồng nhất với mô tả endpoint

- API Design v1.8, sheet `JSON mẫu`, ô `D1803` của phản hồi **OWN-01** đang ghi `verificationStatus: "verified"`.
- Cùng file đó, sheet `Backend API`, ô `G58` và `N58` quy định nhà hàng mới tạo ở trạng thái **unverified**. Data Dictionary v1.2, sheet `Core`, hàng 83 cũng có giá trị mặc định `unverified`.
- BE thật trả `unverified` sau đăng ký, FE hiển thị chưa xác minh. Đây là hành vi phù hợp với quy trình đăng ký rồi nộp hồ sơ xác minh, không phải lỗi khiến FE đăng ký thất bại.
- Cần chỉnh mẫu JSON OWN-01 để không dùng trạng thái của nhà hàng đã được xác minh làm mẫu kết quả tạo mới. Báo cáo này ghi nhận sai lệch tài liệu; không đổi workbook hoặc đổi hành vi đăng ký sang `verified`.

### 4. Giới hạn của kết luận kiểm thử

- Upload ảnh thật được chạy với PNG. JPG/WEBP có trong danh sách loại ảnh được hỗ trợ của mã nguồn, nhưng chưa upload file thật của hai định dạng này trong lượt kiểm tra riêng này.
- Chưa tạo sự cố mạng, timeout Cloudinary hoặc BE ngừng chạy để kiểm thử trực tiếp luồng khôi phục/retry của ba màn hình. Không kết luận các tình huống đó đã đạt chỉ dựa trên luồng thành công.
- Không kiểm thử production/deployment trong lượt này. Kết quả áp dụng cho mã nguồn và môi trường local được ghi bên dưới.
- Tài khoản Owner được tạo và kích hoạt sẵn trong database test local, sau đó đăng nhập thật để nhận phiên/JWT thật. Kết quả này không xác nhận luồng đăng ký tài khoản, gửi email xác minh hoặc Google OAuth; các luồng đó nằm ngoài ba task đang xét.

## Chi tiết ANGI-36 — F-43 Register Restaurant

Endpoint: **OWN-01** `POST /api/v1/owner/restaurant`, **MEDIA-01** `POST /api/v1/media`; dùng **OWN-02** để kiểm tra dữ liệu sau khi lưu.

| Kịch bản                                                             | Kết quả thực tế                                                                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bỏ trống thông tin bắt buộc và chưa chọn tọa độ                      | FE hiện lỗi ở các trường, không gửi yêu cầu tạo nhà hàng.                                                                                     |
| Chọn PDF làm ảnh                                                     | FE từ chối trước khi upload. Gửi multipart trực tiếp qua proxy cũng nhận **400 / `UNSUPPORTED_MEDIA_TYPE`** từ BE.                            |
| Chọn ảnh vượt 5 MB theo giới hạn triển khai (`5 * 1024 * 1024` byte) | FE từ chối trước khi upload. BE thật cũng trả **400 / `FILE_TOO_LARGE`** khi gửi file vượt giới hạn qua proxy.                                |
| Chọn 11 ảnh nhà hàng                                                 | FE báo tối đa 10 ảnh và không upload. BE thật từ chối danh sách `imageMediaIds` vượt giới hạn với **400 / `VALIDATION_FAILED`**.              |
| Thiếu hoặc sai phạm vi tọa độ                                        | BE thật trả **400 / `VALIDATION_FAILED`**, giữ lỗi theo trường.                                                                               |
| Nhập tọa độ trong popup                                              | Lưu đúng latitude `21.0285`, longitude `105.8542` sau khi đăng ký.                                                                            |
| Upload ảnh bìa và hai ảnh nhà hàng                                   | Ba lượt upload thật thành công qua FE → BE → Cloudinary; FE nhận media để gắn vào request đăng ký.                                            |
| Nút x và khung tải ảnh                                               | Nút bỏ ảnh đo được không quá 26 px, opacity nhỏ hơn 1. Khung chọn ảnh dùng dấu cộng; input file gốc được ẩn bằng CSS.                         |
| Bỏ một ảnh nhà hàng trước khi lưu, trên bản `dev`                    | Ảnh được bỏ khỏi danh sách gửi; GET sau đăng ký chỉ có một ảnh nhà hàng còn lại.                                                              |
| Bấm Hủy rồi tiếp tục đăng ký                                         | Hiện popup modal, giữ nguyên nội dung đã nhập khi tiếp tục. Không dùng hộp thoại native của trình duyệt.                                      |
| Gửi thông tin hợp lệ                                                 | Nhận **201 Created**; hiện màn hình đăng ký thành công. GET thật trả đúng tên, tọa độ, ảnh và các trạng thái `unverified`, `open`, `visible`. |
| Đăng ký nhà hàng lần hai bằng cùng Owner                             | BE trả **409 / `OWNER_ALREADY_HAS_RESTAURANT`**. Tải lại màn hình hiện **Bạn đã có nhà hàng**.                                                |
| Traveler hoặc Origin không hợp lệ gửi thao tác Owner                 | FE chặn với **403 / `FORBIDDEN`**.                                                                                                            |

**Đánh giá:** phần đăng ký và media đã hoạt động với cấu hình BE/Cloudinary local hiện có. Phần bản đồ trực quan vẫn phụ thuộc Mapbox token FE; nhập tọa độ thủ công đã được xác minh.

## Chi tiết ANGI-48 — F-45 Update Business Hour

Endpoint: **OWN-04** `PUT /api/v1/owner/restaurant/business-hours`, lấy lịch ban đầu qua **OWN-02**.

| Kịch bản                             | Kết quả thực tế                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhiều khung trong cùng ngày          | Lưu thành công: Thứ hai `06:00–11:00` và `22:00–02:00`.                                                                                      |
| Qua nửa đêm và khung liền kề hôm sau | Lưu được Thứ hai `22:00–02:00`, tiếp nối Thứ ba `02:00–05:00`.                                                                               |
| Qua ranh giới tuần                   | Lưu được Thứ bảy `23:00–01:00`, tiếp nối Chủ nhật `01:00–02:00`.                                                                             |
| Giờ mở bằng giờ đóng                 | FE báo lỗi, không gửi PUT. Gửi trực tiếp tới BE cũng nhận **400**.                                                                           |
| Hai khung chồng lấn                  | FE báo lỗi và không ghi dữ liệu. BE thật cũng từ chối chồng lấn qua ngày hoặc qua ranh giới tuần với **400**. Lịch đã lưu không bị thay đổi. |
| Hủy chỉnh sửa                        | Yêu cầu xác nhận bằng modal; xác nhận bỏ thay đổi khôi phục lịch đã lưu gần nhất.                                                            |
| Xóa toàn bộ lịch                     | Xác nhận bằng modal, sau đó lưu `hours: []` thành công; tải lại vẫn là lịch rỗng.                                                            |
| Dữ liệu phản hồi và tải lại trang    | Nhận **200**, phản hồi có `hours` và `isOpenNow` dạng boolean; GET và giao diện sau reload khớp lịch đã lưu.                                 |
| Owner chưa có nhà hàng               | Hiện hướng dẫn đăng ký; API cập nhật trả **404 / `RESTAURANT_NOT_FOUND`**.                                                                   |
| Sai vai trò/Origin                   | Trả **403 / `FORBIDDEN`**.                                                                                                                   |
| Mobile 390 px                        | Các trường giờ sử dụng được, không tràn ngang toàn trang.                                                                                    |

**Đánh giá:** không phát hiện sai lệch chức năng trong các kịch bản đã chạy trên cả nhánh cũ và bản `dev` mới.

## Chi tiết ANGI-55 — F-46 Update Status

Endpoint: **OWN-05** `PUT /api/v1/owner/restaurant/operating-status`, lấy trạng thái ban đầu qua **OWN-02**. Kết quả thành công bên dưới thuộc bản `dev` `4bda386`.

| Kịch bản                                                       | Kết quả thực tế                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Hủy popup xác nhận cập nhật                                    | Không ghi thay đổi; GET vẫn trả trạng thái cũ.                                                                                  |
| Chuyển `open → temporarily_closed → permanently_closed → open` | Cả ba lần cập nhật nhận **200**; GET và lựa chọn trên giao diện sau reload khớp trạng thái vừa lưu.                             |
| Đóng cửa vĩnh viễn                                             | Hiện modal riêng **Xác nhận đóng cửa vĩnh viễn?** trước khi gọi API.                                                            |
| Lý do có khoảng trắng đầu/cuối                                 | Backend lưu lý do đã trim; đã kiểm tra trực tiếp PostgreSQL bằng công cụ thuộc backend.                                         |
| Lý do đúng 500 ký tự                                           | Lưu thành công và xác nhận được độ dài trong audit.                                                                             |
| Enum không hợp lệ hoặc lý do 501 ký tự                         | BE trả **400 / `VALIDATION_FAILED`**; không đổi trạng thái đã lưu.                                                              |
| Nhà hàng bị đình chỉ đang tạm đóng muốn mở lại                 | BE trả **409 / `RESTAURANT_SUSPENDED`**. FE hiện thông báo tiếng Việt đúng, giữ lý do đang nhập, trạng thái trong BE không đổi. |
| Nhà hàng bị đình chỉ muốn đóng cửa vĩnh viễn                   | Cập nhật thành công; đình chỉ không ngăn thao tác đóng cửa.                                                                     |
| Trạng thái xác minh, kiểm duyệt và giờ mở cửa                  | Giữ nguyên qua các lần đổi trạng thái hoạt động đã kiểm tra.                                                                    |
| Ghi audit                                                      | Có đúng 3 bản ghi chuyển trạng thái cho Owner dùng để kiểm tra ba trạng thái; lý do trim và lý do 500 ký tự đều được lưu.       |
| Chưa có nhà hàng, sai vai trò, Origin không hợp lệ             | Trả lần lượt **404 / `RESTAURANT_NOT_FOUND`** hoặc **403 / `FORBIDDEN`**, kèm trạng thái UI phù hợp khi chưa có nhà hàng.       |
| Mobile 390 px                                                  | Form trạng thái hiển thị được, không tràn ngang toàn trang.                                                                     |

**Đánh giá:** phần triển khai ANGI-55 đã merge vào `dev` hoạt động đúng trong các kịch bản đã kiểm thử. Nhánh đang mở cần có đủ thay đổi đó trước khi người dùng thao tác được trên màn hình.

## Môi trường, dữ liệu và bằng chứng

- FE cũ: `7bb3e1d0dd9b585d1768c31a3e0ce766f9317fae`; FE `dev` được kiểm tra: `4bda386ed2e9520870a465828281498f339fd4e3`. Bản `dev` được xuất bằng `git archive` từ commit đã xác định, không lấy dữ liệu local `.env` vào bản sao.
- BE: commit `ff15dca`, .NET SDK 10.0.402/Kestrel, API `http://127.0.0.1:5154/api/v1`.
- Docker project `angi-local`, PostgreSQL 16.15/pgvector, database `angi_local`; không dùng database production/chung.
- FE kiểm thử chạy riêng trên `http://localhost:3001`, Node.js 22.12.0, Chromium headless. API và ảnh không được giả lập. Các tài khoản/nhà hàng phục vụ từng nhóm kiểm thử được tạo riêng theo mã lượt chạy; trạng thái đình chỉ là dữ liệu chuẩn bị trong database local, không phải thao tác của Moderator qua UI.
- Nhánh cũ: **7 bài đạt, 0 bài lỗi, 2 bài bỏ qua**. Hai bài bỏ qua là các bài chức năng ANGI-55 chưa có code; một trong bảy bài đạt là bài chẩn đoán xác nhận lỗi thiếu tích hợp. Vì vậy không tính bảy bài đạt thành ANGI-55 đạt.
- Bản `dev`: **8 bài đạt, 0 bài lỗi, 1 bài bỏ qua**. Bài bỏ qua chỉ là bài chẩn đoán dành cho nhánh cũ; không có bài chức năng của ba task bị bỏ qua trên `dev`.
- Kiểm tra PostgreSQL sau lượt `dev`: trạng thái cuối `Open`, xác minh `Verified`, kiểm duyệt `Visible`, 3 audit chuyển trạng thái, có lý do đã trim và lý do 500 ký tự.
- Lint, TypeScript và định dạng các file kiểm thử được kiểm tra. Lượt khởi động Next.js đầu tiên timeout 120 giây trước khi chạy case; đã tăng thời gian chờ lên 240 giây và các lượt kiểm thử sau hoàn tất. Đây không phải lỗi nghiệp vụ của ba task.
- Các ảnh Cloudinary do mỗi lượt test tạo đã được dọn sau kiểm tra. Không bật trace/HAR; session secret được giữ trong biến môi trường và loại khỏi báo cáo JSON local. Không đưa khóa hay mật khẩu vào báo cáo này.

Các bằng chứng nằm trong thư mục được Git bỏ qua:

| File                                                     | Nội dung                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `artifacts/owner-tasks-working.json`                     | Kết quả kiểm thử nhánh đang mở.                                  |
| `artifacts/owner-tasks-dev.json`                         | Kết quả kiểm thử bản `dev` đã merge ANGI-55.                     |
| `artifacts/owner-task-persistence.json`                  | Kết quả đọc trạng thái/audit thật từ PostgreSQL bằng công cụ BE. |
| `artifacts/owner-working-missing-status-integration.png` | Tab trạng thái chỉ đọc trên nhánh cũ.                            |
| `artifacts/owner-dev-registration-desktop.png`           | Form đăng ký và ảnh thật trên bản `dev`.                         |
| `artifacts/owner-dev-hours-mobile.png`                   | Lịch nhiều khung/qua đêm trên mobile.                            |
| `artifacts/owner-dev-status-mobile.png`                  | Form cập nhật trạng thái trên mobile.                            |
| `artifacts/owner-dev-suspended-reopening.png`            | Thông báo khi BE từ chối mở lại nhà hàng bị đình chỉ.            |

## Cách chạy lại bộ kiểm thử riêng ba task

Backend cần đang chạy theo `angi-backend/docker/local/README.md`. Chạy từ thư mục FE bằng PowerShell:

```powershell
# Chuẩn bị tài khoản và dữ liệu mới cho lượt kiểm thử.
./scripts/prepare-live-tests.ps1
$env:ANGI_TEST_OWNER_TASKS = '1'

# Chọn kiểm tra bản dev bằng bản sao chỉ đọc.
$env:ANGI_TEST_SOURCE_REF = 'dev'
npm run test:live
./scripts/check-owner-task-persistence.ps1
./scripts/cleanup-live-tests.ps1

# Dọn cờ sau khi kiểm tra.
Remove-Item Env:ANGI_TEST_OWNER_TASKS
Remove-Item Env:ANGI_TEST_SOURCE_REF
```

Để kiểm tra mã nguồn nhánh đang mở, bỏ biến `ANGI_TEST_SOURCE_REF` trước khi chạy và chuẩn bị dữ liệu mới. Luôn dọn ảnh của lượt cũ trước khi chạy lại bước chuẩn bị; việc chuẩn bị thay file `.env.integration` bằng dữ liệu của lượt mới. Công cụ kiểm tra audit dùng cho lượt kiểm thử `dev` có đủ ba chuyển trạng thái, không áp dụng cho nhánh cũ thiếu ANGI-55. Các file `.env`/`.env.local` đang dùng của FE được giữ nguyên.

## Đối chiếu API Design lần cuối

Nguồn: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, 778867 byte, sửa lần cuối 15:48:43 ngày 15/10/2026, SHA-256 `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. Đã kiểm tra lại file trên ổ đĩa sau các lượt kiểm thử.

Phạm vi đối chiếu: sheet `Backend API` hàng 17 và 58–62; `Chi tiết Request-Response` hàng 246–283; `DTO` hàng 90–126 và 308–313; các JSON mẫu OWN-01/02/04/05; `Enum` các trạng thái nhà hàng; `Mã lỗi` gồm `VALIDATION_FAILED`, `OWNER_ALREADY_HAS_RESTAURANT`, `INVALID_BUSINESS_HOURS`, `RESTAURANT_SUSPENDED`, lỗi media, xác thực/phân quyền và không tìm thấy. Dữ liệu fixture/audit được đối chiếu thêm Data Dictionary v1.2, sheet `Core` hàng 66–90 và 317–329.

Các phương thức POST/GET/PUT, cấu trúc request/response, status HTTP, giới hạn ảnh/lý do, giờ Việt Nam `HH:mm`, ba trạng thái độc lập và các lỗi nghiệp vụ đã kiểm tra khớp mô tả endpoint và DTO liên quan. Riêng trạng thái xác minh trong mẫu JSON OWN-01 mâu thuẫn với mô tả tạo mới và đã được ghi rõ ở trên. Các điểm cần xử lý còn lại là nhánh FE đang mở chưa chứa phần ANGI-55 đã có trong `dev`, cấu hình Mapbox FE chưa được điền và mẫu JSON OWN-01 cần đồng bộ lại.
