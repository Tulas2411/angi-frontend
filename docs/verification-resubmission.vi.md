# ANGI-68 — F-49 Gửi lại hồ sơ xác minh

> **Cập nhật 10/2026:** các lệnh dưới đây đã được gộp. Dùng `npm run test:browser` (trang chủ, auth, tài khoản), `npm run test:owner` (giờ mở cửa, trạng thái, xác minh, thực đơn), `npm run test:map` (đăng ký, hồ sơ, bản đồ, tỉnh/phường) và `npm run test:live` (backend thật, xem [live-backend-verification.md](live-backend-verification.md)). Các script `prepare-live-tests.ps1` và `cleanup-live-tests.ps1` đã bị xóa cùng bộ live cũ.


Nhánh `feat/ANGI-68-resubmit-verification` được tạo trước khi sửa code, từ `origin/dev` mới nhất `032595a12a765ba3680e53d741d909a6bf7a68f1` (đã gồm F-47/F-48). Code được để nguyên chưa stage/commit/push; không tạo PR thay chủ dự án.

## Cách sử dụng

1. Đăng nhập Owner và mở `/restaurant/verification?tab=status`.
2. Nếu hồ sơ **mới nhất** là `rejected` hoặc `needs_more_info`, nhà hàng không ở `pending`/`verified`, bấm **Gửi lại hồ sơ**. Hồ sơ cũ chỉ có nút xem, không có nút gửi lại.
3. Form điền sẵn tên pháp lý, số giấy phép, mã số thuế, ghi chú và toàn bộ tài liệu của hồ sơ trước. Phản hồi của người duyệt được hiển thị để đối chiếu.
4. Giữ tài liệu cũ, đổi loại, bỏ khỏi lần gửi lại hoặc tải thêm tài liệu mới. Bỏ tài liệu dùng popup xác nhận, không xóa hồ sơ cũ hay file trên server. Tài liệu cũ chỉ có ID/URL từ BE nên FE không tự tạo thông tin tên file, định dạng hoặc dung lượng; nhãn hiển thị là **Tài liệu đã gửi #...**.
5. Gửi **bộ tài liệu đầy đủ** của lần này. Những tài liệu đã bỏ không được đưa vào request mới. Bấm **Gửi lại hồ sơ xác minh**, kiểm tra popup rồi xác nhận.
6. Khi BE trả 201, hồ sơ mới chuyển `pending`, `previousId` trỏ hồ sơ vừa gửi lại. Trang hiển thị lịch sử qua OWN-07; dữ liệu/phản hồi của lần cũ được giữ nguyên. Reload vẫn đọc kết quả từ BE.

Luồng này đã nối BE thật qua proxy cùng origin. Không cần biến môi trường ứng dụng mới. Không còn màn minh họa; hãy dùng backend thật hoặc bộ stub (`npm run test:owner`).

## Hợp đồng và kiểm tra dữ liệu

```http
POST /api/v1/owner/restaurant/verifications/{verificationId}/resubmit
```

Role `RESTAURANT_OWNER`; `verificationId` là hồ sơ trước của chính Owner và phải là hồ sơ mới nhất. Proxy chỉ mở đúng POST với ID số dương và kiểm tra Origin/role; BE quyết định quyền sở hữu và trạng thái cuối cùng.

```json
{
  "legalName": "Hộ kinh doanh Bún Bò Bà Diệu",
  "businessLicenseNo": "32A8012345",
  "taxCode": "0401234567",
  "ownerNote": "Đã bổ sung giấy ATTP theo yêu cầu",
  "documents": [{ "docType": "food_safety_cert", "mediaId": 9002 }]
}
```

Request là thông tin đầy đủ, không phải PATCH. Chỉ gửi các trường trên; tên file, URL và trạng thái giao diện không đi vào body. Tài liệu giữ lại dùng đúng `mediaId` đã có; tài liệu mới đi qua MEDIA-01 với `purpose=verification_doc`.

- `legalName` bắt buộc, tối đa 255 ký tự; `businessLicenseNo` bắt buộc, tối đa 50. `taxCode` tối đa 20; `ownerNote` tối đa 1000. FE trim trước khi gửi.
- Cần ít nhất một tài liệu, với loại `business_license`, `food_safety_cert`, `id_card`, `storefront_photo` hoặc `other`. **OWN-08 không bắt buộc có file loại business_license**, khác OWN-06. Trường số giấy phép vẫn bắt buộc.
- Ảnh JPG/PNG/WEBP tối đa 5 MiB, PDF tối đa 10 MiB. Không tự đặt giới hạn số lượng tài liệu ngoài hợp đồng.
- 400 `VALIDATION_FAILED` hiển thị lỗi theo trường/chỉ số tài liệu và đưa focus về trường lỗi. Lỗi 503 giữ lại bản nháp và ID đã upload để thử lại.
- 409 `VERIFICATION_NOT_RESUBMITTABLE` hoặc 404 `VERIFICATION_NOT_FOUND` chặn gửi tiếp hồ sơ cũ và hướng dẫn tải lại trạng thái. BE cũng xử lý trường hợp chưa có nhà hàng và phiên/quyền không hợp lệ.
- Chuyển thẻ rồi quay lại cùng hồ sơ giữ bản nháp. Đổi sang hồ sơ khác, hủy hoặc tải lại khi đang soạn đều cần popup bỏ thay đổi. Không dùng `alert`, `confirm`, `prompt`.
- Liên kết tài liệu riêng tư chỉ mở khi người dùng bấm; không tự tải ảnh/PDF hoặc lưu URL vào browser storage. Nếu URL hết hạn, tải lại trạng thái/lịch sử để lấy URL mới.

## Đối chiếu tài liệu

Nguồn chính: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, sửa lần cuối 15/10/2026 15:48:43, 778.867 byte, SHA-256 `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. Bản trong thư mục `docs` gốc cũ hơn nên không dùng làm hợp đồng.

| Nguồn                                                 | Nội dung đối chiếu                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Backend API, hàng 65                                  | OWN-08 POST, Owner, 201, ID hồ sơ trước, lỗi 409                                                                  |
| Chi tiết Request-Response, 294–301                    | Đủ trường pháp lý và bộ tài liệu cho lần gửi lại                                                                  |
| DTO, 119, 127–142, 321                                | Trạng thái nhà hàng/hồ sơ riêng biệt, số ID, nullable review fields và previousId                                 |
| JSON mẫu, 2085–2122                                   | Mẫu request/response OWN-08                                                                                       |
| Mã lỗi, 10, 18, 22, 30, 41                            | Validation, auth/role, not-found, trạng thái không được gửi lại                                                   |
| MEDIA-01: Backend API 17; chi tiết 51–53; DTO 308–313 | Tài liệu riêng tư, purpose và giới hạn định dạng/dung lượng                                                       |
| Use Case Basic Descriptions, Resubmit Verification    | Gửi lại sau từ chối/cần bổ sung, tạo submission mới                                                               |
| Data Dictionary v1.2, Core 83 và 101–114              | Trạng thái nhà hàng, previous_id, người/thời điểm/phản hồi duyệt; chỉ dùng để đối chiếu và chuẩn bị fixture local |

Đã đọc BE `ResubmitVerificationUseCase`, validator, DTO, `RestaurantVerificationRules`, controller và repository. BE khóa nhà hàng trong transaction, kiểm tra hồ sơ của Owner là mới nhất, chỉ chấp nhận `rejected`/`needs_more_info`, kiểm tra media sở hữu riêng tư, tạo hồ sơ mới và đổi trạng thái nhà hàng sang pending.

**Chỗ sai khác trong JSON mẫu cần cập nhật tài liệu:** response mẫu OWN-08 đang giống dữ liệu OWN-06: `previousId: null`, tài liệu `business_license/9001` và ghi chú cũ, dù request gửi `food_safety_cert/9002` và ghi chú mới. Mô tả OWN-08, Data Dictionary và BE thực tế đều tạo liên kết về hồ sơ trước và lưu đúng dữ liệu được gửi. FE/mock theo hành vi đó; không sao chép các giá trị sai trong mẫu response. Workbook không bị sửa. Chênh lệch district cũ trong OWN-01 đã được ghi ở các task địa chỉ trước, không thay đổi hợp đồng OWN-08.

**Đối chiếu cuối sau code và kiểm thử:** đã mở lại workbook từ đĩa khoảng **04:19–04:20 ngày 17/10/2026 (+07:00)**, kiểm tra lại các sheet/hàng ở bảng trên và tìm phiên bản mới trong cả backend `.docs` lẫn thư mục `docs` gốc. V1.8 vẫn mới nhất, kích thước/thời gian sửa/SHA-256 không đổi. Method/path, 201, trường/giới hạn request, DTO/enums và mã lỗi khớp code/BE; các giá trị mẫu response sai được giữ thành ghi chú cần sửa tài liệu. Formatting, lint và TypeScript cuối đã qua; không sửa code ứng dụng sau bản build và các bộ browser đã đạt.

## Kết quả kiểm thử ngày 17/10/2026

- **122 unit test / 13 file đạt**, gồm 9 test F-49 về DTO, validation riêng, draft/metadata, eligibility, lịch sử bất biến, media/ownership và retry conflict.
- **30 ca browser stub đạt**, gồm 8 ca F-49 và 22 hồi quy F-47/F-48. Có kiểm tra 400/404/409/503, role/Origin/ID/method, modal/keyboard, giữ/thay tài liệu, draft, demo và mobile.
- Build production đã qua trong `.cache/owner-test-DFquBu`. Lint toàn FE và TypeScript đã qua; lần kiểm tra cuối sau chỉnh test được xác nhận cùng đối chiếu workbook.
- Đã xem ảnh desktop/mobile tại `artifacts/verification-resubmission-desktop.png` và `verification-resubmission-mobile.png`; form/tài liệu/nút theo chiều rộng màn hình, không tràn trang. Không tuyên bố khớp pixel với Figma mới.
- **Một kịch bản BE thật đạt, 46,4 giây**, kiểm tra liên tiếp cả `rejected` và `needs_more_info`, dùng FE production, Kestrel/PostgreSQL `angi_local` và Cloudinary thật. Kịch bản tái sử dụng chính bản build đã kiểm tra; chỉ đổi env server-side về BE thật.

| Kiểm tra live                                      | Kết quả                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| Đăng nhập, đăng ký fixture và nộp hồ sơ lần đầu    | Chạy qua BE thật; upload/form OWN-06 trả 201                              |
| Gửi lại từ rejected, thay giấy phép bằng file ATTP | MEDIA-01 201, OWN-08 201, hồ sơ mới ID 4 trỏ hồ sơ ID 3                   |
| Gửi lại từ needs_more_info, giữ file ATTP hiện có  | OWN-08 201, hồ sơ ID 5 trỏ ID 4; không cần upload thêm                    |
| OWN-07 sau reload                                  | 200, ba hồ sơ theo thứ tự 5 → 4 → 3; pending / needs_more_info / rejected |
| Hồ sơ cũ                                           | Giữ giấy tờ/phản hồi; popup mở được hồ sơ trước                           |
| Gửi lại hồ sơ cũ khi đã có pending                 | 409 VERIFICATION_NOT_RESUBMITTABLE                                        |
| ID không tồn tại / Owner khác có nhà hàng          | 404 VERIFICATION_NOT_FOUND, không lộ hồ sơ                                |
| Tài liệu rỗng / không đăng nhập                    | 400 / 401                                                                 |
| Link PDF riêng tư                                  | 200 và nội dung PDF; media mới ID 13 được giữ qua hai lần gửi lại         |
| Lỗi JS / native dialog / request Mapbox            | 0 / 0 / 0                                                                 |

**Giới hạn bằng chứng:** BE chưa có API quyết định duyệt của Moderator. Hai trạng thái đầu vào được chuẩn bị bằng công cụ fixture trong `angi-backend/docker/local/Seed/VerificationReviewFixture.cs`, có guard database local, đúng GUID/tài khoản/tên nhà hàng/tên pháp lý kiểm thử và chỉ sửa hồ sơ pending mới nhất. Đây là bước chuẩn bị dữ liệu, không phải kiểm thử luồng Moderator. Mọi upload/gửi lại/đọc lịch sử sau đó đều gọi API thật; không stub phản hồi và không để FE truy cập database.

Lượt đầu chuẩn bị upload bằng HTTP client trả 503 trước OWN-08; chưa xác định nguyên nhân gốc. Cấu hình Cloudinary đang chạy khớp `.env`. Lượt chạy lại qua form trình duyệt thành công trọn luồng, không thay khóa hoặc code upload ứng dụng. Không diễn giải một lượt thành công là đã chứng minh dịch vụ bên ngoài luôn ổn định. Chưa kiểm toàn bộ định dạng file, hết hạn URL, cạnh tranh nhiều người dùng hoặc API Moderator.

Tài khoản/test env riêng nằm trong cache bị ignore; `.env` thật FE/BE và `.env.integration` hiện có được giữ nguyên. Trace/HAR/video tự động tắt; artifact `artifacts/verification-resubmission-live.json` chỉ ghi status, ID tổng hợp và số lượng, không chứa token/mật khẩu/URL ký. Hai PDF của lượt thành công được cleanup theo đúng Owner/run; lượt thất bại có 0 media được lưu. Metadata/hồ sơ còn trong database local, nên link tài liệu kiểm thử không còn dùng để mở file sau cleanup. Không gọi, dò hoặc sửa token Mapbox.

## Tự kiểm tra

Không cần BE thật:

```powershell
npm test -- tests/verification-resubmission.test.ts
npx playwright test -c playwright.owner.config.ts
```

Với BE local thật và Cloudinary đã cấu hình, chạy từ `angi-frontend`, cổng 3001 trống, có Docker Desktop. Cần công cụ fixture mới trong checkout BE cùng cấp. Script chuẩn bị bên dưới ghi lại `.env.integration` với tài khoản mới cho lượt chạy; giữ bản cấu hình kiểm thử cũ trước nếu cần. Không thay `.env` ứng dụng.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-live-tests.ps1
$env:NODE_OPTIONS = ""
try {
  node --env-file=.env.integration node_modules/@playwright/test/cli.js test --config=playwright.live.config.ts
} finally {
  powershell -ExecutionPolicy Bypass -File scripts/cleanup-live-tests.ps1
}
```

Bộ live upload hai PDF tổng hợp nhỏ và tải một tài liệu để kiểm tra URL. Cleanup chỉ xóa asset của đúng tài khoản kiểm thử; không xóa database. Mỗi lượt cần tài khoản mới. Bộ stub/live chạy tuần tự vì cùng dùng FE cổng 3001; cả hai tắt Mapbox. Các bộ live cũ vẫn được giữ riêng để kiểm tra F-47/F-48.
