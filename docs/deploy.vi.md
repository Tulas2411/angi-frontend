# Deploy frontend (Vercel)

Frontend chạy trên Vercel, gọi backend (Render) từ server Next.js. Trang này ghi các biến môi trường bắt buộc trên production và những gì code đã làm để chạy được nhiều instance. Phần backend: README của `angi-backend`, mục "Deploy (Render)".

## Biến môi trường trên Vercel

| Biến                                   | Giá trị                                                                        | Ghi chú                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `API_BASE_URL`                         | `https://<backend trên Render>/api/v1`                                         | Chỉ server dùng                                                                          |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`                                                                         |                                                                                          |
| `APP_URL`                              | URL Vercel, ví dụ `https://angi.vercel.app`                                    | Phải khớp origin trình duyệt: request ghi dữ liệu kiểm `Origin`                          |
| `SESSION_PASSWORD`                     | Chuỗi ngẫu nhiên ≥ 32 ký tự                                                    | Mã hóa cookie phiên; đổi giá trị là mọi người bị đăng xuất                               |
| `BACKEND_PROXY_KEY`                    | Chuỗi ngẫu nhiên ≥ 32 ký tự, **giống** `TrustedClientIp__ProxyKey` của backend | Xem "IP thật của người dùng"                                                             |
| `NEXT_PUBLIC_ENABLE_DEMO`              | Không đặt (hoặc `false`)                                                       | `/demo` dùng dữ liệu mẫu; chỉ bật khi bằng đúng `true`                                   |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | Không đặt                                                                      |                                                                                          |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`      | Token public `pk.*`                                                            | Giới hạn theo domain Vercel                                                              |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`         | Client ID Google                                                               | Khớp `Google:ClientId` của backend; thêm domain Vercel vào Authorized JavaScript origins |

`NEXT_PUBLIC_*` được gắn vào bản build: đổi xong phải deploy lại.

## Nhiều instance và phiên đăng nhập

Vercel chạy server Next.js thành nhiều instance; bộ nhớ của mỗi instance riêng biệt.

- `src/features/auth/session-registry.ts` giữ cặp token mới nhất **trong một instance**. Khi đọc phiên, `newerAuth` so cặp trong bộ nhớ với cặp trong cookie và lấy cặp có access token hết hạn muộn hơn, nên instance giữ bản cũ không ghi đè bản mới mà instance khác đã lưu vào cookie.
- Hai instance cùng refresh một refresh token (access token 15 phút hết hạn đúng lúc có 2 request song song) được backend xử lý: token vừa xoay vòng dưới 30 giây được cấp phiên song song thay vì bị coi là đánh cắp (AUTH-06).
- Đăng xuất: cookie bị xóa và backend thu hồi refresh token; danh sách phiên đã đăng xuất trong bộ nhớ chỉ chặn thêm ở instance đã xử lý đăng xuất. Access token cũ còn hiệu lực tối đa 15 phút như trước.

## IP thật của người dùng

Mọi request tới backend đi từ server Next.js, nên backend thấy IP của Vercel. `backend()` trong `src/features/auth/server.ts` gửi kèm:

- `X-Angi-Client-Ip`: IP trình duyệt, lấy từ phần tử đầu của `x-forwarded-for` (Vercel ghi lại header này, trình duyệt không tự đặt được), không có thì `x-real-ip` (`src/features/auth/client-ip.ts`). Giá trị không phải IP bị bỏ.
- `X-Angi-Proxy-Key`: `BACKEND_PROXY_KEY`.

Backend chỉ dùng IP này khi khóa khớp, để rate limit khách vãng lai (100 request/phút) và giới hạn đăng nhập sai tính theo từng người. Không đặt `BACKEND_PROXY_KEY` thì không gửi gì (local, test). Chỉ đặt khóa khi frontend chạy sau proxy ghi lại `x-forwarded-for` như Vercel; tự host sau proxy khác thì kiểm tra proxy đó trước.

## Header bảo mật

`next.config.ts` gửi trên mọi trang và route API:

| Header                      | Giá trị                                                                          | Mục đích                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` | Không cho trang khác nhúng ANGI (clickjacking), chặn chèn `<base>` / plugin, form chỉ gửi về ANGI |
| `X-Frame-Options`           | `DENY`                                                                           | Như `frame-ancestors`, cho trình duyệt cũ                                                         |
| `X-Content-Type-Options`    | `nosniff`                                                                        |                                                                                                   |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                |                                                                                                   |
| `Permissions-Policy`        | `geolocation=(self), camera=(), microphone=(), payment=()`                       | GPS vẫn dùng được cho lập lộ trình và bản đồ                                                      |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`                                            | Chỉ có tác dụng qua HTTPS                                                                         |

CSP chưa giới hạn `script-src` / `connect-src` / `img-src`: Next.js chèn script inline, Google sign-in và Mapbox (worker `blob:`, tile, ảnh Cloudinary) cần nhiều nguồn. Siết các mục đó cần nonce cho script và một lượt kiểm tra riêng trên bản build.
