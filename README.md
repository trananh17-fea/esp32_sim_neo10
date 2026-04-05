# Dự án SOS GPS Tracker - ESP32-S3

Tài liệu này mô tả chi tiết kiến trúc và luồng hoạt động (workflow) của toàn bộ dự án định vị vị trí và cảnh báo khẩn cấp dựa trên nền tảng **ESP32-S3**, kết hợp mô-đun 4G LTE (**SIM7680C**), module **GPS**, dải LED NeoPixel và còi báo động. Dự án hoạt động theo cơ chế đa nhiệm sử dụng **FreeRTOS**.

---

## 1. Tổng quan Kiến trúc

Dự án được chia thành các phân hệ chính (module/subsystem) chịu trách nhiệm riêng biệt:
- **`Storage`**: Quản lý bộ nhớ Flash (LittleFS) để lưu trữ cấu hình (số điện thoại, tọa độ Home, thông tin WiFi, v.v.).
- **`WiFiManager` & `webserver`**: Cung cấp giao diện Web Portal (Captive Portal) để người dùng cài đặt và tùy chỉnh thiết bị mà không cần code lại.
- **`GPS` & `geofencing` & `assistnow`**: Đọc/xử lý dữ liệu định vị từ module GPS (qua TinyGPSPlus), đo khoảng cách đến vị trí nhà (Geofence) và sử dụng chức năng A-GPS (AssistNow) để bắt vệ tinh nhanh hơn.
- **`SIM7680C` & `signal`**: Quản lý giao tiếp AT Command với module SIM 4G, thực hiện việc gửi SMS, gọi điện, truy cập HTTP(s), và liên tục theo dõi cường độ sóng mạng (CSQ/dBM).
- **`tracking`**: Đóng gói dữ liệu vị trí và trạng thái, gửi lên Server trung tâm qua HTTP POST.
- **`button` & `buzzer` & `strip`**: Xử lý đầu vào từ vi điều khiển (nút cứng SOS), đầu ra (nháy chuỗi LED NeoPixel, hú còi cảnh báo).

---

## 2. Luồng Khởi động (Boot Sequence)
Luồng khởi động được đặt trong hàm `setup()` (`main.cpp`):
1. **Khởi tạo Serial & Mutex**: Cho phép xuất log Serial an toàn khi chạy đa luồng.
2. **Khởi tạo Bộ nhớ (`initStorage`)**: Đọc file config (JSON hoặc nvs/LittleFS file) trên Flash nạp vào RAM.
3. **Hardware Init (`buzzer_init`, `initStrip`)**: Thiết lập Output cho còi và hệ thống hiệu ứng LED báo hiệu.
4. **Kết nối mạng (`initWiFi`)**: Cố gắng kết nối vào điểm truy cập WiFi đã ghi nhớ trước đó.
5. **Dựng Web Portal (`initFriendlyNamePortal`)**: Bật giao diện cấu hình qua WiFi trực tiếp cục bộ.
6. **Khởi tạo Tracking/Geofencing**: Tạo cấu trúc lưu các mốc tọa độ và config thông số post dữ liệu.
7. **Phân luồng Task**: Hệ thống sẽ tạo và phân chia tài nguyên CPU ra để chạy các luồng song song thông qua FreeRTOS `xTaskCreatePinnedToCore`.

---

## 3. Các tiến trình chạy nền (FreeRTOS Tasks)
Do dự án sử dụng RTOS, sau tiến trình khởi động, thiết bị sẽ hoạt động độc lập trên các task sau:

- **`gpsTask`**: Liên tục đọc dữ liệu NMEA thông qua Serial của bộ thu GPS, bóc tách ra các thông số (Lat, Lng, Độ cao, Vận tốc, Số lượng vệ tinh, chất lượng tín hiệu HDOP).
- **`simInit`**: Task tồn tại trong giai đoạn đầu để kích hoạt mô-đun SIM7680C, đăng ký nhà mạng, mở kết nối Internet (PDP Context), cấu hình TCP/UDP/HTTP. 
- **`sigMon` (Signal Monitor)**: Giám sát chạy ẩn định kỳ đo lường mức tín hiệu WiFi và cường độ SIM mạng CSQ/dBm.
- **`ledTask`**: Cập nhật hiệu ứng cho LED strip tương đương với trạng thái thực hiện các luồng mạng hoặc định vị.
- **`monTask`**: Module in Debug Log định kỳ xuống màn hình console (khoảng cách nhà, fix gps, internet status).
- **`btnTask`**: Tiến trình vòng lặp đọc trạng thái nút bấm khẩn cấp để nhận diện các thao tác nhấp-thả kích hoạt luồng SOS.
- **`Tracking_Loop()`**: Nút vòng `loop()` cơ sở, thực hiện POST tọa độ thiết bị định kỳ lên server. 

---

## 4. Luồng Hoạt động Cảnh báo khẩn cấp (SOS Workflow)
Logic xử lý được quản lý tại file `src/button/button.cpp`. Khi người dùng ấn nút, tiến trình hoạt động như sau:

1. **Phân tích thao tác bấm:**
   - **Bấm đúp (Double-click)**: Khởi chạy SOS ngầm (gửi SMS + Call), còi báo âm thanh (buzzer) **không kêu**.
   - **Bấm giữ (Hold 1 - 3 giây)**: Khởi chạy luồng SOS toàn diện (nhắn tin + điện thoại) VÀ còi báo (buzzer) **hú âm thanh cảnh báo SOS dài chuẩn**.
   - **Bấm giữ lâu (Hold > 3 giây)**: Rút hoặc Hủy bỏ SOS / Tắt còi đang phát, đưa hệ thống về bình thường.

2. **Kích hoạt trình SOS (`sosTask`)**:
   - Hệ thống đặt cờ `SOS_ACTIVE = true` (tạm dừng gửi tọa độ định kỳ HTTP dư thừa nhằm dành toàn bộ CPU cho sóng viễn thông khẩn).
   - Thiết bị đóng gói nội dung SMS bằng cách lấy kinh/vĩ độ chuyển thành Google MAP link cùng một Website xem vị trí trực tiếp.
   - **Phát tán SMS tuần tự (SMS Fanout)**: Theo danh sách số (CALL_1, CALL_2, CALL_3 và HOTLINE), thiết bị truyền AT Command nhắn nội dung khẩn cấp qua SIM.
   - **Cuộc gọi Cascade**: Thiết bị tạo cuộc gọi thoại đến số ưu tiên CALL_1. Nếu không được phản hồi trong T gian quy định hoặc dập máy -> Xoay sang gọi tuần tự CALL_2, CALL_3, HOTLINE cho tới khi có người bắt máy báo hiệu nghe xong. 

---

## 5. Luồng Báo Cáo Tracking (Tracking Workflow)
Được quản lý trong `src/tracking/tracking.cpp`. Chức năng này cập nhật dữ liệu lên máy chủ theo nhịp thích ứng để giảm quota request khi triển khai nhiều thiết bị: khoảng 10 phút/lần khi đang di chuyển, 30 phút/lần khi đứng yên, và chỉ tăng nhịp khi thiết bị đã di chuyển đủ xa.

1. **Kiểm tra trạng thái hệ thống**: Nếu SOS đang kích hoạt, hủy vòng lặp gửi để bảo toàn kết nối viễn thông.
2. **Đóng gói Payload JSON**: Gói chứa: ID (`TRACKER_KV`), Kinh độ, Vĩ độ, Bật/tắt Geofencing, Khoảng cách Home, Trạng thái trong hay ngoài vòng an toàn.
3. **Thanh toán gói tin tải (HTTP POST)**:
   - **Cơ chế 1: WiFi**: Thử nghiệm thư viện chuẩn `HTTPClient` qua kết nối WiFi bảo mật. Nếu OK -> Xong.
   - **Cơ chế 2: 4G SIM**: Nếu kết nối mạng qua WiFi ngắt, lệnh rẽ nhánh điều khiển SIM7680C mở phiên TCP/IP truyền giao thức HTTP gửi lượng JSON này đi.

---

## 6. Tính năng mở rộng: Hàng rào địa lý (Geofencing)
Thiết bị cho phép lưu trữ một tọa độ cắm mốc `HOME` (VD: Địa chỉ nhà trẻ, khuôn viên công ty). 
Modul `geofencing` sử dụng định luật chéo (Haversine Formula) cập nhật khoảng cách vật lý thực tế từ thiết bị đến tọa độ HOME này liên tục. 
Dựa vào bán kính quy định (VD: 50m), phần mềm nhúng sẽ check và gửi một flag Boolean (`insideGeofence`) lên Server. Server có thể dựa vào flag này gửi Push Notification ngay về đt của chủ thiết bị nếu người thân vô tình mang thiết bị đi xa quá giới hạn an toàn.
