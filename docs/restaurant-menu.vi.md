# F-50 — Quản lý thực đơn nhà hàng (ANGI-80)

Nhánh FE: `feat/ANGI-80-manage-restaurant-menu`, tạo từ `origin/dev` tại `80600a5f9cccf19c0bd37874b76e15161f04f45f`. Thay đổi để nguyên chưa stage/commit/push.

## Kiểm tra mức độ sẵn sàng của BE

BE hiện có đủ **9 thao tác trong ticket**, đã đối chiếu controller, use case, DI và OpenAPI của API local tại cổng 5154. Không thiếu endpoint F-50.

| Mã     | Method và đường dẫn sau `/api/v1`                                         | Kết quả thành công                                           |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| OWN-09 | GET `/owner/restaurant/menu`                                              | 200; món đang bán và bản đang mở                             |
| OWN-10 | PUT `/owner/restaurant/menu/dishes/{dishId}/availability`                 | 200; `dishId`, `isAvailable`                                 |
| OWN-11 | POST `/owner/restaurant/menu-submissions`                                 | 201; bản nháp sao chép từ menu hiện tại; **không body**      |
| OWN-12 | GET `/owner/restaurant/menu-submissions`                                  | 200; `items`, `page`, `pageSize`, `totalItems`, `totalPages` |
| OWN-13 | GET `/owner/restaurant/menu-submissions/{submissionId}`                   | 200; metadata, `items`, `removedDishes`                      |
| OWN-14 | POST `/owner/restaurant/menu-submissions/{submissionId}/items`            | 201; món trong bản nháp                                      |
| OWN-15 | PATCH `/owner/restaurant/menu-submissions/{submissionId}/items/{itemId}`  | 200; món đã sửa                                              |
| OWN-16 | DELETE `/owner/restaurant/menu-submissions/{submissionId}/items/{itemId}` | 200; `data: null`; **không body**                            |
| OWN-18 | POST `/owner/restaurant/menu-submissions/{submissionId}/cancel`           | 200; bản đã hủy; **không body**                              |

Các API hỗ trợ cũng có: OWN-02 GET hồ sơ nhà hàng, CAT-02 GET `/tags`, MEDIA-01 POST `/media` với multipart `file`, `purpose=dish`. Ảnh phải là JPG/PNG/WEBP, tối đa 5 MiB và thuộc chủ tài khoản. FE dùng numeric media ID do BE trả về, không suy ID từ URL.

OWN-17 `/menu-submissions/{id}/submit` có trong BE nhưng thuộc **F-51 Submit Menu for Approval**. F-50 không thêm nút gửi duyệt giả và không mở proxy cho OWN-17. Vì vậy vòng gửi duyệt/Moderator phê duyệt chưa phải chức năng hoàn tất trong task này.

## Sử dụng và tự kiểm thử

1. Chạy BE/DB và FE theo [hướng dẫn chạy đầy đủ](local-run-and-test-guide.vi.md). FE dùng `API_BASE_URL=http://127.0.0.1:5154/api/v1` ở server; browser dùng `/api`. Không cần biến env ứng dụng mới.
2. Đăng nhập Restaurant Owner, mở `/restaurant/menu`. Nhà hàng chưa đăng ký có liên kết đăng ký; nhà hàng chưa xác minh không tạo được bản nháp. Không dùng dữ liệu demo khi API thật lỗi.
3. Ở **Đang bán**, đánh dấu còn món/hết món và xác nhận bằng modal. Tải lại trang để kiểm tra đã lưu.
4. Chọn **Tạo bản nháp** ở nhà hàng đã xác minh. BE sao chép các món hiện tại. Nếu đã có draft/pending thì mở bản đó; BE trả 409 khi cố tạo thêm.
5. **Thêm món**: nhập tên, mô tả, giá VND, loại món, chọn nhãn từ CAT-02 và ảnh nếu muốn. Ô ảnh xám có dấu cộng; nút bỏ ảnh nhỏ. Ảnh được tải lên trước, sau đó lưu món bằng media ID.
6. **Sửa** tên/mô tả/loại/giá/nhãn/ảnh/thứ tự. Thứ tự nhỏ hơn hiển thị trước; món mới để trống thứ tự sẽ nối cuối. PATCH chỉ gửi trường thay đổi. Bỏ ảnh gửi `coverMediaId:null`; bỏ toàn bộ nhãn gửi `tagIds:[]`. Lỗi BE giữ nguyên dữ liệu để sửa/thử lại. Nếu thay hẳn bằng món khác, nên xóa dòng cũ và thêm món mới để không giữ nhầm lịch sử của món gốc.
7. **Xóa** món trong bản nháp rồi xác nhận. Món gốc xuất hiện ở danh sách món đã bỏ; chuyển sang **Đang bán** để kiểm tra menu thật vẫn còn nguyên.
8. **Hủy bản thực đơn**, xác nhận rồi tải lại. Draft và pending có thể hủy; trạng thái đã duyệt/bị từ chối/đã hủy chỉ đọc. Menu đang bán không đổi.
9. **Lịch sử**: lọc trạng thái, chuyển trang, xem từng bản cùng ngày nộp/ngày duyệt/người duyệt/ghi chú/phản hồi. Giá trị chưa có được hiển thị rõ, không bịa ngày hoặc người duyệt.
10. Kiểm tra mobile và bàn phím: Tab, Escape, modal bỏ thay đổi chưa lưu. Không dùng browser alert/confirm/prompt.

Tên được trim và giới hạn 1–200 ký tự; mô tả mới/thay đổi 30–2000 ký tự; giá nguyên VND 0–999.999.999.999; `dishForm=soup|dry|other`; thứ tự nguyên 0–32767; tag ID dương, không trùng. Mô tả cũ null/ngắn được giữ khi không chỉnh trường đó. BE vẫn quyết định validation, trạng thái và quyền sở hữu cuối cùng.

Demo ở `/demo/owner/menu` dùng adapter riêng với shape DTO của workbook, giữ bản nháp trong bộ nhớ workspace và reset khi reload/remount. Còn món/hết món cũng cập nhật món tương ứng trong provider demo. Không có upload Cloudinary hoặc request API thật từ adapter demo.

## Lệnh kiểm thử

```powershell
npm run lint
npm test
npm run build
npm run typecheck
$env:PLAYWRIGHT_BROWSERS_PATH = '.cache/browsers'
npx playwright test --config=playwright.menu.config.ts
```

Suite giao diện dùng snapshot production riêng, API stub tại 5164, FE tại 3001, không dùng env ứng dụng. Chạy các suite browser nối tiếp vì dùng chung cổng.

Kiểm thử BE thật là opt-in và chỉ chạy ở Docker `angi_local`:

```powershell
./scripts/prepare-live-tests.ps1
$env:NODE_OPTIONS = ''
node --env-file=.env.integration node_modules/@playwright/test/cli.js test --config=playwright.menu-live.config.ts
```

Lệnh tạo tài khoản mới và thay `.env.integration` (file ignored), không thay `.env` hiện có. Config test ép token Mapbox rỗng; browser chặn request ngoài localhost. Trace/video/screenshot live tắt để bảo vệ mật khẩu/token/URL ảnh. Test đăng ký nhà hàng bằng API thật, kiểm tra 403 khi chưa xác minh, rồi gọi công cụ BE `docker/local/Seed --set-menu-fixture` với GUID của run. Công cụ chỉ đánh dấu nhà hàng test mới có tên chính xác là verified và tạo hai món gốc trong DB local. **Đây là dữ liệu chuẩn bị, không chứng minh luồng Moderator xác minh hoạt động.**

Để kiểm tra hủy pending, test sửa một bản mới rồi gọi OWN-17 trực tiếp ở BE làm bước chuẩn bị; F-50 FE không cung cấp thao tác nộp này. Test không kiểm tra quyết định phê duyệt menu của Moderator.

Sau lượt live, dọn ảnh Cloudinary của đúng tài khoản test, kể cả khi test thất bại. Đọc `ANGI_LOCAL_TEST_RUN` từ env test của lượt vừa chạy (không dùng run người khác), rồi từ thư mục BE:

```powershell
docker compose -f docker-compose.local.yml run --rm -e ANGI_LOCAL_TEST_RUN=<run-vua-chay> seed dotnet run --project docker/local/Seed --configuration Release -- --cleanup-media
```

Cleanup chỉ xóa asset của owner test đó, giữ metadata DB làm bằng chứng. Không chạy cleanup nếu còn muốn mở lại ảnh test. Báo cáo máy đọc được ở `artifacts/restaurant-menu-live.json` (ignored), không chứa bí mật. Lượt triển khai này dùng env riêng `.cache/.env.menu-live` để bảo toàn `.env.integration` đã có.

## Đối chiếu API Design

Nguồn: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, SHA256 `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`.

Đã mở lại workbook từ đĩa sau code và các lượt kiểm thử ngày **17/10/2026** (giờ Việt Nam); không có bản mới hơn trong thư mục BE và hash không đổi. Đối chiếu `Backend API` 66–75; `Chi tiết Request-Response` 302–338; `DTO` 63–66, 143–163, 317–319; `JSON mẫu` 2123–2392; `Mã lỗi` 28/42 và lỗi dùng chung; các mục CAT-02/MEDIA-01. OWN-17 được đọc để xác định ranh giới, không triển khai trong FE F-50. Giá nguyên VND và giới hạn smallint đối chiếu thêm Data Dictionary v1.2, sheet `Core` và validator BE.

Các ví dụ JSON dùng lại cùng dữ liệu minh họa có điểm không khớp ý nghĩa thao tác: OWN-11 sao chép nhưng ví dụ là `edited`; OWN-14 thêm mới nhưng ví dụ có `sourceDishId=105`/`edited`; OWN-13 ví dụ cùng dish ID vừa có trong item vừa nằm trong `removedDishes`; OWN-18 ví dụ còn `draft` sau cancel; một số mô tả mẫu dưới 30 ký tự. FE giữ đúng cấu trúc và dùng dữ liệu BE trả về: clone `unchanged`, món mới `sourceDishId:null`/`new`, cancel `cancelled`; không chép các giá trị mẫu mâu thuẫn vào live hoặc fixture. Không sửa workbook.

## Kết quả kiểm chứng

Ngày **17/10/2026**, môi trường Docker local: API .NET thật tại 5154, PostgreSQL `angi_local`, Cloudinary thật; FE production snapshot riêng, Node 22.12.0/Next 16.4.0. Các env ứng dụng và `.env.integration` cũ được giữ nguyên. Không sửa BE business API; chỉ thêm fixture local có guard ở `docker/local/Seed/MenuFixture.cs` và nhánh lệnh của seed tool hiện có.

| Kiểm tra                   | Kết quả                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Lint toàn FE và TypeScript | Đạt                                                                                                                       |
| Unit tests                 | **128/128**, 14 file                                                                                                      |
| Production build           | Đạt trên snapshot `.cache/owner-test-6v0liM`; không dùng env ứng dụng                                                     |
| Browser stub               | **38/38**: 8 ca F-50 và 30 ca hồi quy F-47/F-48/F-49; 8 ca F-50 được chạy lại đạt trên artifact cuối                      |
| BE thật                    | **1 ca end-to-end đạt**, đi qua đủ 9 thao tác F-50 cùng OWN-02/CAT-02/MEDIA-01                                            |
| Upload ảnh thật            | 201, gắn numeric media ID và bỏ ảnh bằng null thành công; đã dọn đúng **1 asset** của tài khoản test                      |
| Lưu dữ liệu                | Còn/hết món tồn tại sau reload; sửa giá/thứ tự, thêm/xóa món tồn tại trong bản nháp; menu đang bán không bị thay đổi      |
| Trạng thái và quyền        | 403 khi chưa verified; 409 khi trùng bản mở/sửa bản đã hủy; 401 khi chưa đăng nhập; 404 khi truy cập bản/món của chủ khác |
| Hủy                        | Draft và pending chuyển cancelled qua API thật, giải phóng bản đang mở; menu đang bán giữ nguyên                          |
| Desktop/mobile/bàn phím    | Đạt ở 1440 px và 390 px; không tràn ngang; mở/đóng modal và trả focus về nút mở                                           |
| Browser lỗi và Mapbox      | 0 page error, 0 native dialog, **0 request Mapbox** trong lượt live                                                       |

Evidence riêng của lượt live: `artifacts/restaurant-menu-live.json`, run `2fbf6b175cce4827afd83c36b3dbe266`, bắt đầu khoảng 05:36 ngày 17/10/2026 (UTC+7). Ảnh giao diện stub đã xem lại tại `.cache/menu-mobile.png` và `.cache/menu-desktop.png`; không chụp dữ liệu live hay ghi trace chứa bí mật.

### Điểm chưa xác nhận được / cần dữ liệu BE

- **CAT-02 hiện trả `[]` trong DB local.** Vì vậy chưa có nhãn thật để người dùng chọn và lượt live chưa thể chứng minh chọn/bỏ một tag ID thật. FE hiển thị “Chưa có nhãn để chọn”; tạo/sửa món không có tag vẫn chạy vì tag là optional. Luồng chọn nhãn, giữ nhãn cũ và gửi `tagIds:[]` đã đạt bằng unit/browser stub. Cần bên quản lý BE cung cấp danh mục `tags` chính thức; FE không tự chế ID hay dùng nhãn demo cho API thật.
- **Gửi duyệt F-51 và quyết định của Moderator nằm ngoài F-50.** Approved/rejected và phản hồi kiểm duyệt đã kiểm tra ở stub; không khẳng định đã kiểm thử vòng Moderator thật. Pending được tạo bằng OWN-17 BE chỉ để kiểm tra thao tác hủy F-50.
- Danh sách cập nhật bằng tải lại thủ công, không có polling/realtime. Mẫu JSON mâu thuẫn đã ghi ở trên; FE không sửa dữ liệu minh họa trong workbook.

Không còn lỗi F-50 tái hiện trong các phạm vi đã kiểm thử. Điều này không biến danh mục tag rỗng hoặc các task kế tiếp thành chức năng đã được kiểm chứng đầy đủ.
