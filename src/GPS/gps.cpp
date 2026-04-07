#include "gps.h"
#include "DATAEG/SIM7680C.h"
#include "assistnow/assistnow.h"
#include "network_location/location.h"
#include <WiFi.h>
#include <cstring>
#include <ctime>

HardwareSerial SerialGPS(1);
TinyGPSPlus gps;

float currentLat = 0.0f;
float currentLng = 0.0f;

static double lastLat = 0;
static double lastLng = 0;

double GPS_getLatitude() { return lastLat; }
double GPS_getLongitude() { return lastLng; }

// ---------------------- UBX CONFIG -------------------------
const uint8_t CFG_NMEA_UART1[] = {
    0xB5, 0x62, 0x06, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0xD0, 0x08,
    0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
const uint8_t CFG_NMEA_GGA_ON[] = {0xB5, 0x62, 0x06, 0x01, 0x08, 0x00,
                                   0xF0, 0x00, 0x01, 0,    0,    0,
                                   0,    0,    0xFA, 0x0F};
const uint8_t CFG_NMEA_RMC_ON[] = {0xB5, 0x62, 0x06, 0x01, 0x08, 0x00,
                                   0xF0, 0x04, 0x01, 0,    0,    0,
                                   0,    0,    0xFE, 0x2B};
const uint8_t CFG_UBX_PVT_OFF[] = {0xB5, 0x62, 0x06, 0x01, 0x08, 0x00,
                                   0x01, 0x07, 0x00, 0,    0,    0,
                                   0,    0,    0x11, 0x4B};
const uint8_t CFG_GNSS_FAST[] = {
    0xB5, 0x62, 0x06, 0x3E, 0x3C, 0x00, 0x00, 0x08, 0x20, 0x00, 0x00,
    0x00, 0x10, 0x04, 0x01, 0x00, 0x01, 0x01, 0x02, 0x00, 0x10, 0x04,
    0x01, 0x00, 0x01, 0x01, 0x01, 0x00, 0x10, 0x04, 0x00, 0x00, 0x01,
    0x01, 0x06, 0x00, 0x10, 0x04, 0x00, 0x00, 0x01, 0x01, 0x03, 0x00,
    0x10, 0x04, 0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00};
const uint8_t CFG_RATE_1HZ[] = {0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xE8,
                                0x03, 0x01, 0x00, 0x01, 0x00, 0x01, 0x39};
const uint8_t CFG_RATE_5HZ[] = {0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xC8,
                                0x00, 0x01, 0x00, 0x01, 0x00, 0xDD, 0x68};
const uint8_t CFG_RESET_HOT[] = {0xB5, 0x62, 0x06, 0x04, 0x04, 0x00,
                                 0x00, 0x00, 0x01, 0x00, 0x0F, 0x38};

static bool gpsTrackingProfileApplied = false;
static unsigned long gpsAcqStartMs = 0;
static uint8_t gpsRecoveryStep = 0;

static void sendUBX(const uint8_t *msg, uint16_t len) {
  for (int i = 0; i < len; i++)
    SerialGPS.write(msg[i]);
}

static void applyGpsAcquisitionProfile() {
  sendUBX(CFG_NMEA_UART1, sizeof(CFG_NMEA_UART1));
  vTaskDelay(pdMS_TO_TICKS(20));
  sendUBX(CFG_UBX_PVT_OFF, sizeof(CFG_UBX_PVT_OFF));
  vTaskDelay(pdMS_TO_TICKS(20));
  sendUBX(CFG_NMEA_GGA_ON, sizeof(CFG_NMEA_GGA_ON));
  sendUBX(CFG_NMEA_RMC_ON, sizeof(CFG_NMEA_RMC_ON));
  vTaskDelay(pdMS_TO_TICKS(20));
  sendUBX(CFG_GNSS_FAST, sizeof(CFG_GNSS_FAST));
  vTaskDelay(pdMS_TO_TICKS(20));
  sendUBX(CFG_RATE_1HZ, sizeof(CFG_RATE_1HZ));
  vTaskDelay(pdMS_TO_TICKS(20));
  logLine("[GPS] Acquisition profile applied (1Hz, fast search)");
}

static void applyGpsTrackingProfile() {
  if (gpsTrackingProfileApplied)
    return;
  sendUBX(CFG_RATE_1HZ, sizeof(CFG_RATE_1HZ));
  vTaskDelay(pdMS_TO_TICKS(20));
  gpsTrackingProfileApplied = true;
  logLine("[GPS] Tracking profile applied (1Hz low-power)");
}

static bool gpsHasRealFix() {
  if (!gps.location.isValid())
    return false;
  if (!isfinite(gps.location.lat()) || !isfinite(gps.location.lng()))
    return false;
  if (gps.location.lat() == 0.0 && gps.location.lng() == 0.0)
    return false;
  return true;
}

// ============================================================
// UBX checksum helper
// ============================================================
static void ubxChecksum(const uint8_t *msg, uint16_t len, uint8_t *ckA,
                        uint8_t *ckB) {
  *ckA = 0;
  *ckB = 0;
  // Checksum covers: class, id, length, and payload (bytes 2..len-1)
  for (int i = 2; i < len; i++) {
    *ckA += msg[i];
    *ckB += *ckA;
  }
}

// ============================================================
// Sniff dump — hex + ASCII of first N bytes (one-time debug)
// ============================================================
static void dumpSniff(const uint8_t *buf, int len) {
  if (len <= 0)
    return;
  int show = (len > 64) ? 64 : len;

  Serial.printf("[GPS] Sniff dump (%d bytes, showing %d):\n", len, show);

  // Hex
  Serial.print("[GPS] HEX: ");
  for (int i = 0; i < show; i++) {
    Serial.printf("%02X ", buf[i]);
    if ((i + 1) % 32 == 0 && i + 1 < show)
      Serial.print("\n[GPS]      ");
  }
  Serial.println();

  // ASCII (printable only)
  Serial.print("[GPS] ASC: ");
  for (int i = 0; i < show; i++) {
    char c = (buf[i] >= 32 && buf[i] < 127) ? (char)buf[i] : '.';
    Serial.print(c);
  }
  Serial.println();
}

// ============================================================
// GPS Autobaud Detection
// ============================================================
static long detectGPSBaud() {
  const long bauds[] = {9600, 38400, 115200};
  const int numBauds = 3;

  uint8_t bestBuf[64];
  int bestLen = 0;

  Serial.println("[GPS] === Autobaud Detection ===");

  for (int b = 0; b < numBauds; b++) {
    Serial.printf("[GPS] Trying %ld baud...\n", bauds[b]);
    SerialGPS.begin(bauds[b], SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    vTaskDelay(pdMS_TO_TICKS(300));

    while (SerialGPS.available())
      SerialGPS.read();
    vTaskDelay(pdMS_TO_TICKS(200));

    uint8_t buf[512];
    int totalBytes = 0;
    unsigned long t0 = millis();

    while (millis() - t0 < 2000 && totalBytes < (int)sizeof(buf)) {
      if (SerialGPS.available()) {
        buf[totalBytes++] = SerialGPS.read();
      }
      vTaskDelay(1);
    }

    Serial.printf("[GPS] Baud %ld: %d bytes read\n", bauds[b], totalBytes);

    if (totalBytes < 10) {
      if (totalBytes > bestLen) {
        bestLen = (totalBytes > 64) ? 64 : totalBytes;
        memcpy(bestBuf, buf, bestLen);
      }
      SerialGPS.end();
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    bool foundNMEA = false;
    for (int i = 0; i < totalBytes - 1; i++) {
      if (buf[i] == '$' && (buf[i + 1] == 'G' || buf[i + 1] == 'P')) {
        foundNMEA = true;
        break;
      }
    }

    bool foundUBX = false;
    if (!foundNMEA) {
      for (int i = 0; i < totalBytes - 1; i++) {
        if (buf[i] == 0xB5 && buf[i + 1] == 0x62) {
          foundUBX = true;
          break;
        }
      }
    }

    if (foundNMEA || foundUBX) {
      Serial.printf("[GPS] ✓ %s detected at %ld baud (%d bytes)\n",
                    foundNMEA ? "NMEA" : "UBX", bauds[b], totalBytes);
      int show = (totalBytes > 80) ? 80 : totalBytes;
      Serial.print("[GPS] Sample: ");
      for (int i = 0; i < show; i++) {
        char c = (buf[i] >= 32 && buf[i] < 127) ? (char)buf[i] : '.';
        Serial.print(c);
      }
      Serial.println();
      return bauds[b];
    }

    if (totalBytes > bestLen) {
      bestLen = (totalBytes > 64) ? 64 : totalBytes;
      memcpy(bestBuf, buf, bestLen);
    }

    SerialGPS.end();
    vTaskDelay(pdMS_TO_TICKS(100));
  }

  Serial.println("[GPS] ✗ Autobaud FAILED. No NMEA/UBX patterns detected.");
  Serial.printf("[GPS] ✗ bytesRead=%d. Check:\n", bestLen);
  Serial.printf("[GPS] ✗  - TX/RX swap (RX=%d TX=%d)\n", GPS_RX_PIN,
                GPS_TX_PIN);
  Serial.println("[GPS] ✗  - GND connected between ESP32 and GPS");
  Serial.println("[GPS] ✗  - GPS module powered (VCC, antenna)");
  Serial.println("[GPS] ✗  - Correct UART pins (not used by SIM)");

  if (bestLen > 0) {
    dumpSniff(bestBuf, bestLen);
  } else {
    Serial.println("[GPS] No bytes received at any baud rate.");
  }

  return -1;
}

// ============================================================
// UBX-MGA-INI-POS-LLH — inject approximate position
// Only injects if lat/lng are non-zero.
// ============================================================
void GPS_injectApproxPosition(double lat, double lng, uint32_t accuracyM) {
  if (lat == 0.0 && lng == 0.0) {
    logLine("[GPS] Skip pos inject: coords are 0,0");
    return;
  }

  // UBX-MGA-INI-POS-LLH: class=0x13, id=0x40, payload=20 bytes
  uint8_t msg[20 + 6 + 2]; // header(6) + payload(20) + checksum(2)
  memset(msg, 0, sizeof(msg));

  msg[0] = 0xB5; // sync1
  msg[1] = 0x62; // sync2
  msg[2] = 0x13; // class MGA
  msg[3] = 0x40; // id INI-POS-LLH
  msg[4] = 20;   // payload length low
  msg[5] = 0;    // payload length high

  // Payload starts at byte 6
  msg[6] = 0x01; // type: LLH

  // Latitude in 1e-7 degrees (signed 32-bit, little-endian)
  int32_t latE7 = (int32_t)(lat * 1e7);
  memcpy(&msg[8], &latE7, 4);

  // Longitude in 1e-7 degrees (signed 32-bit, little-endian)
  int32_t lngE7 = (int32_t)(lng * 1e7);
  memcpy(&msg[12], &lngE7, 4);

  // Altitude = 0 (we don't know it)
  // Already zeroed by memset

  // Position accuracy in cm (uint32_t)
  uint32_t accCm = accuracyM * 100;
  memcpy(&msg[20], &accCm, 4);

  // Compute checksum
  uint8_t ckA, ckB;
  ubxChecksum(msg, 26, &ckA, &ckB);
  msg[26] = ckA;
  msg[27] = ckB;

  sendUBX(msg, 28);
  logPrintf("[GPS] Injected approx pos: lat=%.6f lng=%.6f acc=%um", lat, lng,
            accuracyM);
}

// ============================================================
// UBX-MGA-INI-TIME-UTC — inject approximate time
// Only injects if year >= 2024 (sanity check).
// ============================================================
void GPS_injectApproxTime(int year, int month, int day, int hour, int minute,
                          int second, uint32_t accuracyMs) {
  // Sanity checks
  if (year < 2024 || year > 2099) {
    logPrintf("[GPS] Skip time inject: year=%d invalid", year);
    return;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    logPrintf("[GPS] Skip time inject: date=%d/%d/%d invalid", year, month,
              day);
    return;
  }

  // UBX-MGA-INI-TIME-UTC: class=0x13, id=0x40, payload=24 bytes
  uint8_t msg[24 + 6 + 2]; // header(6) + payload(24) + checksum(2)
  memset(msg, 0, sizeof(msg));

  msg[0] = 0xB5; // sync1
  msg[1] = 0x62; // sync2
  msg[2] = 0x13; // class MGA
  msg[3] = 0x40; // id INI
  msg[4] = 24;   // payload length low
  msg[5] = 0;    // payload length high

  // Payload starts at byte 6
  msg[6] = 0x10; // type: TIME-UTC

  // ref: 0 = none (we're giving approximate time)

  // Accuracy in nanoseconds (uint32_t)
  // accuracyMs in milliseconds → convert to ns
  uint32_t accNs = accuracyMs * 1000000UL;
  if (accuracyMs > 4000)
    accNs = 0xFFFFFFFF; // cap at max
  memcpy(&msg[12], &accNs, 4);

  // Year (uint16_t, little-endian)
  uint16_t y = (uint16_t)year;
  memcpy(&msg[16], &y, 2);

  // Month, day, hour, minute, second
  msg[18] = (uint8_t)month;
  msg[19] = (uint8_t)day;
  msg[20] = (uint8_t)hour;
  msg[21] = (uint8_t)minute;
  msg[22] = (uint8_t)second;

  // Compute checksum
  uint8_t ckA, ckB;
  ubxChecksum(msg, 30, &ckA, &ckB);
  msg[30] = ckA;
  msg[31] = ckB;

  sendUBX(msg, 32);
  logPrintf(
      "[GPS] Injected approx time: %04d-%02d-%02d %02d:%02d:%02d acc=%ums",
      year, month, day, hour, minute, second, accuracyMs);
}

// ============================================================
// Wait for first usable transport (WiFi OR SIM data)
// Returns: 0=timeout, 1=WiFi, 2=SIM
// ============================================================
static int waitForTransport(unsigned long maxWaitMs) {
  unsigned long t0 = millis();
  logPrintf("[GPS] Waiting for transport (max %lums)...", maxWaitMs);

  while (millis() - t0 < maxWaitMs) {
    if (WiFi.status() == WL_CONNECTED) {
      logLine("[GPS] Transport: WiFi ready");
      return 1;
    }
    if (SIM_hasCapability(SIM_CAP_DATA_OK)) {
      logLine("[GPS] Transport: SIM data ready");
      return 2;
    }
    vTaskDelay(pdMS_TO_TICKS(200));
  }

  logLine("[GPS] Transport: timeout, cache-only");
  return 0;
}

// ============================================================
// Try to get time from available sources for injection
// ============================================================
static bool tryInjectTimeFromSources() {
  // Source 1: NTP time (available if WiFi connected and time synced)
  time_t now = time(nullptr);
  if (now > 1704067200UL) { // > 2024-01-01
    struct tm *t = gmtime(&now);
    GPS_injectApproxTime(t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
                         t->tm_hour, t->tm_min, t->tm_sec, 500);
    return true;
  }

  // Source 2: SIM network time (AT+CCLK?)
  if (SIM_hasCapability(SIM_CAP_VOICE_SMS_OK)) {
    int yr, mo, dy, hr, mn, sc;
    if (SIM_getNetworkTime(&yr, &mo, &dy, &hr, &mn, &sc)) {
      GPS_injectApproxTime(yr, mo, dy, hr, mn, sc, 2000);
      return true;
    }
  }

  logLine("[GPS] No valid time source available");
  return false;
}

// ============================================================
// Try to inject approximate position from NVS
// ============================================================
static bool tryInjectPositionFromNVS() {
  double lat = GPS_LAT;
  double lng = GPS_LNG;
  bool usedHomeFallback = false;

  if (lat == 0.0 && lng == 0.0) {
    // Fallback: try HOME coords
    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);
    lat = cfg.homeLat;
    lng = cfg.homeLng;
    usedHomeFallback = (lat != 0.0 || lng != 0.0);
  }

  if (lat == 0.0 && lng == 0.0) {
    logLine("[GPS] No stored position for injection");
    return false;
  }

  // Freshness check: read last fix epoch from NVS
  unsigned long fixEpoch = 0;
  size_t len = sizeof(fixEpoch);
  nvs_get_blob(nvsHandle, "FIX_EPOCH", &fixEpoch, &len);

  time_t now = time(nullptr);
  bool haveRealTime = (now > 1704067200UL);
  bool haveFixEpoch = (fixEpoch > 1704067200UL);

  if (haveRealTime && haveFixEpoch) {
    unsigned long ageSec = (unsigned long)(now - fixEpoch);
    if (ageSec > 48UL * 3600UL) {
      logPrintf("[GPS] Stored pos too old (%luh), skip injection",
                ageSec / 3600);
      return false;
    }
    logPrintf("[GPS] Stored pos age: %luh, injecting", ageSec / 3600);
    // Accuracy scales with age: 1km base + 1km per hour
    uint32_t accM = 1000 + (uint32_t)(ageSec / 3600) * 1000;
    GPS_injectApproxPosition(lat, lng, accM);
  } else {
    // No reliable time — inject with large uncertainty (50km)
    // Still helpful for satellite search almanac
    logLine("[GPS] No time ref for pos age, inject with 50km accuracy");
    GPS_injectApproxPosition(lat, lng, 50000);
  }

  if (usedHomeFallback) {
    logLine(
        "[GPS] HOME fallback injected; will still try better network aiding");
    return false;
  }

  return true;
}

static bool tryInjectPositionFromNetwork() {
  logLine("[GPS] Trying network-based coarse position for faster fix...");
  if (!acquireNetworkLocationNow()) {
    logLine("[GPS] Network location unavailable for GPS aiding");
    return false;
  }

  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  if (!telem.networkLocReady ||
      (telem.networkLocLat == 0.0 && telem.networkLocLng == 0.0)) {
    logLine("[GPS] Network location result invalid");
    return false;
  }

  uint32_t accM = (telem.networkLocAccuracyM > 100.0f)
                      ? (uint32_t)telem.networkLocAccuracyM
                      : 100U;
  if (accM > 100000U)
    accM = 100000U;

  GPS_injectApproxPosition(telem.networkLocLat, telem.networkLocLng, accM);
  logPrintf("[GPS] Network aiding source=%s acc=%um",
            locationSourceName(telem.networkLocSource), accM);
  return true;
}

static void gpsAttemptRecovery(int transport) {
  if (gpsTrackingProfileApplied)
    return;
  const unsigned long elapsedMs = millis() - gpsAcqStartMs;

  if (gpsRecoveryStep == 0 && elapsedMs >= 90000UL) {
    logLine(
        "[GPS] No fix after 90s -> re-injecting time/position and hot reset");
    tryInjectTimeFromSources();
    if (transport != 0)
      tryInjectPositionFromNetwork();
    injectAssistNow(SerialGPS);
    sendUBX(CFG_RESET_HOT, sizeof(CFG_RESET_HOT));
    gpsRecoveryStep = 1;
    return;
  }

  if (gpsRecoveryStep == 1 && elapsedMs >= 240000UL) {
    logLine("[GPS] No fix after 240s -> second aiding cycle and hot reset");
    tryInjectTimeFromSources();
    if (transport != 0)
      tryInjectPositionFromNetwork();
    injectAssistNow(SerialGPS);
    sendUBX(CFG_RESET_HOT, sizeof(CFG_RESET_HOT));
    gpsRecoveryStep = 2;
  }
}

// ============================================================
// Save fix epoch to NVS (called on first fix)
// ============================================================
static void saveFixEpoch() {
  time_t now = time(nullptr);
  if (now > 1704067200UL) {
    unsigned long epoch = (unsigned long)now;
    nvs_set_blob(nvsHandle, "FIX_EPOCH", &epoch, sizeof(epoch));
    nvs_commit(nvsHandle);
  }
}

// ---------------------- GPS TASK ---------------------------
void gpsTask(void *pvParameters) {
  logLine("[GPS] Init NEO-M10...");
  gpsTrackingProfileApplied = false;
  gpsRecoveryStep = 0;
  gpsAcqStartMs = millis();

  // 0) Autobaud detection
  long baud = detectGPSBaud();
  if (baud < 0) {
    baud = 38400;
    SerialGPS.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    logPrintf("[GPS] Fallback to %ld baud (may not work)", baud);
  }

  vTaskDelay(pdMS_TO_TICKS(500));

  // 1) Inject approximate position from last known fix/home, if available.
  bool positionInjected = tryInjectPositionFromNVS();

  // 2) Inject approximate time — first attempt (optimistic)
  //    At cold boot, NTP likely hasn't synced and SIM may not be ready.
  //    We try now in case time is available, then retry after transport.
  bool timeInjected = tryInjectTimeFromSources();

  // 3) Wait for first usable transport (max 10s)
  int transport = waitForTransport(10000);

  // 4) Retry time injection if first attempt failed
  //    After transport wait, NTP may have synced (WiFi) or SIM is registered.
  if (!timeInjected) {
    logLine("[GPS] Retrying time injection after transport ready...");
    timeInjected = tryInjectTimeFromSources();
  }

  // 5) If we still do not have a recent coarse position, obtain one from the
  // network now and inject it before AssistNow + sky search continue.
  if (!positionInjected && transport != 0) {
    positionInjected = tryInjectPositionFromNetwork();
  }

  // 6) Download + inject AssistNow
  {
    bool downloaded = false;

    if (transport == 1) {
      // WiFi available
      downloaded = downloadAssistNow();
    } else if (transport == 2) {
      // SIM data available, try WiFi first anyway (might have connected)
      if (WiFi.status() == WL_CONNECTED) {
        downloaded = downloadAssistNow();
      }
      if (!downloaded) {
        downloaded = downloadAssistNowViaSIM();
      }
    } else {
      // Timeout — try whatever is available now
      if (WiFi.status() == WL_CONNECTED) {
        downloaded = downloadAssistNow();
      } else if (SIM_hasCapability(SIM_CAP_DATA_OK)) {
        downloaded = downloadAssistNowViaSIM();
      } else {
        logLine("[ASSIST] No transport, cache-only mode");
      }
    }

    // Always try inject (works from cache even if download failed)
    if (injectAssistNow(SerialGPS)) {
      telemetrySetAssistReady(true);
      sendUBX(CFG_RESET_HOT, sizeof(CFG_RESET_HOT));
      vTaskDelay(pdMS_TO_TICKS(300));
    }

    TelemetrySnapshot telem = {};
    getTelemetrySnapshot(&telem);
    logPrintf("[ASSIST] Final status: %s ready=%d", telem.assistStatus,
              telem.assistReady ? 1 : 0);
  }

  // 7) Configure GPS for acquisition first; switch to 5Hz only after a real
  // fix.
  logPrintf("[GPS] Configuring at %ld baud...", baud);
  applyGpsAcquisitionProfile();
  logLine("[GPS] Configuration DONE");

  // 8) NMEA read loop
  while (true) {
    while (SerialGPS.available())
      gps.encode(SerialGPS.read());

    if (gps.location.isUpdated() && gpsHasRealFix()) {
      currentLat = gps.location.lat();
      currentLng = gps.location.lng();
      lastLat = currentLat;
      lastLng = currentLng;

      // Keep global GPS_LAT/GPS_LNG in sync for getBestAvailableLocation()
      GPS_LAT = currentLat;
      GPS_LNG = currentLng;
      telemetrySetLastGpsUpdate();

      TelemetrySnapshot telem = {};
      getTelemetrySnapshot(&telem);
      if (!telem.gpsReady) {
        unsigned long firstFixMs = millis();
        telemetrySetGpsReady(true, firstFixMs);
        unsigned long ttff = (firstFixMs - telem.bootMs) / 1000;
        char buf[100];
        snprintf(buf, sizeof(buf),
                 "[GPS] FIRST FIX! TTFF=%lus lat=%.6f lng=%.6f", ttff,
                 currentLat, currentLng);
        serialLog(buf);

        // Save fix epoch for freshness tracking
        saveFixEpoch();
      }
      applyGpsTrackingProfile();
    }

    gpsAttemptRecovery(transport);

    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

// ---------------------- GET GPS LINK -----------------------

String getGPSLink() {
  char buffer[128];
  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);

  double finalLat = 0;
  double finalLng = 0;
  bool hasLocation = false;

  // 1. Ưu tiên hàng đầu: Kiểm tra nếu GPS đã có vị trí mới (trong vòng 1 phút)
  if (telem.gpsReady && (millis() - telem.lastGpsUpdateMs < 60000)) {
    finalLat = GPS_getLatitude();
    finalLng = GPS_getLongitude();
    hasLocation = true;
    logLine("[SOS] Sử dụng vị trí chính xác từ GPS");
  }
  // 2. Nếu GPS không có, thử lấy vị trí từ SIM (LBS) ngay lập tức
  else {
    logLine("[SOS] GPS chưa fix, đang quét vị trí từ trạm SIM (LBS)...");

    // Gọi hàm quét LBS (đã sửa ở Bước 1)
    if (acquireNetworkLocationNow()) {
      // Lấy lại dữ liệu mới nhất sau khi quét thành công
      getTelemetrySnapshot(&telem);
      finalLat = telem.networkLocLat;
      finalLng = telem.networkLocLng;
      hasLocation = true;
      logLine("[SOS] Sử dụng vị trí tương đối từ trạm SIM (LBS)");
    }
  }

  // 3. Tạo link dựa trên kết quả
  if (hasLocation) {
    // SỬA LỖI: Thêm định dạng %.6f để truyền tọa độ vào chuỗi
    snprintf(buffer, sizeof(buffer), "https://maps.google.com/?q=%.6f,%.6f",
             finalLat, finalLng);
  } else {
    // Chỉ sử dụng config khi cả GPS và LBS đều thất bại hoàn toàn
    logLine("[SOS] CẢNH BÁO: Không có vị trí mới, dùng vị trí mặc định");
    snprintf(buffer, sizeof(buffer),
             "https://maps.google.com/?q=%s,%s (Vị trí cũ)", GPS_LOCAL_LAT,
             GPS_LOCAL_LNG);
  }

  return String(buffer);
}