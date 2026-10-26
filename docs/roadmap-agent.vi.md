# Trợ lý món ăn trên trang chi tiết lộ trình

## Tình trạng tích hợp

FE đã có giao diện chat và adapter gọi AGENT-01, AGENT-02, AGENT-03, AGENT-04 qua proxy cùng origin. **Checkout `angi-backend` hiện tại chưa có controller/use case Agent**. Chủ dự án đã xác nhận ngày 2026-10-26: làm FE trước, nối đúng endpoint, bổ sung BE sau. Đây là phần tích hợp chờ BE; chưa thể chat với AI thật chỉ bằng checkout hiện tại. Sản phẩm không dùng API giả hoặc câu trả lời mẫu để thay thế lỗi BE.

Vào `/roadmaps`, mở một lộ trình của tài khoản Traveler rồi bấm **✦ Trợ lý món ăn** ở sidebar. Khi BE chưa bổ sung endpoint, khung chat vẫn mở đúng bố cục và báo API chưa có; ô soạn thảo giữ nội dung, nút gửi bị khóa đến khi có hội thoại hợp lệ.

## Thiết kế và thao tác

Đã đọc trực tiếp Figma frame [ANGI / Roadmap / 18 Trợ lý AI (`137:712`)](https://www.figma.com/design/lxEl7PJc0LdQ8j47KlUPkO/ANGI?node-id=137-712), đặc biệt panel `140:1230`: nền trắng, header ANGI / Trợ lý ăn uống, nút Đóng, nhắc kiểm tra nội dung AI, ba gợi ý đầu cuộc trò chuyện và khung nhập ở dưới cùng. Giữ font DM Sans/Fraunces và token hiện có của màn roadmap.

- Panel trượt từ trái sang phải trong 380 ms, phủ sidebar và sổ tay; bản đồ bên phải vẫn được giữ nguyên component và sử dụng được. Đóng panel trượt ngược lại. Màn dưới 901px dùng panel toàn chiều rộng. `prefers-reduced-motion` tắt chuyển động.
- Đây là panel không chặn bản đồ. Nội dung phía sau panel không nhận focus; khi mở, focus vào ô nhập; Escape hoặc Đóng trả focus về nút sidebar. Popup xác nhận dùng `ConfirmDialog`, biểu mẫu ràng buộc dùng `Dialog`; không dùng browser alert/confirm/prompt.
- Ba gợi ý chỉ điền vào ô soạn thảo để người dùng xem lại, không tự gọi AI. Địa danh ở lời chào lấy từ `conversation.state.province`, thiếu thì không tự đoán tỉnh.
- Enter gửi, Shift + Enter xuống dòng, không gửi giữa phiên gõ IME. Nội dung bắt buộc có chữ và dài tối đa 4.000 ký tự. Tin nhắn hiển thị bằng văn bản, không chèn HTML từ AI.
- Không áp dụng câu “mỗi bữa tối đa 2 món” từ bản thiết kế vì hợp đồng Agent không đặt giới hạn đó; helper giải thích bản nháp chỉ lưu khi xác nhận.

## Bốn API

| Mã       | Phương thức / đường dẫn BE                       | FE xử lý                                                                                                                                             |
| -------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGENT-01 | `POST /api/v1/agent/conversations`               | Gửi `{ roadmapId }` khi mở lần đầu; giữ status 201. Không tạo hội thoại khi chỉ vào trang roadmap.                                                   |
| AGENT-02 | `POST /api/v1/agent/conversations/{id}/messages` | Gửi ID số dương duy nhất, `expectedConversationVersion`, nội dung, command và lựa chọn item/ràng buộc khi có. Giữ nguyên status 200 hoặc 202 của BE. |
| AGENT-03 | `GET /api/v1/agent/conversations/{id}`           | Khôi phục lịch sử/state/proposal, đọc lại sau mỗi lượt; polling khi đang xử lý.                                                                      |
| AGENT-04 | `POST /api/v1/agent/conversations/{id}/confirm`  | Chỉ gửi ID và version proposal đã được xem và xác nhận qua popup; sau thành công tải lại roadmap bằng RM-03.                                         |

`agent-service.ts` dùng `shared/api/client.ts`; trình duyệt không nhận token BE hoặc khóa AI. `agent-proxy.ts` chỉ cho đúng bốn operation, kiểm tra ID trong đường dẫn; Route Handler kiểm tra Origin và chỉ cho Traveler. Các lệnh Agent có thời gian chờ tối đa 65 giây; các API cũ giữ mặc định 10 giây. Proxy giữ `Retry-After`, validation/error data và status 200/202 thực tế.

Chỉ lưu ID hội thoại trong `sessionStorage`, tách theo ID người dùng và ID roadmap. Không lưu transcript, proposal, GPS hoặc token vào browser storage. Đóng/mở chat dùng lại hội thoại hiện có; tải lại trang khôi phục qua GET. Hội thoại hết hạn/đóng có nút mở hội thoại mới, không xóa roadmap đã lưu.

## Chờ kết quả và tránh ghi nhầm

- Mỗi lượt mới dùng `clientMessageId` dạng số nguyên dương an toàn với JavaScript. Thử lại sau lỗi giữ nguyên ID, nội dung, version và lựa chọn của đúng lượt cũ; việc sửa ô nhập không làm đổi payload đang thử lại.
- HTTP 202 chỉ chuyển sang GET polling mỗi 2 giây, không POST lại tin. Đóng panel hoặc ẩn tab tạm ngưng polling; mở lại lấy state mới. Dừng tự kiểm tra sau 90 giây hoặc ba lỗi đọc liên tiếp; người dùng có thể bấm Kiểm tra hội thoại. Không tự gửi tin mới khi còn lượt xử lý.
- `replayed=true` chỉ dùng GET để lấy bản hiện hành, không ghi đè giao diện bằng proposal cũ trong kết quả replay. Xung đột version hiển thị lỗi và tải state mới, không tự gửi lại mutation.
- Bản xem trước hiển thị item theo ngày/bữa/thứ tự, giá và tên món/quán từ BE, tổng tiền, các thay đổi, lỗi, cảnh báo và số liệu tuyến; phân biệt tuyến ước tính và origin bị bỏ. Không vẽ tuyến hoặc gọi Mapbox thêm để tạo preview.
- Chọn một item gửi `selectedItemKey` cho yêu cầu tiếp theo. Tìm phương án khác dùng `command=alternative`; bỏ nháp/làm mới dùng `discard`/`reset` sau popup xác nhận.
- Form ràng buộc cho phép xác nhận tỉnh, số ngày, tên, ngân sách và giá mỗi món. Không giới hạn ngân sách phải được chọn rõ trên UI. `confirmedState` giữ nguyên tag, tag loại trừ, origin và phạm vi đang có; không tự nới chúng theo câu trả lời AI.
- Chỉ cho xác nhận proposal active/ready, còn hạn, không có lỗi chặn hoặc câu hỏi chưa giải quyết. Kiểm tra lại thời hạn ngay tại thao tác xác nhận. Lưu thất bại không có thông báo thành công. Kết quả lưu chưa rõ phải thử lại đúng cặp proposal ID/version; chặn gửi yêu cầu mới trong lúc này.
- Lưu thành công nhưng RM-03 thất bại có thông báo riêng và chỉ thử lại lần đọc. Khi đọc lại thành công, bỏ cache tuyến/địa điểm cũ vì Agent có thể đổi origin hoặc thứ tự bữa mà vẫn giữ item ID. Roadmap mới khác ID có liên kết mở riêng.

IMP-01 được dùng kèm: chỉ báo item có Recommendation `requestId` thật khi thấy ít nhất 50% trong một giây, nhóm theo requestId và gom mỗi 2,5 giây/khi đóng. Item rating fallback có `requestId=null` không tạo impression. Proxy IMP-01 đã sửa về đúng status 202 theo hợp đồng. Đây không phải lời gọi AI hay Mapbox mới.

## Hợp đồng được sử dụng

Theo yêu cầu trực tiếp, nguồn của bốn endpoint mới là `C:\Users\Tulas\Downloads\ANGI_API_Design_Ver1.8 (1).xlsx` (752.878 byte, sửa 2026-10-26 18:26:08), SHA-256 `A0842E8F4CCBBB2C4E2F5F22A467BD8409AEFCBB7CC745648ECDB878326121A3`.

- `Backend API`: r119–r122 (AGENT-01..04), hàng IMP-01.
- `Chi tiết Request-Response`: r548–r583.
- `DTO`: r349–r435, gồm State, Conversation, Transcript, Turn, Proposal, Snapshot, Item, CandidateGrant, Scope, Change, Validation, DayRoute, RouteMetric và Commit.
- `JSON mẫu`: r3825–r4223, gồm response 202 của AGENT-02 ở r4030–r4042.
- `Mã lỗi`: r55–r65.
- `Enum`: r36–r40.

Bản cùng tên V1.8 trong `angi-backend/.docs/` có nội dung khác và chưa liệt kê bốn API Agent; đã tìm trong Controllers/DTOs của checkout BE và chưa thấy implementation. Không suy diễn rằng cùng số version nghĩa là cùng hợp đồng. Cần BE triển khai theo file mới, giữ nguyên envelope, thời hạn, idempotency và kiểm tra version trước khi nghiệm thu live.

## Kiểm thử

Test fixture chỉ nằm trong `tests/fixtures/agent.ts`, không được import từ `src`. Browser dùng server auth/BE stub cục bộ ở 5164 và FE snapshot riêng ở 3001, token Mapbox rỗng; request trình duyệt ra dịch vụ ngoài bị chặn. Không đọc `.env` thật vào snapshot, không gọi LLM, Recommendation hay Mapbox thật.

```powershell
$env:NODE_OPTIONS=''
npm test
npm run typecheck
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npx playwright test --config=playwright.agent.config.ts
```

Kết quả cuối ngày 2026-10-26:

| Kiểm tra                               | Kết quả                                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toàn bộ Vitest                         | 28 file / 214 test đạt; 7 test riêng cho Agent và adapter/proxy.                                                                                                                                                                    |
| TypeScript và ESLint phần thay đổi     | Đạt.                                                                                                                                                                                                                                |
| Production build trong snapshot cô lập | Đạt, gồm route `/roadmaps/[roadmapId]`.                                                                                                                                                                                             |
| Browser trên production                | **40 test đạt**: 19 test Agent và 21 test hồi quy roadmap detail. 6 test GL của suite cũ bỏ qua có chủ đích vì cấu hình token rỗng; không chạy Mapbox thật.                                                                         |
| Visual / assets                        | Đã xem ảnh desktop và mobile; kiểm tra 1713, 1440, 768, 390 và 320px không tràn ngang, map giữ nguyên vị trí, giảm chuyển động, Escape/trả focus. 45 asset Figma, 7 font và 3 giấy phép đã xác minh. Panel không thêm artwork tĩnh. |

Các test Agent bao phủ: tạo hội thoại khi mở; giữ nguyên map; gửi/preview/chọn item; popup xác nhận và tải lại RM-03; 202/polling; đóng khi đang xử lý; retry đúng payload; replay không ghi đè bản mới; version conflict; xác nhận chưa rõ kết quả không ghi hai lần; validation khi confirm bị từ chối; khôi phục sau tải lại trang và hết hạn; xác nhận ngân sách không giới hạn; impression chỉ từ item nhìn thấy/có requestId; thiếu endpoint; alternative/discard/reset; proposal hết hạn; Origin/role; hội thoại closed; lưu thành công nhưng RM-03 thất bại.

Ảnh nằm trong thư mục ignored `artifacts/roadmap-agent/`: `assistant-with-map-1713.png` và `assistant-{1713,1440,768,390,320}.png`. Nền bản đồ trong lần kiểm tra là trạng thái cục bộ không có token/không có điểm, không phải ảnh bản đồ thật. Không coi browser stub là bằng chứng chat đã chạy với BE thật.

Sau khi hoàn tất code và các kiểm tra trên, đã **mở lại workbook từ đĩa**, đọc lại toàn bộ các vùng AGENT đã liệt kê, JSON response 202, lỗi/version/expiry và IMP-01 (`Backend API` r45). Hash file người dùng gửi vẫn là `A0842E8F4CCBBB2C4E2F5F22A467BD8409AEFCBB7CC745648ECDB878326121A3`; hợp đồng không thay đổi trong task. Bản backend `.docs` có hash `7E1FC6F276A538CD9A092FC7D52A451AC0ED8E45459D1A39934F1C71C813344C` và vẫn không có AGENT-01..04. Không có implementation BE để nghiệm thu live; trạng thái chờ BE được giữ rõ ràng.

Thay đổi được để unstaged/uncommitted trên nhánh hiện tại `feat/ANGI-138-add-roadmap-item-with-ai`. Không sửa `.env`, không đổi nhánh, commit hoặc push.
