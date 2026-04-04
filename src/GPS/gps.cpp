#include "gps.h"
#include "assistnow/assistnow.h"
#include <WiFi.h>

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
const uint8_t CFG_RATE_5HZ[] = {0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xC8,
                                0x00, 0x01, 0x00, 0x01, 0x00, 0xDD, 0x68};
const uint8_t CFG_RESET_HOT[] = {0xB5, 0x62, 0x06, 0x04, 0x04, 0x00,
                                 0x00, 0x00, 0x01, 0x00, 0x0F, 0x38};

void sendUBX(const uint8_t *msg, uint16_t len) {
  for (int i = 0; i < len; i++)
    SerialGPS.write(msg[i]);
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
//
// For each baud rate: reads up to 512 bytes over 2 seconds.
// Scans the ENTIRE buffer for:
//   - NMEA: byte sequence '$' + 'G' or '$' + 'P'
//   - UBX:  byte sequence 0xB5 + 0x62
// Requires at least 10 bytes total (avoids noise false positives).
// On success: serial stays open at the detected baud.
// On failure: dumps first 64 bytes for wiring diagnosis.
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
    vTaskDelay(pdMS_TO_TICKS(300)); // let UART + GPS settle

    // Drain any startup garbage
    while (SerialGPS.available())
      SerialGPS.read();
    vTaskDelay(pdMS_TO_TICKS(200));

    // Read up to 512 bytes, timeout 2 seconds
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

    // Need at least 10 bytes to be meaningful
    if (totalBytes < 10) {
      if (totalBytes > bestLen) {
        bestLen = (totalBytes > 64) ? 64 : totalBytes;
        memcpy(bestBuf, buf, bestLen);
      }
      SerialGPS.end();
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    // Scan buffer for NMEA pattern: '$' followed by 'G' or 'P'
    bool foundNMEA = false;
    for (int i = 0; i < totalBytes - 1; i++) {
      if (buf[i] == '$' && (buf[i + 1] == 'G' || buf[i + 1] == 'P')) {
        foundNMEA = true;
        break;
      }
    }

    // Scan buffer for UBX pattern: 0xB5 followed by 0x62
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
      // Show sample (ASCII of first 80 chars)
      int show = (totalBytes > 80) ? 80 : totalBytes;
      Serial.print("[GPS] Sample: ");
      for (int i = 0; i < show; i++) {
        char c = (buf[i] >= 32 && buf[i] < 127) ? (char)buf[i] : '.';
        Serial.print(c);
      }
      Serial.println();
      // Leave serial OPEN at this baud
      return bauds[b];
    }

    // No valid pattern — save best sniff for debug
    if (totalBytes > bestLen) {
      bestLen = (totalBytes > 64) ? 64 : totalBytes;
      memcpy(bestBuf, buf, bestLen);
    }

    SerialGPS.end();
    vTaskDelay(pdMS_TO_TICKS(100));
  }

  // === FAILED all baud rates ===
  Serial.println("[GPS] ✗ Autobaud FAILED. No NMEA/UBX patterns detected.");
  Serial.printf("[GPS] ✗ bytesRead=%d. Check:\n", bestLen);
  Serial.printf("[GPS] ✗  - TX/RX swap (RX=%d TX=%d)\n", GPS_RX_PIN,
                GPS_TX_PIN);
  Serial.println("[GPS] ✗  - GND connected between ESP32 and GPS");
  Serial.println("[GPS] ✗  - GPS module powered (VCC, antenna)");
  Serial.println("[GPS] ✗  - Correct UART pins (not used by SIM)");

  // Dump whatever we collected
  if (bestLen > 0) {
    dumpSniff(bestBuf, bestLen);
  } else {
    Serial.println("[GPS] No bytes received at any baud rate.");
  }

  return -1;
}

// ---------------------- GPS TASK ---------------------------
void gpsTask(void *pvParameters) {
  Serial.println("[GPS] Init NEO-M10...");

  // 0) Autobaud detection
  long baud = detectGPSBaud();
  if (baud < 0) {
    baud = 38400;
    SerialGPS.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.printf("[GPS] Fallback to %ld baud (may not work)\n", baud);
  }

  vTaskDelay(pdMS_TO_TICKS(500));

  // 1) AssistNow — download then inject (or cache-only)
  //
  // downloadAssistNow() handles cache freshness internally:
  //   - fresh cache → returns true, skips download
  //   - stale/missing → attempts download
  //   - download fails → returns false
  // Either way, we always try injectAssistNow() afterwards.
  {
    bool downloaded = false;
    if (WiFi.status() == WL_CONNECTED) {
      downloaded = downloadAssistNow();
    } else {
      Serial.println("[ASSIST] No WiFi, cache-only mode");
    }

    // Always try inject (works from cache even if download failed)
    if (injectAssistNow(SerialGPS)) {
      ASSIST_READY = true;
      sendUBX(CFG_RESET_HOT, sizeof(CFG_RESET_HOT));
      vTaskDelay(pdMS_TO_TICKS(300));
    }

    // Final status report (inject may have overridden download_fail)
    Serial.printf("[ASSIST] Final status: %s ready=%d\n", ASSIST_STATUS,
                  ASSIST_READY ? 1 : 0);
  }

  // 2) Configure GPS (only after baud locked)
  Serial.printf("[GPS] Configuring at %ld baud...\n", baud);
  sendUBX(CFG_NMEA_UART1, sizeof(CFG_NMEA_UART1));
  vTaskDelay(20);
  sendUBX(CFG_UBX_PVT_OFF, sizeof(CFG_UBX_PVT_OFF));
  vTaskDelay(20);
  sendUBX(CFG_NMEA_GGA_ON, sizeof(CFG_NMEA_GGA_ON));
  sendUBX(CFG_NMEA_RMC_ON, sizeof(CFG_NMEA_RMC_ON));
  vTaskDelay(20);
  sendUBX(CFG_GNSS_FAST, sizeof(CFG_GNSS_FAST));
  vTaskDelay(20);
  sendUBX(CFG_RATE_5HZ, sizeof(CFG_RATE_5HZ));
  vTaskDelay(20);
  Serial.println("[GPS] Configuration DONE");

  // 3) NMEA read loop
  while (true) {
    while (SerialGPS.available())
      gps.encode(SerialGPS.read());

    if (gps.location.isUpdated()) {
      currentLat = gps.location.lat();
      currentLng = gps.location.lng();
      lastLat = currentLat;
      lastLng = currentLng;

      if (!GPS_READY) {
        GPS_READY = true;
        FIRST_FIX_MS = millis();
        unsigned long ttff = (FIRST_FIX_MS - BOOT_MS) / 1000;
        char buf[100];
        snprintf(buf, sizeof(buf),
                 "[GPS] FIRST FIX! TTFF=%lus lat=%.6f lng=%.6f", ttff,
                 currentLat, currentLng);
        serialLog(buf);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// ---------------------- GET GPS LINK -----------------------
String getGPSLink() {
  char buffer[100];
  if (currentLat == 0 || currentLng == 0) {
    double lat = atof(GPS_LOCAL_LAT);
    double lng = atof(GPS_LOCAL_LNG);
    sprintf(buffer, "https://www.google.com/maps?q=%.6f,%.6f", lat, lng);
    GPS_LAT = lat;
    GPS_LNG = lng;
  } else {
    sprintf(buffer, "https://www.google.com/maps?q=%.6f,%.6f", currentLat,
            currentLng);
    GPS_LAT = currentLat;
    GPS_LNG = currentLng;
    nvs_set_blob(nvsHandle, "GPS_LAT", &GPS_LAT, sizeof(GPS_LAT));
    nvs_set_blob(nvsHandle, "GPS_LNG", &GPS_LNG, sizeof(GPS_LNG));
    nvs_commit(nvsHandle);
  }
  return String(buffer);
}
