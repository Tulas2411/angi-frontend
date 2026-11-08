# Trợ lý món ăn trên trang chi tiết lộ trình

## Tình trạng tích hợp

FE đã có giao diện chat và adapter gọi AGENT-01, AGENT-02, AGENT-03, AGENT-04 qua proxy cùng origin; backend đã triển khai bốn endpoint này. Sản phẩm không dùng API giả hoặc câu trả lời mẫu để thay thế lỗi BE.

Vào `/roadmaps`, mở một lộ trình của tài khoản Traveler rồi bấm **Trợ lý món ăn** ở sidebar (nút gradient san hô sang tím, biểu tượng `SparklesIcon`, sát mép trái sidebar và bo tròn bên phải; dưới 900px là viên bo tròn hai đầu). Nếu endpoint không phản hồi, khung chat vẫn mở đúng bố cục và báo lỗi; ô soạn thảo giữ nội dung, nút gửi bị khóa đến khi có hội thoại hợp lệ.

## Trả lời một lần và điểm trên bản đồ (2026-11-02)

- Mỗi nội dung chỉ hiện ở một nơi. Tin nhắn của trợ lý là vài câu ngắn do BE dựng; danh sách món nằm ở thẻ bản nháp. Câu hỏi đang chờ chỉ nằm trong tin nhắn, cảnh báo đã có trên thẻ không lặp ở panel (`standaloneValidation`).
- Khi panel mở và có bản nháp `ready`, bản đồ hiện điểm của bản nháp thay cho điểm đã lưu, vì bản nháp đã gồm cả món giữ nguyên. Mỗi ngày có một màu riêng (tối đa 7 ngày), dùng chung cho ghim, chú giải và nút chọn ngày; các ghim không nối với nhau. Món được thêm hoặc thay (`snapshot.changes`) ghi "Món mới" trong thẻ bản nháp và trên thẻ thông tin của ghim. Đóng panel, lưu xong hoặc bản nháp hết hiệu lực thì bản đồ trở lại lộ trình đã lưu.
- Bộ chọn ngày trên thẻ, danh sách món và điểm trên bản đồ luôn cùng một ngày. Bản nháp mới mở đúng ngày đầu tiên có thay đổi. Món trên thẻ chỉ để đọc. Bấm điểm trên bản đồ hoặc tên món trong câu trả lời sẽ mở thẻ thông tin của điểm đó và đánh dấu món tương ứng; FE không gửi `selectedItemKey`, món cần đổi được nói trong chat.
- Điểm bản nháp được thêm vào bản đồ đang mở: không tạo lại bản đồ, không gọi Directions hay geocoding và không vẽ tuyến. Món thiếu tọa độ vẫn có trong danh sách với ghi chú chưa có tọa độ.
- Panel mở rộng phủ mọi thứ bên trái bản đồ (header và sidebar), cao hết màn hình, và luôn chừa nguyên bản đồ: trên 1200px rộng đúng nửa trái màn hình (`calc(100% - var(--roadmap-map-width))`, khớp bố cục chia đôi của trang chi tiết, đổi 2026-11-04); từ 901px đến 1200px theo tỉ lệ cũ của sổ tay (sidebar + 1,16 phần trong 2,16).
- Dưới 901px panel che bản đồ, nên thẻ có nút **Xem trên bản đồ**; panel lùi đi và nút **Quay lại trợ lý** đưa về đúng chỗ, giữ focus.
- Mỗi món có giới thiệu và lý do gợi ý, mỗi ngày có kết luận (`snapshot.dishNotes`, `snapshot.daySummaries`). Model viết, backend kiểm tra rồi mới hiện: không số, không tên riêng ngoài dữ liệu, không khẳng định nổi tiếng hay giờ mở cửa. Câu không qua kiểm tra bị bỏ, thẻ vẫn hiện các thông tin còn lại. Phần này chỉ nằm trong bản nháp, không lưu vào lộ trình.
- ~~Bản nháp không có nút thao tác, lưu bằng câu “lưu lịch này”~~: thay bằng thẻ lịch nháp và nút **Thêm vào lịch trình** (2026-11-08, xem dưới). Câu “lưu lịch này” và “bỏ bản nháp” vẫn được backend xử lý như trước (lượt chat đã lưu trả về `commit`), chỉ không còn được ghi sẵn trên thẻ.

## Thẻ lịch nháp và nút Thêm vào lịch trình (2026-11-08)

Chủ dự án yêu cầu: bản nháp không còn nằm giữa các tin nhắn mà là một thẻ ở mép trên ô chat; bấm thẻ thì bản nháp trượt lên; lưu bằng nút thay vì gõ lệnh. Mã: `agent-draft-dock.tsx` (`AgentDraftTab`, `AgentDraftSheet`), `roadmap-agent-panel.tsx`, mục "draft dock" trong `roadmap-agent.css`.

- **Thẻ** (`.agent-draft-tab`, nút có `aria-expanded` / `aria-controls="agent-draft-sheet"`): nằm sát trên ô chat khi có bản nháp. Về cấu trúc, thẻ thuộc `.agent-body` (ở đáy, sau khung hội thoại và trước tấm nháp; đổi 2026-11-08 theo yêu cầu, trước đó thuộc `.agent-composer-area`), có lề hai bên bằng `--agent-gutter` và chừa 12px phía dưới cho bóng. Ghi "Lịch nháp", tên lịch, số ngày · tổng dự chi, trạng thái (Chờ bạn xác nhận, Đã thêm, Đã hết hạn…) và mũi tên. Bản nháp mới hoặc phiên bản mới chưa mở có nhãn "mới". Mặc định thẻ **đóng**.
- **Tấm nháp** (`.agent-draft-sheet`, region "Lịch nháp của trợ lý"): bấm thẻ thì trượt lên từ mép ô chat, phủ phần tin nhắn (320 ms, đóng 220 ms; `prefers-reduced-motion` tắt chuyển động). Khi mở, thẻ ở mép ô chat **ẩn đi** (chủ dự án yêu cầu 2026-11-08): chân tấm chỉ còn nút Thêm vào lịch trình, còn tên lịch, nhãn trạng thái và nút thu gọn ("Thu gọn lịch nháp", mũi tên xuống, `AgentDraftCollapse`) nằm cùng một hàng trong `.agent-proposal-head`. Tấm là một khung bo tròn đủ bốn góc. Mở thì tiêu điểm chuyển tới nút thu gọn; thu lại (nút, Escape) thì tiêu điểm trở về thẻ. Tiêu điểm chuyển với `preventScroll`: lỗi 2026-11-08 là focus lúc tấm còn đang trượt lên đã cuộn khung `.agent-body` (`overflow: hidden` vẫn cuộn được bằng code) khoảng 200px, đẩy cả hội thoại lẫn tấm nháp lên trên, để trống phần dưới. Ngoài ra `.agent-body` và panel tự đặt lại `scrollTop = 0` khi bị cuộn (`onScroll`), nên `scrollIntoView` khi chọn ghim chỉ cuộn phần nội dung tấm nháp. Không dùng `overflow: clip` vì làm hỏng thao tác bấm trong hội thoại. Bên trong là `AgentProposalPreview` như trước (ngày, bữa, món, chặng, giới thiệu, kết luận ngày), cuộn được, cuối là câu "Muốn đổi món? Cứ nhắn cho trợ lý, bản nháp sẽ cập nhật."
- **Nút Thêm vào lịch trình** ở chân tấm (luôn thấy, không cuộn theo), dùng cho cả bản nháp tạo mới lẫn bản nháp sửa lộ trình đã có. Nút cùng gradient san hô sang tím và bóng tím với nút "Trợ lý món ăn" (`--agent-gradient`); chân tấm chừa 20px phía dưới để bóng không bị cắt. Nút gọi AGENT-04 `confirm` với `proposalId` và `proposalVersion` của bản đang xem. Nút khóa khi hội thoại đang bận (đang trả lời, bản nháp cũ, lượt đang chờ). Thành công: chân tấm ghi "Đã thêm vào lịch trình." kèm "Mở lộ trình", thẻ ghi "Đã thêm", trang tải lại roadmap (RM-03); tải lại lỗi thì có nút "Tải lại lộ trình". Lỗi khi lưu hiện trong chân tấm (chỉ khi tấm đang mở, để không lặp với tin nhắn lỗi). Bản nháp hết hạn hoặc cần điều chỉnh thì không có nút, chỉ có câu giải thích.
- **Ô chọn ngày cạnh nút** (2026-11-08): chỉ hiện khi cả bản nháp (`snapshot.state.startDate`) lẫn hội thoại (`state.startDate`) chưa có ngày bắt đầu. Nhãn "Ngày bắt đầu (không bắt buộc)", dùng `DateField` chung, không cho chọn ngày đã qua. Chọn ngày thì `confirm` gửi kèm `startDate` (yyyy-MM-dd); để trống thì không gửi và lộ trình được lưu chưa có ngày, như khi trả lời "để sau" trong chat. Có ngày rồi thì không hiện ô này và không gửi `startDate` (giữ ngày đang có). Ô và nút nằm cùng một hàng; dưới 480px xếp chồng. Lịch chọn ngày mở **lên trên** ô (`DateField` thêm tuỳ chọn `pickerSide="top"`, mặc định vẫn `bottom` cho mọi form khác): ô nằm ở đáy panel cố định, mở xuống thì lịch bị cắt ở mép màn hình mà trang không cuộn được để lộ ra. Khi mở lên trên, lịch còn tự dịch ngang để không vượt mép màn hình (Radix `avoidCollisions`, cách mép 8px), vì popup nằm sát cạnh phải; lịch mở xuống của các form khác vẫn giữ cách cũ (không né mép, trang cuộn để lộ lịch).
- **Mở tự động:** bấm ghim trên bản đồ hoặc tên món trong câu trả lời thì tấm nháp mở ra và cuộn tới món đó.
- **Header bám mép trên** (2026-11-08, `.agent-proposal-top` trong `agent-proposal.tsx`): tên lịch, trạng thái, nút thu gọn, tổng dự chi và các nút chọn ngày là một khối đứng yên ở đầu tấm khi cuộn, có đường kẻ ngăn với phần ngày bên dưới. Hộp cảnh báo của bản nháp chuyển xuống ngay dưới header để header không quá cao. Món được cuộn tới khi chọn ghim chừa 170px phía trên (`scroll-margin-top`) để không bị header che. Khi tấm mở, khung hội thoại phía sau mờ hẳn (`opacity: 0`, vẫn đọc được bằng trình đọc màn hình) để không lộ dòng chữ ở khe 8px phía trên tấm.
- **Escape** thu tấm nháp trước, lần nữa mới đóng trợ lý.
- **Impression** (`impressions`) chỉ được ghi khi tấm nháp đang mở và món thật sự hiện trên màn hình; thẻ đóng thì không ghi.
- Popup ở góc dưới phải rộng 720px, cao 840px (to gấp 1,5 lần bản cũ 480×560, chủ dự án yêu cầu 2026-11-08), vẫn không vượt quá cửa sổ: rộng tối đa `100vw − 32px`, cao tối đa `100dvh − header − 32px`. Tấm nháp trong popup vì thế đủ chỗ hơn; nội dung dài vẫn cuộn được.

## Thiết kế và thao tác

Đã đọc trực tiếp Figma frame [ANGI / Roadmap / 18 Trợ lý AI (`137:712`)](https://www.figma.com/design/lxEl7PJc0LdQ8j47KlUPkO/ANGI?node-id=137-712), đặc biệt panel `140:1230`: nền trắng, header ANGI / Trợ lý ăn uống, nút Đóng, nhắc kiểm tra nội dung AI, ba gợi ý đầu cuộc trò chuyện và khung nhập ở dưới cùng. Giữ font DM Sans/Fraunces và token hiện có của màn roadmap.

- Nút sidebar mở panel lớn phủ header, sidebar và sổ tay; bong bóng trên bản đồ (nút tròn 52px cùng gradient san hô sang tím với nút sidebar, biểu tượng `SparklesIcon` trắng, tên "Mở trợ lý món ăn"; từ 2026-11-04 nằm sát trên dòng ghi công Mapbox vì khối danh sách điểm đã bỏ) mở popup nhỏ ở góc dưới phải. Màu gradient khai báo một lần ở `.roadmap-detail` (`--agent-gradient`, `--agent-gradient-round`). Nút trên header chuyển qua lại giữa hai dạng. Bản đồ vẫn được giữ nguyên component và sử dụng được. Panel mở bằng cách mờ dần và trượt lên (240 ms); đóng ngắn hơn và tăng tốc (160 ms, `--ease-exit`) để không lơ lửng ở cuối. Màn dưới 901px luôn dùng panel toàn chiều rộng. `prefers-reduced-motion` tắt chuyển động.
- Đây là panel không chặn bản đồ. Nội dung bị panel lớn che không nhận focus, popup thì để trang phía sau dùng được; khi mở, focus vào ô nhập; Escape hoặc Đóng trả focus về nút đã mở. Popup xác nhận dùng `ConfirmDialog`, biểu mẫu ràng buộc dùng `Dialog`; không dùng browser alert/confirm/prompt.
- Ba gợi ý đầu cuộc trò chuyện gửi luôn thành tin nhắn khi bấm. Địa danh và mức giá trong gợi ý lấy từ `conversation.state`, thiếu thì không tự đoán.
- Enter gửi, Shift + Enter xuống dòng, không gửi giữa phiên gõ IME. Nội dung bắt buộc có chữ và dài tối đa 4.000 ký tự. Tin nhắn hiển thị bằng văn bản, không chèn HTML từ AI.
- Không áp dụng câu “mỗi bữa tối đa 2 món” từ bản thiết kế vì hợp đồng Agent không đặt giới hạn đó; thẻ bản nháp ghi rõ bản nháp chưa lưu.

## Bốn API

| Mã       | Phương thức / đường dẫn BE                       | FE xử lý                                                                                                                                                                                     |
| -------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGENT-01 | `POST /api/v1/agent/conversations`               | Gửi `{ roadmapId }` khi mở lần đầu; giữ status 201. Không tạo hội thoại khi chỉ vào trang roadmap.                                                                                           |
| AGENT-02 | `POST /api/v1/agent/conversations/{id}/messages` | Gửi ID số dương duy nhất, `expectedConversationVersion`, nội dung, command và lựa chọn item/ràng buộc khi có. Giữ nguyên status 200 hoặc 202 của BE.                                         |
| AGENT-03 | `GET /api/v1/agent/conversations/{id}`           | Khôi phục lịch sử/state/proposal, đọc lại sau mỗi lượt; polling khi đang xử lý.                                                                                                              |
| AGENT-04 | `POST /api/v1/agent/conversations/{id}/confirm`  | Nút **Thêm vào lịch trình** của tấm nháp gọi (từ 2026-11-08) qua `useAgentConversation.confirm`, gửi `proposalId`, `proposalVersion`. Lưu bằng câu chat vẫn đi qua AGENT-02 và trả `commit`. |

`agent-service.ts` dùng `shared/api/client.ts`; trình duyệt không nhận token BE hoặc khóa AI. `agent-proxy.ts` chỉ cho đúng bốn operation, kiểm tra ID trong đường dẫn; Route Handler kiểm tra Origin và chỉ cho Traveler. Các lệnh Agent có thời gian chờ tối đa 65 giây; các API cũ giữ mặc định 10 giây. Proxy giữ `Retry-After`, validation/error data và status 200/202 thực tế.

Chỉ lưu ID hội thoại trong `sessionStorage`, tách theo ID người dùng và ID roadmap. Không lưu transcript, proposal, GPS hoặc token vào browser storage. Đóng/mở chat dùng lại hội thoại hiện có; tải lại trang khôi phục qua GET. Hội thoại hết hạn/đóng có nút mở hội thoại mới, không xóa roadmap đã lưu.

## Chờ kết quả và tránh ghi nhầm

- Mỗi lượt mới dùng `clientMessageId` dạng số nguyên dương an toàn với JavaScript. Thử lại sau lỗi giữ nguyên ID, nội dung, version và lựa chọn của đúng lượt cũ; việc sửa ô nhập không làm đổi payload đang thử lại.
- HTTP 202 chỉ chuyển sang GET polling mỗi 2 giây, không POST lại tin. Đóng panel hoặc ẩn tab tạm ngưng polling; mở lại lấy state mới. Dừng tự kiểm tra sau 90 giây hoặc ba lỗi đọc liên tiếp; người dùng có thể bấm Kiểm tra hội thoại. Không tự gửi tin mới khi còn lượt xử lý.
- `replayed=true` chỉ dùng GET để lấy bản hiện hành, không ghi đè giao diện bằng proposal cũ trong kết quả replay. Xung đột version hiển thị lỗi và tải state mới, không tự gửi lại mutation.
- Bản nháp hiển thị item của ngày đang chọn theo bữa/thứ tự, giá và tên món/quán từ BE, tổng tiền, lỗi, cảnh báo và số liệu tuyến; phân biệt tuyến ước tính và origin bị bỏ. Quãng đường hiện ở từng chặng giữa các món (`routes[].legs`), không còn dòng tổng cả ngày. Không vẽ tuyến hoặc gọi thêm API Mapbox nào để tạo preview.
- Khi người dùng nhắc tới vị trí của mình (“gần tôi”, “quanh đây”, “vị trí hiện tại”) ở bất kỳ lúc nào, FE xin vị trí từ trình duyệt rồi gửi trong `confirmedState`. Trình duyệt không trả vị trí thì nêu đúng lý do (chặn quyền, dịch vụ vị trí tắt, quá lâu, không phải HTTPS) và không gửi tin cần tới model.
- Mỗi lộ trình chỉ có một hội thoại nên giao diện không có tên hội thoại hay nút tạo hội thoại mới. Đổi món, bỏ nháp và làm lại đều nhắn trong chat; “bỏ bản nháp” và “làm lại từ đầu” được backend nhận trực tiếp, không qua model.
- Trong lúc chờ, nút gửi thành nút dừng `■`. Bấm dừng hủy request; proxy chuyển việc hủy tới backend bằng `request.signal`, backend hủy lượt đang chạy, đánh dấu thất bại và không lưu gì. FE đọc lại hội thoại rồi trả chữ về ô nhập; lượt đã kịp xong trước khi dừng thì giữ nguyên. Lượt đã trả 202 không còn request để hủy nên nút chỉ báo đang xử lý.
- Câu trả lời mới hiện dần từng từ ở phía FE, thẻ bản nháp hiện sau đó; bấm dừng lúc này hiện ngay phần còn lại. Đây không phải streaming từ model: backend chỉ trả câu trả lời sau khi đã kiểm tra.
- Form ràng buộc cho phép xác nhận tỉnh, số ngày, tên, ngân sách và giá mỗi món. Không giới hạn ngân sách phải được chọn rõ trên UI. `confirmedState` giữ nguyên tag, tag loại trừ, origin và phạm vi đang có; không tự nới chúng theo câu trả lời AI.
- Backend quyết định việc lưu qua chat (`AgentSavePolicy`): chỉ lưu proposal ready, không còn câu hỏi mở; “ok” chỉ có hiệu lực với đúng phiên bản vừa được hỏi. Lưu thất bại không có thông báo thành công. Kết quả chưa rõ thử lại đúng lượt tin nhắn cũ (cùng `clientMessageId`).
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

### Kiểm tra ngày 2026-11-03: trả lời một lần, điểm trên bản đồ và ngày đi khi lưu

Không gọi AI hay Mapbox thật; test bản đồ dùng token giả và style cục bộ.

| Kiểm tra                                                          | Kết quả                                                                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest toàn bộ                                                    | 41 file / 347 test đạt, gồm `tests/agent-map.test.ts`.                                                                                                      |
| TypeScript, ESLint phần thay đổi                                  | Đạt.                                                                                                                                                        |
| `playwright.agent.config.ts`                                      | 27/27 đạt.                                                                                                                                                  |
| `playwright.roadmap-map.config.ts` (`ANGI_TEST_MAPBOX_OFFLINE=1`) | 6 đạt, 1 lỗi: `a local style error…` mong "Chưa tải được bản đồ" trong khi code hiện báo lỗi 401 là "từ chối khóa truy cập"; phần này không đổi trong task. |
| `roadmap-detail.spec.ts`, `roadmap-add-item.spec.ts`              | 37 đạt, 6 bỏ qua (test GL, token rỗng), 3 lỗi ở hộp thoại thêm món và liên kết danh sách lộ trình; các file đó không đổi trong task.                        |

Đã mở lại `ANGI_API_Design_Ver1.8.xlsx` trong `ANGIBackEnd/.docs` và tìm trên cả 11 sheet: `AgentItem` có `itemKey`, `latitude`, `longitude`; `AgentChange` có `type`, `targetItemKey`, `item`; `AgentTurn` có `reply`, `proposal`. Dòng "Agent output action" ở sheet `Enum` và sheet `Agent Scoped v2` đã được cập nhật cùng thay đổi của BE (`chat`, `out_of_scope`, `suggestedDish`); đây là đầu ra nội bộ của model. Hợp đồng API chỉ thêm `startDate` tùy chọn vào request AGENT-04: ghi ở `Backend API` r122 và `Chi tiết Request-Response` r577 (ghi trong ô mô tả, không chèn hàng mới để giữ số hàng; JSON mẫu r4198-r4201 giữ nguyên vì trường này tùy chọn). Trường `commit` của `AgentTurn` đã có trong DTO của BE. Workbook sau cập nhật có SHA-256 `9237860c8caeac658f7c3f80de434f806490dda6be520b131d6966bc998263af`.

### Luồng chat và câu hỏi trước khi lập lịch (2026-11-03)

Tham khảo Wanderlog về cách bố trí và thao tác: chat đặt cạnh bản đồ đang mở, địa điểm được nhắc tới hiện trên bản đồ, thêm vào lịch bằng một thao tác. ANGI đã có sẵn các phần này, nên thay đổi tập trung vào thao tác trong khung chat. Nguồn công khai không mô tả đủ chi tiết giao diện của Wanderlog, nên phần còn lại là quyết định của ANGI, không phải sao chép.

- Bấm gửi là ô nhập trống ngay và tin nhắn hiện trong khung chat, không chờ phản hồi.
- Lỗi hiện như một tin nhắn của ANGI, không còn nút **Kiểm tra hội thoại** hay **Gửi lại tin nhắn**. Khi backend đã trả lời lỗi, lượt đó đã kết thúc: nội dung trở lại ô nhập, FE tự đọc lại hội thoại để lấy version mới, người dùng chỉ cần gửi lại. Chỉ khi chưa rõ kết quả (mất mạng, 502) mới có nút **Thử lại**; nút này dùng lại đúng `clientMessageId` với version mới nên không xử lý hai lần.
- BE hỏi lần lượt địa điểm, số ngày và ngân sách, rồi khẩu vị/yêu cầu (`state.planningIntake`). FE chọn nút trả lời nhanh theo giá trị này, không so sánh câu chữ: **Dùng vị trí hiện tại** và **Không, lập lịch luôn**.
- Vị trí chỉ được hỏi khi người dùng bấm nút hoặc gõ “vị trí hiện tại”, và chỉ gửi trong `confirmedState` của lượt đó, không lưu vào browser storage và không gọi Mapbox. Trình duyệt từ chối thì báo cách nhập tên tỉnh; câu đã gõ vẫn được gửi để BE trả lời.
