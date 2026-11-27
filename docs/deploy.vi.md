# Deploy frontend (self-hosted, Docker Compose)

Production chạy trên một server Linux bằng Docker Compose, chung project `angi` với backend, recommendation và Postgres. Trang này ghi những gì frontend cần: Dockerfile, biến môi trường, reverse proxy và cách cập nhật. Phần backend xem `angi-backend/docs/deploy.md`, phần reco xem `angi-reco/docs/deploy.md`.

## Kiến trúc

```
Trình duyệt ─HTTPS─▶ Cloudflare ─Tunnel─▶ cloudflared (systemd trên host)
            ─▶ Caddy (reverse proxy, cổng 80 là cổng duy nhất publish ra host)
            ─▶ angi-frontend:3000 (Next.js: UI + BFF /api/backend/*, /api/auth/*)
            ─▶ angi-backend:8080/api/v1 ─▶ angi-postgres, angi-reco
```

- Chỉ frontend được đưa ra internet. Backend, reco, Postgres không có tên miền và không publish cổng; trình duyệt gọi backend qua `/api` của Next.js.
- Container `angi-frontend` nằm trong hai mạng: `angi_default` để gọi `angi-backend` bằng tên dịch vụ, và `homeserver_default` (mạng của Caddy) để Caddy gọi được frontend.
- Không có CD. GitHub Actions chỉ chạy CI; cập nhật server là thao tác tay (mục "Cập nhật").

## Dockerfile

Repo không có Dockerfile; file nằm ngoài repo, ở `~/angi/frontend.Dockerfile` trên server:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE_URL=/api \
    NEXT_PUBLIC_DATA_MODE=live \
    NEXT_PUBLIC_ENABLE_DEMO=false \
    NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY=false \
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next ./.next
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
```

## Service trong `compose.yaml`

```yaml
services:
  angi-frontend:
    build:
      context: ./angi-frontend
      dockerfile: ../frontend.Dockerfile
      args:
        NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: ${NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
    image: angi-frontend:local
    restart: unless-stopped
    env_file: frontend.env
    depends_on:
      - angi-backend
    networks: [default, homeserver]

networks:
  homeserver:
    external: true
    name: homeserver_default
```

## Biến môi trường

### Lúc build (`~/angi/.env`, truyền qua `build.args`)

| Biến                                   | Giá trị             | Ghi chú                                                                                   |
| -------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`      | Token public `pk.*` | Nếu token có URL restrictions thì thêm domain public                                      |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`         | Client ID Google    | Khớp `Google__ClientId` của backend; thêm domain public vào Authorized JavaScript origins |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`              | Cố định trong Dockerfile                                                                  |
| `NEXT_PUBLIC_DATA_MODE`                | `live`              | Cố định trong Dockerfile                                                                  |
| `NEXT_PUBLIC_ENABLE_DEMO`              | `false`             | Cố định trong Dockerfile; `/demo` dùng dữ liệu mẫu, chỉ bật khi bằng đúng `true`          |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | `false`             | Cố định trong Dockerfile                                                                  |

`NEXT_PUBLIC_*` được gắn vào bản build: đổi xong phải build lại image (`docker compose build angi-frontend`), khởi động lại container là chưa đủ.

### Lúc chạy (`~/angi/frontend.env`)

| Biến                | Giá trị                                                                        | Ghi chú                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`      | `http://angi-backend:8080/api/v1`                                              | Chỉ server dùng; gọi backend bằng tên dịch vụ trong mạng Docker                                                                   |
| `APP_URL`           | URL public, ví dụ `https://<domain>`                                           | Phải khớp origin trình duyệt (request ghi dữ liệu kiểm `Origin`); thiếu thì link chuyển hướng có thể trỏ về `http://0.0.0.0:3000` |
| `SESSION_PASSWORD`  | Chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -hex 32`)                           | Mã hóa cookie phiên; đổi giá trị là mọi người bị đăng xuất                                                                        |
| `BACKEND_PROXY_KEY` | Chuỗi ngẫu nhiên ≥ 32 ký tự, **giống** `TrustedClientIp__ProxyKey` của backend | Xem "IP thật của người dùng"                                                                                                      |

File env chứa secret: quyền `600`, không đưa lên git. Đổi `frontend.env` thì chạy `docker compose up -d --force-recreate angi-frontend`.

## Reverse proxy (Caddy) và Cloudflare Tunnel

Khối trong Caddyfile của reverse proxy chung:

```caddyfile
http://<domain> {
    reverse_proxy angi-frontend:3000 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
    }
}
```

- Dùng `http://`: TLS kết thúc tại Cloudflare.
- Hai dòng `header_up` **ghi đè** `X-Forwarded-For` và `X-Real-IP` bằng IP người dùng mà Cloudflare đưa trong `CF-Connecting-IP`. Trình duyệt không tự đặt được giá trị này, nên frontend tin được phần tử đầu của `x-forwarded-for`.
- Sau khi sửa: `docker exec <container-caddy> caddy reload --config /etc/caddy/Caddyfile`.

Trong cấu hình `cloudflared`, hostname public trỏ tới `http://localhost:80` (cổng của Caddy), đặt trước dòng `- service: http_status:404`.

## Cập nhật

Thứ tự phát hành khi nhiều service cùng đổi: reco → backend → frontend.

```bash
cd ~/angi
git -C angi-frontend pull
docker compose build angi-frontend         # build từng service một: server 8 GB RAM
docker compose up -d --force-recreate angi-frontend
docker compose ps angi-frontend            # IMAGE phải là angi-frontend:local, không phải sha256:…
```

Nếu cột IMAGE hiện `sha256:…` thì image mới đã build nhưng container vẫn chạy image cũ: chạy lại `up -d --force-recreate`.

Trước khi pull, xem có biến môi trường mới không:

```bash
git -C angi-frontend diff <commit-đang-chạy> origin/main | grep -o 'process\.env\.[A-Z_]*' | sort -u
```

Kiểm tra sau khi chạy:

```bash
docker compose exec angi-frontend wget -qO- -S http://127.0.0.1:3000 2>&1 | head -3   # HTTP/1.1 200 OK
docker compose exec angi-frontend wget -qO- http://angi-backend:8080/health           # backend trả Healthy
docker compose logs --tail=50 angi-frontend
```

Trong container, `localhost` phân giải ra IPv6 nên dùng `127.0.0.1`.

## Nhiều instance và phiên đăng nhập

Server chạy **một** container frontend. Code vẫn chịu được nhiều instance (mỗi instance có bộ nhớ riêng) nếu sau này scale:

- `src/features/auth/session-registry.ts` giữ cặp token mới nhất **trong một instance**. Khi đọc phiên, `newerAuth` so cặp trong bộ nhớ với cặp trong cookie và lấy cặp có access token hết hạn muộn hơn, nên instance giữ bản cũ không ghi đè bản mới mà instance khác đã lưu vào cookie.
- Hai request cùng refresh một refresh token (access token 15 phút hết hạn đúng lúc có 2 request song song) được backend xử lý: token vừa xoay vòng dưới 30 giây được cấp phiên song song thay vì bị coi là đánh cắp (AUTH-06).
- Đăng xuất: cookie bị xóa và backend thu hồi refresh token; danh sách phiên đã đăng xuất trong bộ nhớ chỉ chặn thêm ở instance đã xử lý đăng xuất. Access token cũ còn hiệu lực tối đa 15 phút như trước.

## IP thật của người dùng

Mọi request tới backend đi từ server Next.js, nên backend thấy IP của container frontend. `backend()` trong `src/features/auth/server.ts` gửi kèm:

- `X-Angi-Client-Ip`: IP trình duyệt, lấy từ phần tử đầu của `x-forwarded-for` (Caddy ghi đè header này bằng `CF-Connecting-IP`), không có thì `x-real-ip` (`src/features/auth/client-ip.ts`). Giá trị không phải IP bị bỏ.
- `X-Angi-Proxy-Key`: `BACKEND_PROXY_KEY`.

Backend chỉ dùng IP này khi khóa khớp, để rate limit khách vãng lai và giới hạn đăng nhập sai tính theo từng người. Không đặt `BACKEND_PROXY_KEY` thì không gửi gì (local, test). Chỉ đặt khóa khi frontend chạy sau proxy ghi đè `x-forwarded-for` như khối Caddy ở trên; nếu proxy chỉ nối thêm vào header thì người dùng có thể tự chọn IP.

## Header bảo mật

`next.config.ts` gửi trên mọi trang và route API:

| Header                      | Giá trị                                                                          | Mục đích                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` | Không cho trang khác nhúng ANGI (clickjacking), chặn chèn `<base>` / plugin, form chỉ gửi về ANGI |
| `X-Frame-Options`           | `DENY`                                                                           | Như `frame-ancestors`, cho trình duyệt cũ                                                         |
| `X-Content-Type-Options`    | `nosniff`                                                                        |                                                                                                   |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                |                                                                                                   |
| `Permissions-Policy`        | `geolocation=(self), camera=(), microphone=(), payment=()`                       | GPS vẫn dùng được cho lập lộ trình và bản đồ                                                      |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`                                            | Chỉ có tác dụng qua HTTPS (do Cloudflare phục vụ)                                                 |

CSP chưa giới hạn `script-src` / `connect-src` / `img-src`: Next.js chèn script inline, Google sign-in và Mapbox (worker `blob:`, tile, ảnh Cloudinary) cần nhiều nguồn. Siết các mục đó cần nonce cho script và một lượt kiểm tra riêng trên bản build.

## Sự cố thường gặp

| Triệu chứng                                                         | Nguyên nhân                                                             | Cách xử lý                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Trình duyệt bị chuyển tới `http://0.0.0.0:3000/...` (Mixed Content) | Thiếu `APP_URL`; route handler dựng URL từ địa chỉ nội bộ của container | Khai báo `APP_URL` trong `frontend.env`, recreate container                 |
| Build lại xong web vẫn chạy code cũ                                 | Image mới nhưng container cũ                                            | `docker compose up -d --force-recreate angi-frontend`                       |
| Bản đồ không hiện sau khi đổi token                                 | `NEXT_PUBLIC_*` được gắn lúc build                                      | Build lại image rồi recreate                                                |
| Đăng nhập Google báo origin không hợp lệ                            | Domain chưa có trong Authorized JavaScript origins                      | Thêm `https://<domain>` (không có `/` cuối); Google cần vài phút để áp dụng |
| Cloudflare Error 1033                                               | Tunnel tạm mất kết nối hoặc CNAME trỏ sai tunnel                        | Chờ vài phút, kiểm tra `systemctl is-active cloudflared` và bản ghi DNS     |
