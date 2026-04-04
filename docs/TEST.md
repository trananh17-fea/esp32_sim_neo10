# SOS GPS Tracker — Test Plan & Acceptance

## Build & Upload

```bash
# Build firmware
pio run -e nodemcu-32s3-dev

# Upload firmware
pio run -e nodemcu-32s3-dev -t upload

# Upload LittleFS (for AssistNow cache)
pio run -e nodemcu-32s3-dev -t uploadfs

# Monitor serial output
pio device monitor -b 115200
```

---

## 1. Portal Tests (http://setup.device)

### 1.1 Connect & Open
1. Connect phone/laptop to WiFi AP `TV_DEVICE` (password: `123456788`)
2. Open browser → `http://setup.device`
3. **EXPECT**: Dark-themed config page with status dashboard, phone inputs, geofence, signal warning, AssistNow sections

### 1.2 Save Config
1. Enter phone numbers: CALL_1 = `+84xxxxxxxxx`, CALL_2 = `+84yyyyyyyyy`
2. Set SMS template, ring seconds = 30
3. Click **💾 Luu cau hinh**
4. **EXPECT**: Toast "Da luu!"
5. Reboot device → reconnect → open portal → fields should be pre-filled from NVS

### 1.3 Set Home
1. Wait for GPS fix (GPS status shows "FIX ✓")
2. Click **📍 Set Home tu GPS**
3. **EXPECT**: Toast "Da luu vi tri Home!"
4. Home Lat/Lng fields should update

### 1.4 Distance Updates
1. After setting Home, observe "Khoang cach Home" status card
2. **EXPECT**: Updates every 3 seconds with distance in meters

### 1.5 Test SMS
1. Click **✉️ Gui SMS thu**
2. **EXPECT**: Toast "Dang gui SMS..."
3. Check serial monitor for `[SIM7680C] SMS -> ...`
4. Check phone for received test SMS with GPS link

### 1.6 GET /config endpoint
```bash
curl http://192.168.4.1/config
```
**EXPECT**: JSON with all config fields + live status (gps_ready, signal_4g, signal_wifi)

---

## 2. AssistNow Tests

### 2.1 Download with WiFi
1. Ensure STA is connected to router (check serial log for `[WIFI] STA OK`)
2. Reboot device
3. **EXPECT** in serial:
   ```
   [ASSIST] Connecting to u-blox...
   [ASSIST] Downloaded XXX bytes
   [ASSIST] UBX sync bytes OK
   [ASSIST] Injected XXX bytes into GPS
   ```

### 2.2 Cached (no re-download)
1. Reboot again within 24h
2. **EXPECT**: `[ASSIST] Cache is fresh (Xs old)` → `[ASSIST] Using cached data`

### 2.3 Offline Inject
1. Disconnect router / disable STA
2. Reboot device
3. **EXPECT**: `[ASSIST] No WiFi, trying cached file...` → `[ASSIST] Offline inject OK`

### 2.4 Invalid File
1. (Advanced) Corrupt `/assistnow.ubx` on LittleFS
2. **EXPECT**: `[ASSIST] Invalid file (no UBX sync), deleting`

---

## 3. Signal Warning Tests

### 3.1 Enable Signal Warning
1. In portal, check "Bat canh bao", set cooldown = 1 min, save
2. Monitor serial for `[SIGNAL] Monitor task started`

### 3.2 Simulate Signal Drop
- **Option A**: Move device to area with weak signal
- **Option B**: Wrap device in foil to block 4G signal
3. **EXPECT** in serial:
   ```
   [SIGNAL] Rapid drop detected: X -> Y
   [SIGNAL] TRIGGER! Level=Y, sending warning
   [SIGNAL] Warning SMS sent
   ```
4. Check phone for SMS: "Canh bao sap mat song! Vi tri: https://..."

### 3.3 Cooldown
1. After trigger, signal stays low
2. **EXPECT**: No second SMS within cooldown period
3. After cooldown expires, if signal is still low: another warning

### 3.4 Cross-Reboot Spam Prevention
1. Trigger warning, reboot device immediately
2. **EXPECT**: `[SIGNAL] Restored last warn timestamp` in serial
3. Should not immediately re-trigger (best-effort)

---

## 4. SOS Tests (Multi-SMS + Call Cascade)

### 4.1 Double-Click SOS (No Buzzer)
1. Double-click the button (2 presses within 400ms)
2. **EXPECT** in serial:
   ```
   [Button] Double Click -> SMS + CALL (no buzzer)
   [SOS] === EMERGENCY TRIGGERED ===
   [SOS] SMS #1 -> +84...
   [SOS] SMS #2 -> +84...
   [SOS] Starting call cascade...
   [CALL] Cascade step 1: CALL_1 -> +84...
   [CALL] Dialing +84... for 30s...
   ```
3. Check all configured numbers received SMS
4. CALL_1 should ring

### 4.2 Call Cascade (No Answer)
1. Don't answer CALL_1
2. After RING_SECONDS timeout:
   ```
   [CALL] Ring timeout
   [CALL] Cascade step 2: CALL_2 -> +84...
   ```
3. If CALL_2 is empty, skipped:
   ```
   [CALL] CALL_2 empty, skip
   ```

### 4.3 Call Answered
1. Answer the call when it rings
2. **EXPECT**:
   ```
   [CALL] ANSWERED!
   [CALL] CALL_1 answered, cascade done
   ```

### 4.4 Long Press SOS (With Buzzer)
1. Hold button 1-3 seconds
2. **EXPECT**: Buzzer starts SOS pattern + SMS + calls
3. Hold button >3 seconds → buzzer stops

### 4.5 Concurrency Protection
1. Trigger SOS while tracking is running
2. **EXPECT**: Tracking pauses (skips HTTP POST during SOS)
3. After SOS completes, tracking resumes

---

## 5. LED State Tests

### 5.1 No GPS Fix
- **EXPECT**: Solid RED

### 5.2 GPS Fix + Network
- **EXPECT**: Solid GREEN

### 5.3 GPS Fix, No Network
- **EXPECT**: Solid YELLOW

### 5.4 Portal Client Connected
1. Connect phone to AP
- **EXPECT**: BLUE blink

### 5.5 SOS Active
1. Trigger SOS
- **EXPECT**: Fast RED blink (toggles every 250ms)

---

## 6. WiFi AP Stability

### 6.1 AP Always Available
1. AP `TV_DEVICE` should be visible at all times
2. Even if STA connection fails, AP must work
3. Portal at `http://setup.device` must always be accessible

### 6.2 AP+STA Mode
1. If STA connects to router successfully
2. **EXPECT**: Both AP and STA work simultaneously (WIFI_MODE_APSTA)
3. Serial: `[WIFI] AP OK` + `[WIFI] STA OK`

---

## Architecture Notes

### Signal Level Strategy
- **4G CSQ mapping** (0-31 → 0-10): documented in `SIM7680C.cpp`
- **WiFi RSSI mapping** (-100..-40 dBm → 0-10): documented in `SignalMonitor.cpp`
- **Combined**: Prefer 4G when modem is ready (primary comms channel), fall back to WiFi

### Files Changed

| File | Change |
|------|--------|
| `lib/Config/Config.h` | Expanded with all NVS config fields |
| `lib/Config/Config.cpp` | All new global variable definitions |
| `src/server.h` | `PHONE_NUMBER` → `DEFAULT_PHONE`, added include guard |
| `src/main.h` | Removed dead sms include, added SignalMonitor |
| `src/main.cpp` | Added signalMonitorTask, numbered init sequence |
| `src/Storage/Storage.h` | New `saveAllConfig()` |
| `src/Storage/Storage.cpp` | Load/save all config fields |
| `src/WiFiManager/WiFiManager.h` | Simplified |
| `src/WiFiManager/WiFiManager.cpp` | Single WiFi.mode(APSTA), no duplicates |
| `src/DATAEG/SIM7680C.h` | Removed stubs, added CSQ/callCascade/sendSMS_to |
| `src/DATAEG/SIM7680C.cpp` | Full rewrite: CSQ, call cascade, concurrency |
| `src/GPS/gps.h` | Removed dead stubs, fixed includes |
| `src/GPS/gps.cpp` | No direct LED calls, offline AssistNow |
| `src/assistnow/assistnow.h` | Documentation |
| `src/assistnow/assistnow.cpp` | LittleFS, 24h cache, UBX validation |
| `src/button/button.h` | Cleaned (removed SmsData/smsQueue/smsTask) |
| `src/button/button.cpp` | SOS task: multi-SMS + call cascade |
| `src/buzzer/buzzer.cpp` | Added `buzzerActive` definition |
| `src/geofencing/geofencing.h` | Uses Config.h globals |
| `src/geofencing/geofencing.cpp` | No duplicate HOME_LAT/LNG |
| `src/strip/strip.h` | Comments about single-task LED |
| `src/strip/strip.cpp` | LED state machine with priorities |
| `src/tracking/tracking.h` | Simplified |
| `src/tracking/tracking.cpp` | setInsecure(), SOS guard, 10s interval |
| `src/signal/SignalMonitor.h` | **NEW** — signal monitoring declarations |
| `src/signal/SignalMonitor.cpp` | **NEW** — full implementation |
| `src/webserver/webserver.h` | Simplified |
| `src/webserver/webserver.cpp` | Full portal rebuild with all config |
| `src/sms/` | **DELETED** — dead code |
| `platformio.ini` | Confirmed littlefs, cleaned |
| `docs/TEST.md` | **NEW** — this file |

### Dead Code Removed
- `src/sms/sms.h + sms.cpp` — empty stub `sent_sms()`, never called
- `SIM7680C_mqttSend()` — declared, never implemented
- `readAll()` — declared, never implemented
- `waitOK()` — declared, never implemented
- `injectToGPS()` / `extractBinary()` — declared in gps.h, never implemented
- `smsQueue` / `smsTask()` / `SmsData` — declared in button.h, never used
- `char GPS[100]` in Config.cpp — unused

### Key Fixes
- **WiFi mode conflict resolved**: Only `WiFiManager.cpp` calls `WiFi.mode(APSTA)`. Webserver no longer changes WiFi mode.
- **SPIFFS → LittleFS**: AssistNow now uses LittleFS matching `platformio.ini`
- **LED conflicts resolved**: Only `ledTask` controls LED via state machine. GPS task no longer calls `setColor()`.
- **HTTPS stability**: Tracking uses `WiFiClientSecure::setInsecure()` for demo.
