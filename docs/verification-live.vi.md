# Kiểm thử BE thật — F-47 / F-48

> **Tài liệu lịch sử (trước đợt dọn 10/2026).** Các cấu hình Playwright, script seed và màn `/demo` được nhắc dưới đây đã bị gộp hoặc xóa. Nội dung giữ lại làm bằng chứng; cách chạy hiện tại nằm trong [README](../README.md#checks).


Ngày kiểm tra: **17/10/2026, khoảng 01:56–01:58, giờ Việt Nam**. Nhánh FE: `feat/ANGI-65-view-verification-status`.

Lần bàn giao trước chỉ có kiểm tra bằng API stub. Đó là thiếu sót so với yêu cầu kiểm thử BE thật của chủ dự án. Lượt bổ sung này chạy FE production → Next.js proxy → Kestrel → PostgreSQL `angi_local`, cùng upload/tải tài liệu Cloudinary thật. Không dùng stub để thay phản hồi nghiệp vụ.

## Kết quả

**4/4 ca browser live đã qua.** Các trạng thái HTTP dưới đây được quan sát trong lượt chạy thật:

| Nội dung                                        | Kết quả thực tế                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Đăng nhập Owner                                 | 200; session FE hoạt động với BE thật                                            |
| Owner chưa có nhà hàng                          | OWN-07 trả 404 `RESTAURANT_NOT_FOUND`; giao diện hướng dẫn đăng ký               |
| Chuẩn bị nhà hàng bằng OWN-01                   | 201; không cần gửi quận/huyện, không mở bản đồ                                   |
| Nhà hàng chưa nộp hồ sơ                         | OWN-07 trả 200, `unverified`, `items: []`; hiển thị trạng thái rỗng              |
| Gửi payload trống                               | OWN-06 trả 400                                                                   |
| Upload PDF tổng hợp từ form F-47                | MEDIA-01 trả 201, `purpose=verification_doc`; file thật được lưu trên Cloudinary |
| Gửi hồ sơ qua popup xác nhận                    | OWN-06 trả 201; hồ sơ chuyển `pending`, đúng ID tài liệu                         |
| Xem trạng thái F-48                             | OWN-07 trả 200; `verificationStatus=pending`, lịch sử có đúng một hồ sơ vừa nộp  |
| Tải lại trang và lịch sử                        | Vẫn giữ hồ sơ từ BE; popup chi tiết hiển thị đúng tên pháp lý/số giấy phép       |
| Phản hồi chưa có                                | `reviewedBy`, `reviewNote` là null; giao diện ghi rõ chưa có phản hồi            |
| Gửi lại khi đang pending                        | 409 `VERIFICATION_ALREADY_PENDING`; không tạo hồ sơ trùng                        |
| Link tài liệu riêng tư                          | Tải thật trả 200, `application/pdf`, nội dung bắt đầu bằng `%PDF-`               |
| Không đăng nhập / Traveler                      | 401 / 403 ở cả proxy FE và gọi trực tiếp BE                                      |
| Owner khác                                      | Không đọc được lịch sử của Owner đã nộp; tài khoản chưa có nhà hàng vẫn nhận 404 |
| Lỗi JavaScript / native dialog / request Mapbox | 0 / 0 / 0 trong luồng browser nộp và xem hồ sơ                                   |

Hồ sơ kiểm thử cuối có `verificationId=2`, `mediaId=11`. Đây là dữ liệu tổng hợp trên tài khoản mới, không phải tài liệu pháp lý hay tài khoản cá nhân. Việc đăng ký nhà hàng trong bộ này là bước chuẩn bị bằng API; không thay thế kiểm thử toàn bộ form F-43.

## Vấn đề đã phát hiện và xử lý

1. **API local chạy mã cũ.** Lượt đầu, OWN-01 trả 400 `VALIDATION_FAILED`, `district: Quận/huyện là bắt buộc.` dù mã BE hiện tại đã cho phép địa chỉ hai cấp. Đã chạy `docker compose -f docker-compose.local.yml up -d --no-deps --force-recreate api` để khởi động lại riêng API từ mã hiện tại. Lượt sau đăng ký không có district trả 201. Database không bị reset; không sửa thêm mã BE trong lượt kiểm tra này.
2. **Giả định sai trong bộ test.** Test ban đầu chỉ chấp nhận host tải file `res.cloudinary.com`. BE dùng Cloudinary SDK `DownloadPrivate`, có thể trả host `api.cloudinary.com`. Đã sửa điều kiện của test, sau đó tải thành công PDF riêng tư với 200. Không đổi URL do BE trả về hoặc sửa code ứng dụng để né lỗi test.

## Phần chưa được chứng minh bằng BE thật

- **Chưa chạy từ đầu đến cuối bước Moderator duyệt/từ chối/yêu cầu bổ sung.** OpenAPI thật trả 200 nhưng chỉ liệt kê hai đường dẫn verification phía Owner: `/api/v1/owner/restaurant/verifications` và `/api/v1/owner/restaurant/verifications/{verificationId}/resubmit`. Checkout BE hiện chưa có endpoint xử lý duyệt hồ sơ của Moderator. Không sửa database để giả lập một lượt duyệt thật.
- Vì vậy, lịch sử nhiều lần nộp, `previousId`, phản hồi/người duyệt và các trạng thái `approved`, `rejected`, `needs_more_info`, `cancelled` vẫn mới được kiểm tra bằng stub/demo ở F-48. Chưa kết luận các chuyển trạng thái này chạy xuyên suốt hệ thống thật.
- Chưa kiểm thời hạn năm phút của link riêng tư bằng cách chờ hết hạn, ảnh riêng tư, mọi loại tài liệu, mọi tình huống mất mạng hoặc toàn bộ ứng dụng. OWN-08 ở FE vẫn thuộc F-49.
- Không kiểm Google, email, recommendation hoặc Mapbox trong bộ này. Cảnh báo thiếu Google client ID là do cấu hình FE kiểm thử cố ý để trống; không ảnh hưởng đăng nhập email/password đã kiểm.

## Môi trường và bằng chứng

- BE thật: `http://127.0.0.1:5154/api/v1`, PostgreSQL local cổng 5434. FE cô lập cổng 3001; `.env` thật của FE/BE và `.env.integration` hiện có được giữ nguyên.
- Build production đã qua trong `.cache/owner-test-DBSQXw`. Lượt cuối chỉ sửa test, dùng lại chính bản build này qua config tạm trong cache; mã ứng dụng không thay đổi giữa các lượt. Config chính `playwright.verification-live.config.ts` tự build mới khi chạy bình thường.
- Lượt cuối: **4 passed (8.8s)**. Lint cấu hình/test mới và TypeScript toàn FE đã qua sau sửa test; formatting và kiểm tra diff cũng qua. Đã mở lại API Design sau các kiểm tra, khoảng 02:00 cùng ngày; phạm vi sheet/hàng được ghi trong báo cáo F-48.
- Kết quả không chứa mật khẩu, token hay URL ký: `artifacts/verification-live-evidence.json`. Không ghi trace/HAR/video/ảnh chứa dữ liệu đăng nhập. Không commit tài khoản kiểm thử hoặc artifact.
- Mỗi lượt upload một PDF nhỏ. Asset của lượt bị dừng ở điều kiện host đã được xóa trước khi chạy lại; asset của lượt thành công cũng được cleanup theo đúng tài khoản/run. Tổng hai asset kiểm thử được xóa khỏi Cloudinary; metadata/hồ sơ trong database local được giữ lại nên link của các hồ sơ này không dùng để mở tài liệu sau cleanup.
- Không gọi API Mapbox, không thử token, không thay token hoặc mở map. Tất cả request trình duyệt ra ngoài localhost bị chặn; lượt tải PDF chủ động dùng HTTP client riêng của Playwright.

Nguồn hợp đồng: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, SHA-256 `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. Các yêu cầu OWN-06/OWN-07/MEDIA-01 không đổi; địa chỉ hai cấp theo yêu cầu chủ dự án vẫn khác mục district cũ trong workbook, đã được ghi tại [bằng chứng địa chỉ](verification.md).

Cách tự chạy và cleanup: [hướng dẫn F-48](verification-status.vi.md#bộ-kiểm-tra-be-thật-f-47f-48). Bằng chứng unit/stub và đối chiếu workbook cuối: [báo cáo F-48](verification-status-evidence.md).
