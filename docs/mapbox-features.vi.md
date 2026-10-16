# Bản đồ, tìm quán và chỉ đường trong ANGI

Ngày thay đổi: 16/10/2026. Đây là hướng dẫn sử dụng và các bước để chủ dự án tự kiểm thử. Giao diện bản đồ chưa được kiểm thử trình duyệt hoặc gọi thử Mapbox theo yêu cầu. Lần sửa CI sau đó đã chạy qua TypeScript và production build trong bản sao không có token Mapbox/file env riêng tư; xem [báo cáo kiểm tra](verification.md). Không đọc lại token, mở bản đồ, gọi thử API Mapbox hay thay đổi file env trong quá trình thực hiện.

## Mở ở đâu

- Chủ nhà hàng: mở bản đồ trong `/restaurant/register` hoặc `/restaurant/profile`; có thể dùng màn demo hiện có.
- Traveler/Guest: nút **Mở bản đồ tương tác** tại danh sách quán/món, chi tiết quán, quán phục vụ món và khung bản đồ của lịch ăn.
- Roll Dish: hiện nút bản đồ khi dữ liệu hiện tại có món đang phục vụ khớp tên món mẫu và có quan hệ `restaurantId` với quán. Không tự gán một quán bất kỳ cho món mẫu.

Các màn discovery, lịch ăn và Roll Dish vẫn theo trạng thái tích hợp hiện tại của dự án; dữ liệu demo vẫn là dữ liệu minh họa. Bản đồ không bổ sung API recommendation hoặc discovery backend chưa được nối.

## Ba cách tìm địa điểm

Thanh tìm kiếm trong modal chọn vị trí/khám phá dùng ô nhập thông thường, không có danh sách gợi ý tỉnh/thành. Kết quả địa điểm chỉ được tìm khi bấm tìm/Enter. Các ô tỉnh/thành và phường/xã trong form địa chỉ vẫn dùng API gợi ý như trước.

Modal chọn vị trí của Owner (đăng ký và sửa hồ sơ, cả live/demo) chỉ có thanh tìm kiếm dùng **POI mở rộng**. Các nút chọn chế độ và hàng danh mục đã bỏ theo yêu cầu. Tìm khi bấm nút/Enter; không tự gọi Mapbox khi gõ. Ba lựa chọn bên dưới áp dụng cho bản đồ khám phá và các picker khác.

| Lựa chọn                   | Cách hoạt động                                                                                                                              | Khi nào phát sinh yêu cầu tìm kiếm Mapbox |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Vùng bản đồ** (mặc định) | Lọc tên/địa chỉ của các quán ANGI được truyền vào và POI trong vector tiles đã tải ở vùng đang xem; hỗ trợ tên không dấu, tối đa 50 kết quả | Không gọi Search Box/Geocoding            |
| **POI mở rộng**            | Tìm tên bằng Search Box `/forward`; các nút danh mục dùng `/category/{id}`, ưu tiên gần tâm bản đồ và giới hạn Việt Nam                     | Khi bấm tìm/Enter hoặc chọn danh mục      |
| **Địa chỉ**                | Tìm địa chỉ qua Geocoding V6, giữ cấu hình `permanent=true` hiện có                                                                         | Khi bấm tìm/Enter                         |

Danh mục có nhà hàng, cà phê, khách sạn, trạm xăng, ATM, bệnh viện, siêu thị và bãi đỗ xe. Ở chế độ Địa chỉ, bấm danh mục dùng dữ liệu vùng bản đồ; chọn POI mở rộng nếu muốn truy vấn danh mục qua Search Box.

POI trong tiles phụ thuộc mức zoom, khu vực và dữ liệu Mapbox đã tải; không phải danh bạ đầy đủ toàn quốc. Nếu không thấy quán, hãy đến gần khu vực đó, phóng to và bấm tìm lại. Gõ tên không tự tìm; kéo bản đồ không tự chạy lại danh sách. Có thể bấm trực tiếp nhãn POI trên bản đồ để chọn tên/tọa độ mà không gọi thêm Search Box.

Search Box hiện công bố hỗ trợ Mỹ, Canada và châu Âu; tài liệu chưa cam kết Việt Nam. Vì vậy không thể đảm bảo POI mở rộng tìm được mọi quán Việt Nam chỉ vì token đã tải được bản đồ hoặc có cùng gói free. Điện thoại/website chỉ hiển thị khi provider trả về; trạng thái hoạt động không được dùng để đoán quán đang mở theo giờ. Nguồn: [Search Box](https://docs.mapbox.com/api/search/search-box/#supported-geographies), [dữ liệu Streets](https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/#poi_label).

## Chọn quán và xem thông tin

1. Bấm kết quả, nhãn POI hoặc marker để chọn vị trí. Thẻ thông tin hiện tên, địa chỉ/điện thoại/website nếu có, nguồn dữ liệu và tọa độ.
2. Dấu X trên thẻ cạnh ghim và thẻ dưới cùng chỉ ẩn thẻ tương ứng; ghim và tọa độ vẫn giữ nguyên. Bấm ghim để hiện lại.
3. **Đường phố / Vệ tinh** thay lớp nền trong cùng bản đồ, giữ lựa chọn và các lớp quán/tuyến đường.
4. Trong form Owner, bấm **Lưu vị trí** mới đưa lựa chọn về bản nháp. POI chỉ điền tên, địa chỉ đường, điện thoại, website vào các ô còn trống; thông tin đã nhập được giữ lại. Tỉnh/thành, phường/xã tiếp tục dùng Provinces Open API V2, không lấy cấu trúc quận/huyện cũ từ Mapbox.
5. Gửi đăng ký/lưu hồ sơ vẫn qua validation và các API OWN-01/OWN-03 hiện có. Đóng modal hoặc chọn điểm không tự ghi vào backend. Chế độ khám phá chỉ có nút Đóng.

Quán ANGI dùng tọa độ và tên có sẵn; không cần geocode lại từng quán. Các POI tìm được từ Mapbox không tự trở thành nhà hàng ANGI hoặc kết quả recommendation.

Hồ sơ trả về tọa độ `null` được hiển thị là chưa có vị trí; có thể mở modal để chọn lại. Chỉnh các thông tin khác không tự gửi tọa độ rỗng hoặc thay bằng `(0, 0)`.

## Chỉ đường

1. Chọn điểm đến rồi bấm **Chỉ đường** trên thẻ dưới cùng.
2. Điểm xuất phát có thể lấy từ vị trí hiện tại, tìm theo tên hoặc nhập `vĩ độ, kinh độ` và bấm nút tìm của ô đó. Tìm theo tên ưu tiên quán/POI đã có; nếu không có mới gửi một yêu cầu Search Box theo thao tác này.
3. Với kết quả theo tên, bấm chọn một địa điểm. Có thể đổi điểm đến và đổi hai điểm cho nhau.
4. Chọn **Ô tô / Xe đạp / Đi bộ**, rồi bấm **Tìm đường**. Đổi phương tiện/điểm sẽ xóa tuyến cũ; không tự tính lại.
5. Nếu có kết quả, xem thời gian dự kiến, khoảng cách và các bước bằng tiếng Việt. Chọn tuyến thay thế sử dụng dữ liệu đã nhận; không gọi lại Directions.
6. Đóng chỉ đường để quay về tìm/chọn địa điểm. Chỉ đường không thay lịch ăn hay tự lưu một vị trí mới vào hồ sơ nhà hàng.

Phần này dùng [Mapbox Directions V5](https://docs.mapbox.com/api/navigation/directions/) với `driving`, `cycling`, `walking`; xe đạp không phải xe máy. Số tuyến thay thế phụ thuộc kết quả trả về. Đây là xem lộ trình, chưa triển khai dẫn đường GPS liên tục hay giọng nói.

## Usage và lưu dữ liệu

Chỉ mở bản đồ khi người dùng mở modal/bấm nút. Khung lịch ăn không còn tự tải Static Images. Tìm trong dữ liệu đã tải, xem lại kết quả, đóng thẻ, đổi tuyến thay thế và đặt marker ANGI không tạo yêu cầu tìm kiếm/chỉ đường. Mở bản đồ, kéo/zoom hoặc đổi lớp nền vẫn có thể tải style/tiles/glyphs và phát sinh usage bản đồ theo cách tính của Mapbox; đây không phải cơ chế bảo đảm usage bằng 0.

Không có autocomplete gọi Mapbox theo từng ký tự, tự retry hoặc tự chuyển sang API khác khi Mapbox trả kết quả rỗng/lỗi. Request đang chạy bị hủy/bỏ qua khi sửa đầu vào hoặc đóng modal; hủy ở client không đảm bảo provider chưa tính lượt đã gửi. Không tải dữ liệu POI hàng loạt, không ghi toàn bộ response vào localStorage/sessionStorage. Gói free, hạn mức từng sản phẩm và quyền truy cập do tài khoản Mapbox quyết định.

Dữ liệu Search Box mặc định dùng tạm thời; triển khai lưu lâu dài tọa độ/thông tin lấy từ Search Box cần quyền tương ứng từ Mapbox. Bấm xác nhận của người dùng không thay thế quyền này. Geocoding địa chỉ giữ `permanent=true` và cần tài khoản hỗ trợ. Xem [điều kiện Search Box](https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits) và [Geocoding](https://docs.mapbox.com/api/search/geocoding/).

## Các bước tự kiểm thử tiết kiệm lượt gọi

1. Khởi động FE với env bạn đã cấu hình. Vào danh sách/lịch ăn trước, xác nhận chưa mở modal thì không có request Static Images/map mới từ khung này.
2. Mở bản đồ một lần, dùng Vùng bản đồ và tên quán hoặc danh mục. Trong Network, phân biệt request tiles với `search/searchbox`, `search/geocode` và `directions`.
3. Chọn một quán ANGI, kiểm tra tên và tọa độ khớp dữ liệu; bấm X từng thẻ rồi hiện lại bằng ghim. Kiểm tra kéo/zoom không đổi tọa độ đang chọn.
4. Nếu muốn thử dịch vụ tìm kiếm, chỉ gửi một từ khóa trong POI mở rộng/Địa chỉ; kiểm tra chỉ một request tương ứng. Kết quả rỗng phải có thông báo và vẫn cho chấm/nhập tọa độ.
5. Dùng tọa độ hoặc vị trí hiện tại cho điểm xuất phát, tính một tuyến đến quán. Kiểm tra tuyến/thời gian/khoảng cách/các bước; chuyển tuyến thay thế không gửi lại Directions.
6. Thử Owner với ô trống và ô đã có dữ liệu: lựa chọn chỉ điền ô trống, chưa gửi OWN-01/OWN-03 trước khi bấm gửi form. Kiểm tra tỉnh/phường vẫn độc lập.
7. Kiểm tra trên màn hình nhỏ và bàn phím: danh sách/chỉ đường cuộn được, các nút đóng/tìm/lưu dùng được, Escape đóng modal. Khi mất mạng hoặc dịch vụ báo lỗi, bản nháp không bị mất và còn cách nhập tọa độ.

Đây là các bước dành cho bạn thực hiện, không phải kết quả kiểm thử đã chạy.
