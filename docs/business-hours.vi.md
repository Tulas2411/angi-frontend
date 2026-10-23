# ANGI-48 — Giờ mở cửa

> **Cập nhật 10/2026:** các lệnh dưới đây đã được gộp. Dùng `npm run test:browser` (trang chủ, auth, tài khoản), `npm run test:owner` (giờ mở cửa, trạng thái, xác minh, thực đơn), `npm run test:map` (đăng ký, hồ sơ, bản đồ, tỉnh/phường) và `npm run test:live` (backend thật, xem [live-backend-verification.md](live-backend-verification.md)). Các script `prepare-live-tests.ps1` và `cleanup-live-tests.ps1` đã bị xóa cùng bộ live cũ.


Màn hình F-45 được sửa theo ảnh do chủ dự án cung cấp ngày 17/10/2026. Nhánh riêng: `fix/ANGI-48-redesign-business-hours`, tạo từ `origin/dev`, không đặt upstream là `dev`/`main`. Thay đổi để chủ dự án tự review, commit và publish.

## Cách sử dụng

Đăng nhập tài khoản Restaurant Owner đã có nhà hàng, mở `/restaurant/profile?tab=hours` (thường là <http://localhost:3000/restaurant/profile?tab=hours>). Không còn bản minh họa; màn này chỉ chạy với backend thật.

- Bảng **Lịch phục vụ trong tuần** hiển thị thứ hai đến chủ nhật, nhiều khoảng cách nhau bằng dấu `·`.
- **Chỉnh giờ** mở modal chỉnh/xóa các khoảng của một ngày. **Thêm khoảng** mở modal có thêm một cặp giờ trống. Có thể thêm tiếp trong modal.
- **Áp dụng** kiểm tra dữ liệu và cập nhật bản nháp lịch tuần. Bước này chưa gửi API.
- **Lưu cả tuần** gửi toàn bộ lịch lên BE. **Hủy** khôi phục lần lưu gần nhất sau khi xác nhận bằng modal.
- Xóa khoảng, bỏ sửa ngày, bỏ sửa tuần và chuyển tab khi chưa lưu đều dùng modal. Escape có thể đóng modal; nếu có dữ liệu chưa áp dụng sẽ hỏi trước khi bỏ.
- Xóa hết các khoảng rồi lưu sẽ hỏi xác nhận **Lưu lịch tuần trống?**. Ngày trống hiển thị **Chưa khai báo giờ**; không đổi trạng thái hoạt động sang đóng cửa.

Lịch qua đêm thuộc ngày bắt đầu: thứ bảy `18:00–02:00 hôm sau` kết thúc lúc 02:00 chủ nhật. Chủ nhật có thể chưa khai báo khoảng bắt đầu riêng nhưng vẫn được phục vụ trong phần qua đêm đó.

## Validation và xử lý lỗi

| Trường hợp                                                       | Kết quả                                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Thiếu giờ mở hoặc giờ đóng                                       | Báo lỗi cạnh ô nhập và đưa focus về ô sai                                               |
| Giờ không đúng `HH:mm`, ngoài `00:00–23:59` hoặc có giây         | Từ chối; không tự sửa thành một giờ khác                                                |
| Giờ mở bằng giờ đóng                                             | Từ chối; không diễn giải là mở 24 giờ                                                   |
| Nhiều khoảng cùng ngày                                           | Cho phép nếu không chồng lấn                                                            |
| Hai khoảng trùng hoàn toàn hoặc giao nhau                        | Từ chối trước khi áp dụng                                                               |
| Giờ đóng nhỏ hơn giờ mở                                          | Hợp lệ, ghi rõ kết thúc ngày hôm sau                                                    |
| Chồng với ngày tiếp theo, thứ bảy/chủ nhật hoặc chủ nhật/thứ hai | Từ chối; thông báo nêu các ngày cần kiểm tra                                            |
| Khoảng trước kết thúc đúng lúc khoảng sau bắt đầu                | Hợp lệ, ví dụ `22:00–02:00` rồi ngày sau `02:00–05:00`                                  |
| Chưa sửa dữ liệu hoặc đang lưu                                   | Khóa nút lưu tương ứng; không gửi trùng PUT                                             |
| BE từ chối hoặc mất kết nối                                      | Giữ lịch đang sửa, hiển thị lỗi, cho phép sửa/thử lại                                   |
| BE trả `Hours[n].CloseTime` và các lỗi trường tương tự           | Hiện lỗi tại ngày tương ứng; nút chỉnh ngày liên kết thông báo, modal hiện lỗi ở ô nhập |

Kiểm tra chồng lấn dùng lịch tuần dạng vòng, theo múi giờ Việt Nam UTC+7. FE không đặt thêm giới hạn số khoảng hay thời lượng tối thiểu vì hợp đồng BE không quy định những giới hạn này.

## Hợp đồng API

OWN-02 `GET /api/v1/owner/restaurant` đọc `businessHours`. OWN-04 `PUT /api/v1/owner/restaurant/business-hours` nhận `{ hours: [{ dayOfWeek, openTime, closeTime }] }`, thay toàn bộ tuần và trả **200** với `{ hours, isOpenNow }` trong envelope chuẩn. Chủ nhật là `0`, thứ hai `1`, thứ bảy `6`. `hours: []` xóa lịch đã khai báo. FE gọi qua proxy cùng origin `/api/backend/...`; giữ nguyên quyền Owner và kiểm tra Origin.

BE trả `VALIDATION_FAILED` cho dữ liệu sai và `INVALID_BUSINESS_HOURS` cho chồng lấn. `RESTAURANT_NOT_FOUND` đưa người dùng tới hướng đăng ký nhà hàng. Cập nhật giờ không sửa operating/verification/moderation status, ảnh hay thông tin hồ sơ.

Nguồn đối chiếu: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, sheet **Backend API** hàng 59/61 (OWN-02/04), **DTO** hàng 90–92 (BusinessHour), **JSON mẫu** hàng 1980–2003 (OWN-04), **Mã lỗi** hàng 10/14 (`VALIDATION_FAILED`/`INVALID_BUSINESS_HOURS`). BE được đọc tại `BusinessHourDtoValidator`, `UpdateBusinessHoursRequestDtoValidator`, `BusinessHourRules` và `UpdateBusinessHoursUseCase`.

Workbook mô tả lỗi chồng nhau “trong cùng ngày”; implementation BE kiểm tra cả phần qua đêm và ranh giới tuần. FE theo quy tắc thực thi của BE để ngăn lịch mà API sẽ từ chối. Workbook không có sheet riêng tên “Validation Rules”; validation lấy từ ràng buộc DTO và các validator thực tế.

## Kiểm thử

Unit: `npm test`. Browser: `npx playwright test -c playwright.owner.config.ts`. Config browser build source hiện tại trong snapshot riêng, dùng API stub local, token Mapbox rỗng; test chặn request ngoài localhost. Có kiểm tra desktop, mobile 390/320 px, bàn phím, modal/focus, validation và xử lý lỗi BE.

BE thật: dùng stack Docker local và seed một lượt mới theo [hướng dẫn chạy dự án](local-run-and-test-guide.vi.md). Nạp env kiểm thử chứa `ANGI_LOCAL_TEST_RUN`, tài khoản `hours-<run>@angi.local`, Owner/Empty Owner cùng lượt và mật khẩu local rồi chạy:

```powershell
node --env-file=.env.integration node_modules/@playwright/test/cli.js test --config=playwright.live.config.ts
```

Config live chỉ cho host local và tài khoản theo lượt; hai case ANGI-48 dùng nhà hàng seed riêng. Không upload ảnh, gọi Mapbox hoặc ghi dữ liệu vào hệ thống dùng chung. Không ghi trace/video có thông tin đăng nhập.

### Kết quả ngày 17/10/2026

| Kiểm tra                        | Kết quả                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Unit toàn FE                    | 132/132 qua; sau khi thêm dữ liệu biên, 12/12 test giờ mở cửa được chạy lại và qua          |
| Browser với API stub            | 14/14 ca giờ mở cửa qua; thêm 2/2 ca hồi quy demo profile và trạng thái qua                 |
| BE thật (.NET/PostgreSQL local) | 2/2 ca ANGI-48 qua                                                                          |
| Build production                | Qua trên snapshot source hiện tại, `.cache/owner-test-8umHfR`                               |
| ESLint, TypeScript              | Qua                                                                                         |
| Responsive/bàn phím             | Desktop 1440 px; mobile 390/320 px; không tràn ngang; Tab trong modal và trả focus khi đóng |

BE thật đã kiểm tra lưu 5 khoảng trên nhiều ngày, qua đêm, hai khoảng tiếp giáp, phản hồi `hours`/`isOpenNow`, GET sau lưu và tải lại trang. Request cố ý sai ngày/định dạng/giờ bằng nhau bị trả 400 `VALIDATION_FAILED`; chồng giờ giữa ngày hoặc qua ranh giới tuần bị trả 400 `INVALID_BUSINESS_HOURS`. Các request sai giữ nguyên lịch đang lưu. Xóa khoảng cuối, lưu `[]`, GET/tải lại và việc giữ nguyên trạng thái nhà hàng đều qua. Không phát hiện lỗi chức năng trong phạm vi này.

Browser dùng production snapshot đã kiểm tra 138 file source trùng workspace (xác nhận lại bằng hash trước bàn giao). Hai ca profile/status chỉ kiểm tra phần điều hướng liên quan tới giờ mở cửa; không chạy lại toàn bộ các tính năng đó. Các flow upload/media, Mapbox và Moderation không nằm trong lượt này.

Ảnh QA local (được git-ignore): `artifacts/owner-hours-desktop.png`, `artifacts/owner-hours-mobile.png`, `artifacts/owner-hours-day-mobile.png`. Đã xem lại ảnh sau build; không khẳng định pixel equality với ảnh tham chiếu. Bản seed BE riêng được giữ trong database local để người dùng tự xem, lịch của tài khoản kiểm thử kết thúc ở trạng thái rỗng.

Đã mở lại workbook từ disk sau code và kiểm thử lúc khoảng **21:08 UTC+7**, không có phiên bản mới trong thư mục tài liệu BE. SHA-256: `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. Các sheet/hàng nêu trên đã được đối chiếu lại; method, body, kiểu ngày/giờ, response và mã lỗi giữ đúng contract, cùng phần chồng giờ qua đêm đã ghi rõ về BE.
