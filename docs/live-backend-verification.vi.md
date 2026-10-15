# Sprint 1 — Báo cáo kiểm thử với backend thật trên môi trường local

Bản tiếng Việt của [báo cáo gốc](live-backend-verification.md). Các số liệu và kết luận dưới đây thuộc lần kiểm thử ngày **15/10/2026**; việc bổ sung bản dịch không bao gồm chạy lại các bài kiểm thử.

Xem [báo cáo kiểm thử riêng ANGI-36/48/55](owner-tasks-live-verification.vi.md) để có kết quả mới trên cả mã nguồn đang mở `7bb3e1d` và local `dev` `4bda386` đã merge ANGI-55. Báo cáo dưới đây giữ nguyên phạm vi và phiên bản mã nguồn của lần kiểm tra ban đầu.

Báo cáo ghi nhận mã nguồn hiện có trên `dev` (FE tại commit gốc `7bb3e1d`, BE tại commit gốc `ff15dca`), cùng các công cụ dựng môi trường và kiểm thử local được bổ sung. Công việc này không thay đổi mã chức năng chạy trên production. Các thay đổi được để nguyên ở trạng thái chưa stage, chưa commit trên nhánh FE `test/real-backend-integration` và BE `chore/local-backend-integration`.

## Môi trường và cách chạy lại

Docker project `angi-local` chạy .NET SDK 10.0.402/Kestrel tại `http://127.0.0.1:5154`, PostgreSQL 16.15/pgvector tại cổng 5434 trên máy host, database lưu dữ liệu local `angi_local` và database riêng `angi_test` dành cho các bài kiểm thử có thể đặt lại dữ liệu. Máy host dùng Node.js 22.12.0; phiên bản Node.js được tài liệu và CI của FE quy định vẫn là 24. Không cần cài .NET SDK trực tiếp trên máy host.

File `docker/local/README.md` trong repository backend cùng cấp hướng dẫn khởi động, cấu hình thông tin đăng nhập và dịch vụ bên ngoài, chạy kiểm thử và dọn tài nguyên. Script `docker/local/Start.ps1` đã được chạy lại trên môi trường đang có, xác nhận OpenAPI sẵn sàng và giữ nguyên dữ liệu. Tại thời điểm hoàn tất lần kiểm thử gốc, API và database được giữ chạy; các server FE phục vụ kiểm thử trình duyệt đã tắt sau khi chạy xong.

Chạy từ thư mục gốc backend:

```powershell
./docker/local/Initialize.ps1
# Điền cấu hình vào .env được Git bỏ qua, sau đó chạy:
./docker/local/Start.ps1
node --env-file=.env docker/local/test-http.mjs
docker compose -f docker-compose.local.yml run --rm tests
```

Chạy từ thư mục gốc frontend:

```powershell
./scripts/prepare-live-tests.ps1
npm run test:live
./scripts/cleanup-live-tests.ps1
```

Bước chuẩn bị tạo một tài khoản Owner mới và cấu hình phiên FE riêng trong `.env.integration`, đồng thời giữ nguyên các file `.env`/`.env.local` hiện có của FE. Kiểm thử trình duyệt chạy trên cổng 3001 bằng bản sao riêng của mã nguồn và thư mục đầu ra. Các tài khoản đã kích hoạt, nhà hàng đã xác minh và dữ liệu món ăn/menu là dữ liệu mẫu được tạo sẵn trong database local thật. Việc tạo tài khoản mẫu bỏ qua xác minh email, vì vậy không chứng minh email đã được gửi thành công. Bộ kiểm thử trình duyệt này không giả lập API hoặc chặn request để trả dữ liệu mẫu. Các tài nguyên Cloudinary thật được tạo để kiểm thử đã được xóa sau khi xác minh; dữ liệu liên quan trong database local được giữ lại.

## Kết quả kiểm thử

| Hạng mục                                                                     | Kết quả và phạm vi                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh sách endpoint Sprint 1                                                  | Đủ **43 cặp phương thức/đường dẫn khác nhau** được trích từ các ticket BE thuộc Sprint 1 trong Jira Plan xuất hiện trong OpenAPI của BE đang chạy. Kết quả này xác nhận sự hiện diện của endpoint, chưa chứng minh toàn bộ hành vi đều đã được kiểm thử. |
| Build Release và unit test BE                                                | **993 bài đạt**, không có bài lỗi, qua lệnh `dotnet test ANGI.slnx -c Release`.                                                                                                                                                                          |
| Bộ integration test BE có bật PostgreSQL                                     | **107 bài đạt**, không có bài lỗi; **2 bài kiểm thử trực tiếp dịch vụ bên ngoài được bỏ qua** trong lượt chạy thông thường. Các kịch bản PostgreSQL dùng `angi_test`; bộ khởi tạo host kiểm thử thay thế các thành phần giao tiếp với dịch vụ bên ngoài. |
| Kiểm thử riêng với Cloudinary thật                                           | **1 bài đạt**: tải lên ảnh công khai và PDF riêng tư, tạo URL có chữ ký và xóa cả hai tài nguyên kiểm thử. Bài này được chạy riêng với `RUN_CLOUDINARY_LIVE_TESTS=1`.                                                                                    |
| Kiểm tra HTTP với Kestrel đang chạy                                          | **15 nhóm đạt**, không có nhóm lỗi. Dùng DI, JWT, use case và PostgreSQL thật; kết quả tổng hợp nằm tại `TestResults/local/http-checks.json` trong BE.                                                                                                   |
| Bộ kiểm thử trình duyệt FE với BE thật                                       | **3 bài đạt**, bao gồm **33 kiểm tra auth/session**, tải ảnh bìa thật, đăng ký nhà hàng, sửa hồ sơ, lưu giờ mở cửa qua đêm, kiểm tra dữ liệu sau khi tải lại trang, xác nhận bằng modal và từ chối thao tác Owner khi sai vai trò.                       |
| Giao diện mobile                                                             | Kiểm tra ở chiều rộng 390 px sau khi dữ liệu nhà hàng tải xong; không có tràn ngang toàn trang. Đã xem ảnh `artifacts/live-owner-mobile.png`.                                                                                                            |
| Unit test FE                                                                 | **55 bài đạt** trong 7 file.                                                                                                                                                                                                                             |
| Lint FE / kiểm tra TypeScript nghiêm ngặt                                    | Đạt.                                                                                                                                                                                                                                                     |
| Định dạng các file TS/JS/tài liệu FE thay đổi và khoảng trắng trong Git diff | Đạt. Các script PowerShell được kiểm tra cú pháp; các lệnh khởi động, chuẩn bị và dọn tài nguyên đã chạy thành công.                                                                                                                                     |

Lần chạy Vitest đầu tiên trong sandbox gặp lỗi `spawn EPERM`; lần chạy sau với quyền thực thi cần thiết đã đạt. Không chạy lại production build của FE vì các thay đổi chỉ thuộc công cụ kiểm thử, thiết lập môi trường và tài liệu; bộ kiểm thử trình duyệt đã biên dịch và chạy ứng dụng Next.js thật ở chế độ development.

## Phạm vi đã kiểm thử và các phụ thuộc còn thiếu

| Nhóm API Sprint 1                                 | Bằng chứng kiểm thử thật và giới hạn                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-04/06/07                                     | Đăng nhập bằng mật khẩu cho cả bốn vai trò, xoay vòng refresh token, thu hồi phiên và đăng xuất. Kiểm tra FE bao gồm bảo vệ Origin, phiên dùng cookie HttpOnly, không trả cặp token trong JSON cho trình duyệt, refresh đồng thời và cập nhật cookie cũ về phiên bản mới nhất.                                               |
| AUTH-01/02/03/08/09                               | Đã kiểm tra thật dữ liệu không hợp lệ, tài khoản trùng, token không hợp lệ, email không tồn tại và giới hạn tần suất. Các luồng đăng ký/xác minh/đặt lại mật khẩu thành công được kiểm thử bằng bộ khởi tạo host BE có thay thế thành phần gửi email; chưa kiểm tra việc gửi qua Brevo thật và xử lý liên kết trong hộp thư. |
| AUTH-05                                           | Đã kiểm tra thật việc từ chối Google token không hợp lệ. Chưa chạy thành công luồng Google OAuth vì cần ID token do Google cấp sau thao tác đăng nhập tương tác. Các vấn đề FE nêu bên dưới vẫn chưa được xử lý.                                                                                                             |
| ME-01/02/03                                       | Đọc/cập nhật hồ sơ và xóa giá trị của trường cho phép null, đổi mật khẩu rồi khôi phục, giữ phiên có `sid` hiện tại và thu hồi các phiên refresh khác. Smoke test FE xác minh ME-01 sau khi refresh token.                                                                                                                   |
| OWN-01/02/03 + MEDIA-01                           | Đăng ký bằng trình duyệt thật, tải ảnh bìa multipart qua Next.js và BE lên Cloudinary, cập nhật hồ sơ và kiểm tra dữ liệu đã lưu.                                                                                                                                                                                            |
| OWN-04                                            | Thay lịch mở cửa bằng khung giờ qua đêm qua trình duyệt thật, kiểm tra dữ liệu sau khi tải lại trang, thay toàn bộ lịch bằng lịch rỗng và xác nhận bằng modal; API thật từ chối khung giờ không hợp lệ.                                                                                                                      |
| OWN-05                                            | API thật chuyển nhà hàng mẫu sang đóng cửa rồi mở lại, giữ nguyên trạng thái xác minh; đã kiểm tra giá trị enum không hợp lệ. Kết quả này chưa xác nhận màn hình trạng thái trên nhánh FE `dev` hiện tại đã tích hợp API thật.                                                                                               |
| OWN-06/07/08                                      | Đã gọi GET lịch sử thật và kiểm tra lỗi không tìm thấy hồ sơ xác minh. Việc nộp hồ sơ lần đầu và lưu tài liệu được kiểm thử bằng bộ PostgreSQL của BE với thành phần lưu trữ được thay thế. Chưa chạy thành công luồng nộp/nộp lại hồ sơ xác minh qua server thật đang chạy.                                                 |
| OWN-09..18                                        | Gọi API thật để đọc menu đã duyệt, thay đổi rồi khôi phục tình trạng còn món, tạo/xem danh sách/xem chi tiết bản nháp, thêm/sửa/xóa món trong bản nháp, nộp và hủy bản menu. Trạng thái xác minh của nhà hàng mẫu được tạo sẵn; thao tác phê duyệt của Moderator nằm ngoài luồng này.                                        |
| REST-01..04, DISH-01..03, CAT-02, HOME-01, IMP-01 | Gọi API thật để duyệt danh sách/xem chi tiết/menu/review công khai, lấy tag, trang chủ, roll món khi đã đăng nhập và ghi nhận impressions, sử dụng dữ liệu mẫu đã lưu trong database. Dịch vụ recommendation chưa chạy nên xếp hạng/roll dùng cơ chế dự phòng theo thiết kế. Chưa bao phủ mọi tổ hợp bộ lọc và cursor.       |
| PREF-02/03                                        | Đã kiểm tra lỗi validation và phản hồi thật `503 SERVICE_UNAVAILABLE` khi chưa cấu hình dịch vụ recommendation. Luồng gửi/bỏ qua khảo sát thành công cần có dịch vụ recommendation riêng đang chạy.                                                                                                                          |

## Các vấn đề FE phát hiện khi đối chiếu hợp đồng API

Các vấn đề dưới đây được xác định qua việc đọc mã nguồn và đối chiếu hợp đồng API, chưa được sửa trong công việc dựng môi trường/kiểm thử này. Đây không phải bằng chứng đã kiểm thử thành công OAuth hoặc gửi email thật:

1. **Route AUTH-03 không được cấu trúc route FE hiện tại tiếp nhận.** `src/shared/api/client.ts` gọi `/api/auth/verify-email/resend`, nhưng hiện chỉ có `src/app/api/auth/[action]/route.ts`. Một đoạn động `[action]` không thể khớp cả hai đoạn đường dẫn, nên nhánh `case "verify-email/resend"` không xử lý được URL này.
2. **Cách xử lý vai trò và phản hồi Google trên FE chưa khớp hợp đồng.** Auth handler đọc trường `role` tùy chọn nhưng chỉ chuyển tiếp `idToken`; handler chỉ trả `result.user`, làm mất `isNewUser` mà client đang chờ. Nút Google và callback đăng nhập cũng đang cố định điều hướng về Traveler. API Design yêu cầu vai trò khi tạo tài khoản Google mới và trả `isNewUser`. Khi sửa phản hồi cho trình duyệt, cặp token vẫn phải được giữ ở phía server.
3. **Một số khai báo kiểu dữ liệu auth vẫn mô tả phản hồi cũ.** Client FE cho chức năng gửi lại email xác minh/quên mật khẩu khai báo `{sent: boolean}`; chức năng đặt lại mật khẩu khai báo `{userId, status}`. Trong khi đó, AUTH-03/08/09 quy định phản hồi thành công là `data: null`. Bộ phân tích phản hồi chung hiện vẫn giữ nguyên null, nhưng các khai báo kiểu này cần được chỉnh lại cùng các chức năng liên quan.

Trình duyệt còn ghi nhận cảnh báo của Google về thuộc tính nút `width="100%"`; cảnh báo này không ảnh hưởng đến các bài kiểm thử đăng nhập bằng mật khẩu và chức năng Owner. Việc gửi email thật, Google OAuth thành công và các lời gọi recommendation thành công vẫn chưa được xác minh. Công việc này không chuyển các màn hình xem trước đang có sang dùng API thật.

## Đối chiếu API Design sau khi hoàn tất

Trong lần kiểm thử gốc, sau khi triển khai và chạy các bước kiểm tra, đã mở lại workbook backend từ ổ đĩa và kiểm tra xem có bản API Design mới hơn hay không. File được chọn là `ANGI_API_Design_Ver1.8.xlsx`, dung lượng 778867 byte, sửa lần cuối lúc 15:48:43 ngày 15/10/2026 theo giờ local, SHA-256 `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`.

Các nội dung đã xem gồm:

- Jira Plan v1.2, sheet `Backlog`: các hàng Sprint 1 từ 17–87.
- Sheet `Backend API`: các endpoint liên quan tại hàng 2–30, 45 và 58–75.
- Các endpoint được chọn trong sheet `Chi tiết Request-Response`, gồm AUTH-05/06/07/08/09 tại hàng 19–31 và nhóm Owner tại hàng 260–283.
- Sheet `DTO`: cấu trúc phản hồi chung/auth/hồ sơ tại hàng 2–36, discovery/nhà hàng tại hàng 63–126 và media tại hàng 308–313.
- Sheet `JSON mẫu`: auth/hồ sơ tại hàng 18–212 và OWN-05 tại hàng 2004–2015.
- Các bản ghi liên quan trong sheet `Mã lỗi` và vai trò/trạng thái trong sheet `Enum` tại hàng 2–9.

Đã đối chiếu 43 cặp phương thức/đường dẫn trong kế hoạch với OpenAPI của BE đang chạy.

Các bài kiểm tra được bổ sung giữ đúng phương thức, mã trạng thái khi tạo/đọc/cập nhật, phản hồi null, ID dạng số, trạng thái snake_case và giờ Việt Nam theo định dạng `HH:mm` trong tài liệu. Các phần tích hợp đã kiểm thử khớp với hợp đồng đã đối chiếu; các sai lệch auth FE nêu trên vẫn được ghi nhận là vấn đề còn tồn tại. Báo cáo xác nhận phạm vi hành vi đã kiểm thử trong Sprint 1, chưa khẳng định toàn bộ luồng giao diện và dịch vụ bên ngoài của Sprint 1 đã hoàn thiện.
