# Hướng dẫn Deploy Cloudflare Worker (GPS Tracker)

Thư mục này chứa mã nguồn (`worker.js`) cho hệ thống backend xử lý dữ liệu Tracker, được chạy trên nền tảng **Cloudflare Workers**. 

Dưới đây là các bước để bạn có thể tự deploy (triển khai) lên tài khoản Cloudflare của mình.

## Yêu cầu chuẩn bị
1. Cài đặt **Node.js** (khuyến nghị phiên bản 18.x trở lên).
2. Tạo một tài khoản [Cloudflare](https://dash.cloudflare.com/) (miễn phí).
3. Đã có file `wrangler.toml` (nếu chưa có, lệnh deploy sẽ tự tạo).

## Bước 1: Cài đặt thư viện

Mở terminal tại thư mục `cloudflare` này và chạy lệnh:

```bash
npm install
```

Việc này sẽ cài đặt công cụ `wrangler` (CLI chính thức của Cloudflare).

## Bước 2: Đăng nhập vào Cloudflare

Bạn cần cho phép công cụ `wrangler` kết nối với tài khoản Cloudflare của bạn:

```bash
npx wrangler login
```

Trình duyệt sẽ mở ra và yêu cầu bạn cấp quyền. Hãy bấm **Allow** (Cho phép). Khi terminal báo *Successfully logged in* là bạn đã thành công.

## Bước 3: Chuẩn bị KV Database (Lưu trữ dữ liệu)

Worker này sử dụng **Cloudflare KV** để lưu trữ thông tin vị trí cập nhật từ GPS Tracker. 
Bạn hãy chạy lệnh sau để tạo một không gian lưu trữ (Namespace) có tên là `TRACKER_DATA`:

```bash
npx wrangler kv:namespace create "TRACKER_DATA"
```

Sau khi chạy xong, terminal sẽ in ra một đoạn code tương tự như thế này:
```toml
{ binding = "TRACKER_DATA", id = "thu-tu-id-gi-do-cua-bna-123456789" }
```

Hãy mở file `wrangler.toml` lên (tạo mới nếu chưa có) và dán đoạn mã ID đó vào dưới phần `[[kv_namespaces]]`:

```toml
name = "gps-tracker"
main = "worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TRACKER_DATA"
id = "MÃ_ID_CỦA_BẠN_NẰM_Ở_ĐÂY"
```

## Bước 4: Tải mã nguồn lên Cloudflare (Deploy)

Sau khi đã thiết lập xong KV và đảm bảo `wrangler.toml` trỏ đúng vào `worker.js`, hãy chạy lệnh:

```bash
npx wrangler deploy
```

Chờ khoảng 10-20 giây. Nếu thành công, terminal sẽ in ra đường link của ứng dụng, ví dụ:
`https://gps-tracker.<username_cua_ban>.workers.dev`

## Bước 5: Cập nhật Firmware ESP32

Hãy copy đường link API bạn vừa lấy được ở **Bước 4** và dán vào phần cài đặt của ESP32 (thêm hậu tố `/update` cho endpoint tracking), ví dụ:

- URL Tracking: `http://gps-tracker.<username_cua_ban>.workers.dev/update`

> **Lưu ý:** Việc nạp qua SIM module (`SIM7680C.cpp`) sẽ tự động ép hạ cấp về `http://` để tránh lỗi TLS handshake (715), không cần lo lắng về HTTPS trên SIM. Tuy nhiên URL ESP32 kết nối WiFi thì cứ dùng bình thường.

---

### Mẹo: Xem Log trực tiếp của Web Server
Để biết Tracker có gửi tọa độ lên đúng đắn hay không, bạn có thể xem log trực tiếp bằng lệnh:

```bash
npx wrangler tail
```

Cứ mỗi lần thiết bị ESP32 (SIM/WiFi) gọi API, bạn sẽ thấy log in ra màn hình.
