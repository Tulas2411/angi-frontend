# F-51 — Gửi thực đơn để duyệt (ANGI-86)

> **Cập nhật 10/2026:** các lệnh dưới đây đã được gộp. Dùng `npm run test:browser` (trang chủ, auth, tài khoản), `npm run test:owner` (giờ mở cửa, trạng thái, xác minh, thực đơn), `npm run test:map` (đăng ký, hồ sơ, bản đồ, tỉnh/phường) và `npm run test:live` (backend thật, xem [live-backend-verification.md](live-backend-verification.md)). Các script `prepare-live-tests.ps1` và `cleanup-live-tests.ps1` đã bị xóa cùng bộ live cũ.


Nhánh riêng: `feat/ANGI-86-submit-menu-for-approval`, tạo bằng `--no-track` từ `origin/dev` tại `237e8c01946d4fceacb7d9b9f00e5a7bc55f6881`. Nhánh không theo dõi `origin/dev` hay `origin/main`. Code để nguyên chưa stage/commit/push; chủ dự án tự review và merge.

## Nhánh và hướng merge

Theo yêu cầu lần này, PR của bạn có thể chọn **base `main`**, **compare `feat/ANGI-86-submit-menu-for-approval`**. Sau khi tự review và commit, bạn có thể publish đúng nhánh bằng:

```powershell
git push --set-upstream origin feat/ANGI-86-submit-menu-for-approval
```

Đây là hướng dẫn cho người quản lý repo; assistant không chạy commit/push hoặc tạo PR. Push nhánh riêng không tự merge vào `main`/`dev`. Không dùng `dev` làm đích push cho thay đổi của nhánh này.

`main` tại thời điểm bắt đầu là `c4f9147614f29064622b949fff6d6457e1d46dd7`, chưa nhận **43 commit** đang có trên nền `dev` của nhánh mới. F-51 dùng F-50 vừa có ở `dev`, nên PR từ nhánh này vào `main` cũng bao gồm các commit nền mà `main` chưa nhận. Cần review toàn bộ diff của PR trước khi merge; không coi đó là diff chỉ riêng F-51. Hướng dẫn mặc định của team vẫn dùng PR vào `dev` khi không có yêu cầu khác từ chủ dự án.

## Tính năng

Mở `/restaurant/menu`, mở một bản nháp có thay đổi rồi chọn **Gửi duyệt thực đơn**. Modal hiển thị số món mới, đã sửa và sẽ bỏ, cho nhập ghi chú tùy chọn, sau đó chọn **Xác nhận gửi duyệt**. Menu đang bán tiếp tục phục vụ trong khi bản thay đổi chờ duyệt.

- Ghi chú tối đa 1.000 ký tự. Không nhập ghi chú thì gửi `{}`; có ghi chú thì gửi duy nhất `{ownerNote}` đã trim. Không gửi ID, items hoặc status trong body.
- Chỉ bản `draft` được gửi. Menu rỗng hoặc chưa có thay đổi được giải thích ngay trên trang và nút gửi bị khóa. Thay đổi còn/hết món không được tính là thay đổi bản nháp.
- Thành công dùng metadata BE trả về của **cùng submission ID**, chuyển `pending`, hiển thị ngày nộp/ghi chú; không còn nút sửa/thêm/xóa/gửi lại. Menu đang bán không đổi. Lịch sử và bản đang mở cập nhật tương ứng.
- **Để sau**, dấu X và Escape đóng modal nhưng giữ ghi chú trong trang. Ghi chú cũng được giữ khi chuyển sang lịch sử rồi mở lại cùng bản; reload/thoát trang sẽ mất ghi chú chưa gửi. Không tự lưu ghi chú qua API khác.
- Lỗi validation/mạng giữ ghi chú để sửa hoặc thử lại có chủ đích; không tự retry POST. Chặn click gửi lặp và khóa đóng modal khi đang gửi.
- `MENU_EMPTY`, `MENU_UNCHANGED`, `SUBMISSION_NOT_EDITABLE`, `SUBMISSION_NOT_FOUND` hiển thị lỗi đúng nghĩa, không báo thành công; có nút đóng và tải lại trạng thái BE. BE vẫn là nơi quyết định trạng thái/quyền cuối cùng.

## API và mức độ sẵn sàng BE

Đã kiểm tra controller, use case, validator và DI: BE có OWN-17, không cần bổ sung endpoint business cho task này.

| Nội dung          | Contract                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Operation         | OWN-17 `POST /api/v1/owner/restaurant/menu-submissions/{submissionId}/submit`                                                                |
| Vai trò           | `RESTAURANT_OWNER`, chỉ bản thuộc chủ đang đăng nhập                                                                                         |
| Body              | JSON `{ownerNote?: string}`, tối đa 1000 ký tự; `{}` hợp lệ                                                                                  |
| Thành công        | **200**, `ApiResponse.data` là `MenuSubmission` metadata; không có items và không tạo submission mới                                         |
| Chuyển trạng thái | `draft → pending`, ghi `submittedAt`, chuẩn hóa ghi chú trống thành null                                                                     |
| Lỗi               | 400 `MENU_EMPTY`, `MENU_UNCHANGED`, `VALIDATION_FAILED`; 404 `SUBMISSION_NOT_FOUND`; 409 `SUBMISSION_NOT_EDITABLE`; lỗi auth/role dùng chung |
| Proxy FE          | Chính xác POST với ID số dương, có body JSON, trả 200, kiểm Origin và Owner; không mở các method hay đường dẫn khác                          |

Nguồn API Design: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`; SHA256 ban đầu `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. Mục cần đối chiếu: `Backend API` dòng 74; `Chi tiết Request-Response` 336–337; `DTO` 143–151; `JSON mẫu` 2358–2376; `Mã lỗi` 10, 13, 42 và lỗi dùng chung.

**Chênh lệch ví dụ:** JSON mẫu trả 200 nhưng còn `status=draft`, `ownerNote=null`, `submittedAt=null`. Mô tả operation và BE thực tế xác định trạng thái sau gửi là `pending`. FE giữ đúng shape DTO và dùng giá trị BE trả về; mock trả pending với ngày nộp và ghi chú hợp lệ. Không sửa workbook hoặc ép response mẫu sai vào live.

## Tự kiểm thử

1. Chạy FE/BE theo [hướng dẫn local](local-run-and-test-guide.vi.md). Đăng nhập Owner của một nhà hàng đã xác minh.
2. Tạo bản nháp, mở bản vừa sao chép: chưa sửa gì thì nút gửi bị khóa. Thêm/sửa/xóa một phần menu, giữ ít nhất một món.
3. Mở modal gửi, nhập ghi chú rồi chọn **Để sau**. Mở lại và kiểm tra ghi chú còn nguyên. Chuyển qua lịch sử rồi quay lại cũng phải giữ nội dung.
4. Xác nhận gửi. Kiểm tra 200, cùng ID chuyển chờ duyệt, thời gian nộp/ghi chú hiện đúng; không còn sửa/gửi lại được. Reload để xác nhận lưu trong BE.
5. Kiểm tra menu đang bán vẫn giữ giá/món cũ. Chỉ khi Moderator duyệt ở một luồng khác thì thay đổi mới áp dụng; task này không triển khai quyết định Moderator.
6. Kiểm tra ghi chú trống và đúng 1000 ký tự; body trên Network không chứa items/status/token. Token đăng nhập vẫn ở session HttpOnly, không được gửi ra browser JSON.
7. Kiểm tra mobile, Tab/Escape, focus trở lại nút mở modal; mọi quyết định xác nhận dùng popup trong ứng dụng.

Không có env ứng dụng hoặc dependency mới. Các suite tắt Mapbox và chặn request browser ngoài localhost.

```powershell
npm run lint
npm test
npm run build
npm run typecheck
$env:PLAYWRIGHT_BROWSERS_PATH = '.cache/browsers'
npx playwright test -c playwright.owner.config.ts
```

Suite stub gồm F-51 và hồi quy F-50; snapshot production riêng, FE cổng 3001, API stub 5164. Chạy nối tiếp với các suite khác dùng cùng cổng.

Kiểm thử BE thật chỉ chạy ở Docker `angi_local`, cần seed helper từ phần chuẩn bị local F-50:

```powershell
./scripts/prepare-live-tests.ps1
$env:NODE_OPTIONS = ''
node --env-file=.env.integration node_modules/@playwright/test/cli.js test --config=playwright.live.config.ts
```

Lệnh tạo tài khoản mới và thay file `.env.integration` ignored, không thay env ứng dụng. Test đăng ký nhà hàng qua API thật rồi dùng **fixture BE có guard** `docker/local/Seed --set-menu-fixture` để chuẩn bị nhà hàng verified và hai món đang bán. Bước chuẩn bị này không chứng minh Moderator xác minh hoạt động. Sau đó toàn bộ gửi duyệt F-51 đi qua FE/proxy/API thật; không sửa DB để giả lập pending. Test không upload file hoặc gọi Mapbox. Trace/video/screenshot live tắt; evidence không chứa mật khẩu/token/URL bí mật.

Lượt triển khai dùng env ignored riêng `.cache/.env.menu-approval-live` để bảo toàn `.env.integration` cũ. Evidence: `artifacts/menu-approval-live.json`; ảnh giao diện stub: `.cache/menu-approval-mobile.png`, `.cache/menu-approval-desktop.png`.

## Kết quả kiểm chứng

Đã hoàn tất ngày **17/10/2026** (UTC+7). API .NET/PostgreSQL local thật tại cổng 5154; frontend production snapshot riêng với Next 16.4.0, Node 22.12.0. Không sửa BE business API, không thay env ứng dụng hay `.env.integration` cũ; dùng seed helper có sẵn từ F-50.

| Kiểm tra                                                | Kết quả                                                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint / TypeScript / format các file mới, code liên quan | Đạt                                                                                                                                                                    |
| Unit tests                                              | **132/132**, 15 file                                                                                                                                                   |
| Production build                                        | Đạt; artifact `.cache/owner-test-QsMHHo`, đã so sánh 136 file `src` với working tree, không khác biệt                                                                  |
| Browser stub                                            | **21/21**: 13 ca F-51 và 8 ca hồi quy F-50                                                                                                                             |
| BE thật                                                 | **1 ca end-to-end đạt**, gồm 2 lần gửi qua UI: ghi chú đúng 1000 ký tự và không có ghi chú                                                                             |
| Kết quả gửi                                             | 200, cùng submission ID, chuyển pending, có ngày nộp, ghi chú lưu đúng; reload vẫn pending và chỉ đọc                                                                  |
| Menu đang bán                                           | Giữ nguyên toàn bộ DishCard trong suốt sửa/gửi bản nháp; lịch sử phản ánh bản pending/cancelled đúng                                                                   |
| Ràng buộc BE                                            | 400 với menu chưa đổi, chỉ đổi availability, menu rỗng, ghi chú 1001 ký tự; 409 khi gửi/sửa pending; 401 khi chưa đăng nhập; 404 khi chủ khác gửi bản không thuộc mình |
| Quyền/Origin/proxy                                      | Stub đạt Owner/Traveler/Mod/Admin, Origin sai, ID sai, method/path ngoài allowlist; live đạt anonymous/foreign owner                                                   |
| Mobile/desktop/bàn phím                                 | Đã xem lại ảnh 390 px/1440 px; focus ghi chú khi mở/lỗi validation, Escape trả focus, giữ ghi chú khi đóng/chuyển lịch sử, không tràn ngang                            |
| Dịch vụ ngoài / browser                                 | **0 request Mapbox**, 0 upload, 0 page error, 0 native dialog trong lượt live                                                                                          |

Evidence live: `artifacts/menu-approval-live.json`, run `9a22cf3427e34f2db712db8522aa1157`, bắt đầu khoảng **10:54 ngày 17/10/2026**. Các lượt chạy dùng tài khoản test mới; dữ liệu fixture/pending còn trong DB local, không chạm tài khoản của người dùng. Lần kiểm tra đầu đã xác nhận gửi/lưu pending nhưng assertion so sánh nguyên chuỗi timestamp khác độ chính xác .NET 100 ns và PostgreSQL microsecond; test cuối so sánh cùng thời điểm ở độ chính xác millisecond và đạt toàn bộ luồng. FE không sửa chuỗi timestamp để che khác biệt.

Đã mở lại workbook từ đĩa **sau code và kiểm thử cuối**, đọc lại các sheet/range nêu trên. Thư mục BE chưa có bản mới hơn; file v1.8 vẫn 778867 byte, hash SHA256 giữ nguyên. Method/path/body/status/DTO/null/error của code cuối khớp operation và BE; chênh lệch JSON mẫu `draft` sau submit đã ghi rõ.

### Giới hạn

- Task này gửi để chờ duyệt; quyết định của Moderator và publish thực đơn sau phê duyệt nằm ngoài phạm vi. Fixture verified chỉ chuẩn bị dữ liệu, không giả lập kết quả gửi F-51.
- CAT-02 local vẫn trả `[]` (đã đọc lại). Đây là thiếu dữ liệu danh mục tag đã ghi ở F-50, không phải thiếu OWN-17; BE hiện vẫn chấp nhận món không có tag. Không tự bịa tag ID hoặc sửa catalog để làm test xanh.
- Ghi chú chưa gửi chỉ giữ trong trang hiện tại; không có API autosave ghi chú riêng. Lịch sử/trạng thái tải lại thủ công, không realtime.
- PR chưa được tạo, CI trên GitHub và review của Dũng chưa diễn ra; các kết quả trên là kiểm thử local. Code chưa stage/commit/push/merge.
