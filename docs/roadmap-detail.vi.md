# F-21 Xem chi tiết lộ trình (ANGI-115)

Màn `/roadmaps/{roadmapId}` (chỉ `TRAVELER`) gọi thật RM-03 `GET /api/v1/roadmaps/{roadmapId}` để lấy Overview, Itinerary, Budget và RM-14 `GET /api/v1/roadmaps/{roadmapId}/days/{dayId}/route` để lấy các chặng của từng ngày. Mã nguồn nằm trong `src/features/roadmaps/` (`roadmap-detail-page.tsx` tải dữ liệu, `roadmap-detail-view.tsx` bố cục và tab, `roadmap-itinerary.tsx`, `roadmap-budget.tsx`, `roadmap-detail-map.tsx`, `roadmap-map-rules.ts`, `roadmap-detail-rules.ts`, `roadmap-detail.css`, `roadmap-service.ts`); trang ở `src/app/(protected)/(app)/roadmaps/[roadmapId]/page.tsx`. Màn demo cũ `pages.tsx` (`/demo/traveler/roadmaps/*`) không bị sửa.

## Hành vi

- **Bố cục** đối chiếu trực tiếp qua Figma MCP với khung ["ANGI / Roadmap" (`24:1383`, 1713 × 3679)](https://www.figma.com/design/lxEl7PJc0LdQ8j47KlUPkO/ANGI?node-id=24-1383), trùng ảnh `Roadmap.png` người dùng cung cấp:
  - Desktop trên 900px có ba cột: sidebar trái, sổ tay lộ trình ở giữa, bản đồ bên phải. Theo tỷ lệ frame: sidebar 200px, hai cột còn lại chia 1,16:1; sidebar thu còn 160px dưới 1200px. Thanh đầu trang nằm trên hai cột bên trái, bản đồ bắt đầu từ mép trên và cao bằng viewport. CSS chỉ mở rộng shell của trang có `.roadmap-detail-page`.
  - Sidebar và bản đồ giữ vị trí khi cuộn nội dung dài. Cột trái có ba phần và "Lịch ăn uống" liệt kê từng ngày (`T6 25/9`) kèm tên các món; bấm ngày mở tab Lịch trình và cuộn tới.
  - Dưới 901px: danh sách ngày chuyển thành dải cuộn ngang, bản đồ nằm trên nội dung; chọn món ở cột nội dung đưa thẻ địa điểm vào tầm nhìn, chọn ghim không tự cuộn xuống phần món ăn.
  - Thẻ đầu trang: tên lộ trình, khoảng ngày, số ngày, số món (và nhãn "Vượt ngân sách" khi chi phí dự kiến lớn hơn ngân sách) nằm trong thẻ trắng riêng, ảnh bìa ở bên phải. Thẻ món cũng tách phần chữ và ảnh như thiết kế.
  - Ba tab dạng viên **Tổng quan | Lịch trình | Ngân sách** (đúng ba phần của `RoadmapDetail`); tab nằm trong URL (`?tab=overview|budget`; Lịch trình là mặc định nên không có tham số).
- **Tổng quan (RM-03 `overview`):** thời gian, số ngày, số món, điểm xuất phát, ngân sách, chi phí dự kiến, ngày tạo và cập nhật.
- **Lịch trình (RM-03 `itinerary` + RM-14):**
  - Mỗi ngày là một mục gập được, tên theo ngày thật (`Thứ Sáu, 25 tháng 9`; không có ngày bắt đầu thì `Ngày N`). Mục đóng hiện tên các món của ngày; mục mở hiện `Ngày N · số món · chi phí`. Các ngày mở độc lập; ngày mở gần nhất nằm trong URL (`?day=2`). `day` hoặc `tab` hỏng thì dùng ngày 1 và tab Lịch trình.
  - Trong ngày, món được gom theo bữa (Bữa sáng, Bữa trưa, Bữa tối, Ăn vặt, Ăn khuya) theo thứ tự backend trả về. Mỗi món: tên, "Dự chi" (giá hiện tại), quán (quận, tỉnh, điểm đánh giá), ảnh. Món có `status` khác `active` hiện "Món đã ngừng bán" (theo ghi chú của RM-03); `isAvailable = false` hiện "Tạm hết món". `source = ai` hiện "ANGI gợi ý"; `myFeedback` hiện đã thích / không thích.
  - Cuối ngày: "Tổng dự chi hôm nay" (`dayCost`).
  - **RM-14 chỉ được gọi cho ngày đang mở khi tab Lịch trình đang hiển thị**, mỗi cặp (ngày, điểm xuất phát) tối đa một lần: đóng rồi mở lại ngày, hay đổi tab rồi quay lại, đều không gọi lại. Ngày không có đủ điểm (không món, hoặc một món mà không có điểm xuất phát) không gọi. Việc này giảm lượt gọi Mapbox Directions ở backend.
  - Chặng hiện trước mỗi món như "Connection 1 → 2" của Figma, dạng viên: `2,35 km · Khoảng 9 phút` kèm `Khách sạn Sala Đà Nẵng → Bún bò Huế` (điểm xuất phát gọi theo tên điểm đã chấm, hoặc "Điểm xuất phát"). Đầu ngày có tổng "Cả ngày: 7,9 km · 27 phút".
  - `isEstimated = true`: nhãn "Ước tính" và giải thích. `originSkipped = true`: báo điểm xuất phát cách quán đầu hơn 30 km nên chặng đầu không được tính. Ngày dưới hai điểm: "Chưa đủ điểm để tính quãng đường."
  - Lỗi RM-14 chỉ hiện trong ngày đó (kèm "Thử lại"), danh sách món vẫn đọc được.
  - **Lộ trình `gps`:** backend không lưu vị trí, nên lúc đầu chặng chỉ tính giữa các quán. Bấm "Tính từ vị trí hiện tại" thì trình duyệt hỏi quyền; được phép thì gửi `originLat` và `originLng` cùng nhau cho mỗi lần gọi RM-14. Tọa độ chỉ nằm trong bộ nhớ trang, không lưu. "Bỏ vị trí hiện tại" quay về cách tính cũ (dùng lại kết quả đã có). Bị từ chối, trang không an toàn, thiết bị không có vị trí hoặc quá thời gian: có hướng dẫn riêng.
  - **Nút "Mở trên Google Maps" mỗi ngày do FE tự tạo** (không qua backend): `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=a|b&travelmode=driving`, theo thứ tự món. Điểm đã chấm (`pinned`) là `origin`; `none` và `gps` không có `origin` (Google Maps tự lấy vị trí). Món không có tọa độ bị bỏ qua. Google Maps nhận tối đa 10 điểm, nên ngày có nhiều hơn chỉ lấy 10 quán đầu và có ghi chú. Nút mở tab mới với `noopener noreferrer`.
- **Ngân sách (RM-03 `budget`):** tiêu đề "Ngân sách ăn uống", số tiền lớn là chi phí dự kiến, hai viên "Ngân sách …" và "Còn lại …" (ẩn khi vượt), thanh tiến độ (đã dùng %), cảnh báo vượt, chi phí theo ngày và theo bữa. Tính theo giá hiện tại của món. Chưa đặt ngân sách thì nói rõ và chỉ hiện tổng chi phí.
- Ngân sách cũng xuất hiện cuối tab Lịch trình như frame Figma; chỉ có một bản nội dung trong DOM tại một thời điểm.
- **Bản đồ Mapbox:** ghim đánh số theo thứ tự món của từng ngày, màu theo ngày. Tất cả tọa độ lấy từ RM-03; mục trùng tọa độ được nhóm, không dịch chuyển tọa độ giả. Bấm ảnh món, ghim hoặc danh sách điểm để chọn; món ở giữa và ghim tương ứng được đánh dấu. Thẻ trắng trên bản đồ có thông tin, điểm đánh giá trung bình và ảnh món lấy đúng dữ liệu đang có. Đóng thẻ giữ nguyên các ghim.
- Điểm xuất phát trên bản đồ dùng kết quả RM-14 đã được cache trong phần lịch trình; GPS hoặc điểm xuất phát bị bỏ qua không làm bản đồ tự dùng lại tọa độ cũ. Việc chọn điểm, đóng thẻ, đổi tab trong thẻ hoặc phóng to/thu nhỏ không gọi thêm RM-14. Lỗi RM-14 được giữ cho tới khi người dùng bấm **Thử lại**.
- Lộ trình chưa có món (hoặc món chưa có tọa độ) vẫn có bản đồ nền khi đã cấu hình token: nhìn tổng thể Việt Nam, hoặc tại điểm xuất phát đã chấm nếu có, kèm ghi chú "Lộ trình chưa có địa điểm để hiển thị." Ghim xuất hiện khi lộ trình có món. Danh sách điểm chỉ hiện khi có điểm; không có token thì panel chỉ hiện ghi chú, không gọi nhà cung cấp.
- Khi Mapbox từ chối khóa (HTTP 401 hoặc 403) panel nêu rõ "Dịch vụ bản đồ từ chối khóa truy cập (lỗi 401)"; khi chạy dev có thêm gợi ý kiểm tra `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Các lỗi khác vẫn hiện thông báo chung, cả hai đều có "Thử lại bản đồ".
- Thiếu token, lỗi tải bản đồ hoặc thiếu tọa độ vẫn đọc được lịch trình và chọn điểm từ danh sách thật. Không dùng ảnh chụp bản đồ Figma làm bản đồ chạy thực tế. Địa điểm thiếu tọa độ không có ghim giả.
- **Trạng thái:** đang tải; không tìm thấy (`ROADMAP_NOT_FOUND`: không tồn tại hoặc không phải của mình, có đường quay lại); lỗi khác (kèm "Thử lại", không dùng dữ liệu mẫu); id sai trong URL hiện trang "Trang này chưa có".
- **Lối vào:** tiêu đề thẻ ở danh sách (F-20, cả thẻ là một liên kết) và nút "Xem chi tiết" ở thẻ kết quả của màn lập lộ trình (F-19).
- **Proxy:** `GET roadmaps/{id}` và `GET roadmaps/{id}/days/{dayId}/route` được thêm cùng `PATCH roadmaps/{id}` vào `src/shared/api/roadmap-proxy.ts` (id là số nguyên dương, các đường dẫn khác vẫn bị từ chối).

## Giới hạn hiện tại

- Chỉ xem. Khung Figma còn Hoàn tác / Làm lại, Chia sẻ, Trợ lý món ăn, "Thêm món", nút thích / không thích, gợi ý quán, "Hỏi AI" và giờ cụ thể của bữa. Các phần này không có thao tác tương ứng trong RM-03 / RM-14 (hoặc thuộc task sau: RM-05..13), nên chưa làm và không có nút giả. Phương thức di chuyển giữ mặc định `driving`; RM-14 hỗ trợ thêm `walking` và `cycling` nhưng task này chưa yêu cầu.
- RM-14 không trả geometry/polyline. Bản đồ hiển thị các điểm dừng thật, không vẽ đường theo phố giả và không gọi Mapbox Directions lần thứ hai. Thẻ địa điểm không bịa địa chỉ đường, giờ mở cửa, số lượt đánh giá hoặc ảnh nhà hàng: hai API hiện tại chỉ có tên/quận/tỉnh/tọa độ/điểm trung bình của quán và ảnh món. RM-12 thuộc tích hợp khác.
- Chặng ghi "Khoảng N phút" mà không nói loại xe, vì RM-14 mặc định `driving` của Mapbox (Figma ghi "đi xe máy").
- Mục "Lộ trình của tôi" trên thanh điều hướng chưa được tô đậm khi đang ở trang chi tiết (chỉ khớp đúng `/roadmaps`).
- Task Jira ghi DoD "chạy với mock data, chuyển sang API thật khi BE merge". Quy tắc dự án cấm màn mới dùng mock, và RM-03 / RM-14 đã có ở backend, nên màn gọi API thật ngay.
- Backend gọi Mapbox Directions cho mỗi lần RM-14 (có cache 24 giờ trong bộ nhớ). Khi bạn thử với backend thật, mỗi ngày mở có từ hai điểm trở lên sẽ tính vào lượt dùng Mapbox của backend.

## Kiểm tra trước khi chỉnh bố cục ba cột (2026-10-24)

| Kiểm tra                                                                       | Kết quả                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`, `npx tsc --noEmit`, `npm run build`                            | Đạt; route `ƒ /roadmaps/[roadmapId]`                                                                                                                                                                                                                 |
| `npm test`                                                                     | Có `tests/roadmap-detail.test.ts` (17 test: tab và ngày trong URL, tiêu đề ngày, gom bữa, định dạng, link Google Maps, điều kiện gọi RM-14, ngân sách, allowlist proxy)                                                                              |
| `tests/browser/roadmap-detail.spec.ts` (bản build production cô lập, API stub) | 15 test: quyền truy cập, theo JSON mẫu, ba tab, Google Maps, ngày gập và số lần gọi RM-14, cột ngày bên trái, deep link, `gps` được phép / bị chặn, lỗi và thử lại, vượt ngân sách, không tìm thấy, thẻ danh sách mở chi tiết, tràn ngang 320–1440px |
| Mapbox                                                                         | Không có request nào: backend được stub, token rỗng                                                                                                                                                                                                  |
| Backend thật (`test:live`)                                                     | Chưa chạy                                                                                                                                                                                                                                            |

## Đối chiếu API Design

Đối chiếu trước khi code và mở lại sau khi code: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sửa lần cuối 2026-10-24 15:48, nội dung trích lại sau khi code giống hệt bản đầu task).

- Sheet "Tổng quan": ghi chú "Vị trí và lộ trình" và "Endpoint mới RM-14".
- Sheet "Backend API": RM-03 (r33), RM-14 (r44).
- Sheet "Chi tiết Request-Response": RM-03 (r125), RM-14 (r185–r200).
- Sheet "JSON mẫu": RM-03 (r896–), RM-14 (r1388–r1411).
- Sheet "DTO": RoadmapSummary, RoadmapDish, RoadmapItem, RoadmapDay, RoadmapDetail, DishCard, RestaurantMini, Tag.
- Sheet "Mã lỗi": `ROADMAP_NOT_FOUND`, `DAY_NOT_FOUND`, `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`.
- Sheet "Enum": `mealSlot`, `dishes.status`, `roadmap_items.source`, `roadmaps.originMode`, route profile.

Đối chiếu code backend: `RoadmapsController` (`GetDetail`, `GetDayRoute`), `RoadmapDtos.cs` và `RoadmapRouteDtos.cs` (tên trường, nullable, kiểu), `GetRoadmapDayRouteRequestDto` + validator (`originLat` / `originLng` phải đi cùng nhau, `profile` mặc định `driving`), `GetRoadmapDayRouteUseCase` (chọn điểm xuất phát: GPS gửi kèm rồi đến điểm đã chấm; bỏ chặng đầu khi cách quá 30 km; `ROADMAP_NOT_FOUND` / `DAY_NOT_FOUND`) và `RoadmapRepository.GetOwnedRouteDataAsync` (chỉ roadmap của người gọi, thứ tự món theo bữa rồi `sortOrder`). Method, đường dẫn, tên tham số query, tên và kiểu trường, enum, mã lỗi đều khớp.

## Kiểm tra sau khi chỉnh theo Figma (2026-10-24)

| Kiểm tra                                 | Kết quả                                                                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit test toàn dự án                     | 24 file / 173 test đạt; gồm 17 test quy tắc chi tiết lộ trình và 6 test xử lý điểm trên bản đồ.                                                                                                                       |
| Browser trên bản build production cô lập | 20 test đạt; 5 test GL được tách sang cấu hình bên dưới. Kiểm tra quyền truy cập, URL/tab/ngày, RM-03/RM-14, GPS, cache, lỗi/thử lại, ngân sách, Google Maps, bố cục ba cột và không tràn ngang.                      |
| Mapbox GL chạy với phản hồi cục bộ       | 5 test đạt: ghim số/màu từng ngày, chọn bằng chuột và bàn phím, đồng bộ thẻ món, đóng thông tin vẫn giữ ghim, món thiếu tọa độ, lỗi style và thử lại.                                                                 |
| Rà giao diện cuối cùng                   | Chạy lại test Figma sau lần tinh chỉnh CSS cuối: 1 test đạt ở 1713, 1440, 768, 390 và 320px. Đã xem ảnh desktop và mobile; sidebar/bản đồ giữ vị trí khi cuộn, thẻ địa điểm và các nút còn sử dụng được trên màn nhỏ. |
| Build / TypeScript / ESLint              | Đạt; bản production cuối có route `ƒ /roadmaps/[roadmapId]`.                                                                                                                                                          |
| Asset và định dạng                       | 45 asset Figma, 7 font và 3 giấy phép được xác minh; Prettier và `git diff --check` đạt. Chevron dùng SVG gốc 17,5 × 14; connector 16 × 64 và biểu tượng di chuyển 20 × 20.                                           |

Hai nhóm browser có tổng cộng **25 test khác nhau đạt**. Test GL dùng token giả và style được trả ngay trong trình duyệt; request ra các dịch vụ ngoài bị chặn. Không gọi Mapbox thật, không kiểm tra token và không chạy RM-14 với backend thật trong đợt chỉnh giao diện này. Vì vậy kết quả trên xác nhận giao diện và cách xử lý hợp đồng API, chưa xác nhận kết nối BE/Mapbox trong môi trường của người dùng.

Đã sửa thêm hai lỗi tìm thấy khi kiểm tra: ghim Mapbox giữ đúng vai trò `button` để dùng bàn phím, và camera cập nhật kích thước/padding khi đổi viewport để không bị tràn bởi thẻ thông tin. RM-14 thất bại chỉ gọi lại khi người dùng bấm thử lại; đổi tab hoặc chọn món khác không tự tiêu tốn thêm lượt gọi.

Ảnh kiểm tra nằm trong thư mục cục bộ `artifacts/roadmap-detail/`: `figma-layout-1713.png`, `desktop-1440.png`, `tablet-768.png`, `mobile-390.png`, `mobile-320.png`, cùng ảnh riêng cột nội dung và thẻ địa điểm. Nền bản đồ trong ảnh kiểm tra là style cục bộ trống để không dùng quota; khi chạy dự án, component vẫn dùng Mapbox streets và dữ liệu tọa độ thật.

Sau khi hoàn tất code và các lần kiểm tra cuối, đã mở lại `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`: **778.879 byte**, sửa lúc **2026-10-24 15:48:52**, SHA-256 `6A886210D9EB540C9479AEFFF34B222B0C11216A6F909B30E4DFABC793A29A86`. Nội dung không đổi so với bản đã đối chiếu đầu đợt sửa. Đã đọc lại các vùng:

- `Backend API`: r33 và r44.
- `Chi tiết Request-Response`: r125, r185–r200.
- `DTO`: r67–r88, r178–r224.
- `JSON mẫu`: r896–r988, r1388–r1411.
- `Mã lỗi`: r10–r30.

RM-03/RM-14 vẫn khớp. Bản đồ không gọi thêm endpoint và không giả lập đường đi vì RM-14 chưa trả geometry. Thay đổi nằm trên nhánh `feat/ANGI-115-view-my-roadmap-detail`, chưa stage, commit hoặc push.
