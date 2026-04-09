#include "assistnow.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include <HTTPClient.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

static const char *FILE_UBX = "/assistnow.ubx";
static const char *FILE_TS = "/assistnow_ts.txt";
static const unsigned long CACHE_MAX_AGE_S = 7UL * 24UL * 3600UL;
static bool fsReady = false;
static bool assistDownloadedThisBoot = false;

// ============================================================
static bool ensureFS() {
  if (fsReady)
    return true;
  if (!LittleFS.begin(true)) {
    Serial.println("[ASSIST] LittleFS FAILED");
    return false;
  }
  fsReady = true;
  return true;
}

// ============================================================
static void dumpBytes(const char *label, const uint8_t *buf, int len,
                      int maxShow) {
  int show = (len < maxShow) ? len : maxShow;
  Serial.printf("[ASSIST] %s (%d bytes):\n", label, len);
  Serial.print("[ASSIST] HEX: ");
  for (int i = 0; i < show; i++) {
    Serial.printf("%02X ", buf[i]);
    if ((i + 1) % 32 == 0 && i + 1 < show)
      Serial.print("\n[ASSIST]      ");
  }
  Serial.println();
  Serial.print("[ASSIST] ASC: ");
  for (int i = 0; i < show; i++) {
    char c = (buf[i] >= 32 && buf[i] < 127) ? (char)buf[i] : '.';
    Serial.print(c);
  }
  Serial.println();
}

// ============================================================
static bool isCacheFresh() {
  if (!ensureFS())
    return false;
  if (!LittleFS.exists(FILE_UBX))
    return false;
  if (!LittleFS.exists(FILE_TS))
    return false;

  File tf = LittleFS.open(FILE_TS, "r");
  if (!tf)
    return false;
  String tsStr = tf.readStringUntil('\n');
  tf.close();

  unsigned long savedTs = strtoul(tsStr.c_str(), NULL, 10);
  if (savedTs == 0)
    return false;

  time_t now = time(nullptr);
  if (now > 1704067200UL && savedTs > 1704067200UL) {
    unsigned long age = (unsigned long)(now - savedTs);
    Serial.printf("[ASSIST] Cache age=%lus\n", age);
    return (age < CACHE_MAX_AGE_S);
  }
  return false; // boot-relative time is unreliable, treat as stale
}

static void saveCacheTimestamp() {
  if (!ensureFS())
    return;
  File tf = LittleFS.open(FILE_TS, "w");
  if (!tf)
    return;
  time_t now = time(nullptr);
  if (now > 1704067200UL)
    tf.println((unsigned long)now);
  else
    tf.println(millis() / 1000);
  tf.close();
}

// ============================================================
static bool validateUBXFile() {
  if (!ensureFS())
    return false;
  File f = LittleFS.open(FILE_UBX, "r");
  if (!f)
    return false;

  int fileSize = f.size();
  if (fileSize < 8) {
    f.close();
    Serial.printf("[ASSIST] File too small: %d\n", fileSize);
    LittleFS.remove(FILE_UBX);
    return false;
  }

  uint8_t buf[64];
  int readN = f.read(buf, sizeof(buf));
  f.close();

  for (int i = 0; i < readN - 1; i++) {
    if (buf[i] == 0xB5 && buf[i + 1] == 0x62) {
      Serial.printf("[ASSIST] Valid UBX (sync@%d, %d bytes)\n", i, fileSize);
      return true;
    }
  }

  Serial.println("[ASSIST] Invalid file - no UBX sync");
  dumpBytes("Invalid file", buf, readN, 60);
  LittleFS.remove(FILE_UBX);
  if (LittleFS.exists(FILE_TS))
    LittleFS.remove(FILE_TS);
  return false;
}

// ============================================================
// Download from ONE URL. Uses a FRESH WiFiClientSecure instance.
// MAX ONE attempt — caller should not retry same URL.
// ============================================================
static int tryDownloadURL(const String &url) {
  Serial.printf("[ASSIST] GET %s\n", url.c_str());

  // Fresh client + http instance per attempt (avoids Bad file number)
  WiFiClientSecure *client = new WiFiClientSecure();
  if (!client) {
    Serial.println("[ASSIST] Client alloc failed");
    return 0;
  }
  client->setInsecure();
  client->setTimeout(10);

  HTTPClient http;
  if (!http.begin(*client, url)) {
    Serial.println("[ASSIST] HTTP begin failed");
    delete client;
    return 0;
  }

  http.useHTTP10(true);
  http.setTimeout(12000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("User-Agent", "ESP32-AssistNow/1.0");
  http.addHeader("Connection", "close");

  int httpCode = http.GET();
  String ctype = http.header("Content-Type");
  int clen = http.getSize();
  Serial.printf("[ASSIST] HTTP %d type=%s len=%d\n", httpCode, ctype.c_str(),
                clen);

  if (httpCode <= 0) {
    Serial.printf("[ASSIST] Connection failed (code=%d). "
                  "SSL/TLS error or no internet.\n",
                  httpCode);
    http.end();
    delete client;
    return 0;
  }

  if (httpCode != HTTP_CODE_OK) {
    String errBody = http.getString();
    int showLen = (errBody.length() > 300) ? 300 : errBody.length();
    Serial.printf("[ASSIST] Error: %s\n",
                  errBody.substring(0, showLen).c_str());
    http.end();
    delete client;
    return 0;
  }

  if (ctype.indexOf("text/html") >= 0) {
    String body = http.getString();
    Serial.println("[ASSIST] Got HTML (error page):");
    Serial.println(body.substring(0, 200));
    http.end();
    delete client;
    return 0;
  }

  // Stream to file
  if (!ensureFS()) {
    http.end();
    delete client;
    return 0;
  }

  File f = LittleFS.open(FILE_UBX, "w");
  if (!f) {
    http.end();
    delete client;
    return 0;
  }

  WiFiClient *stream = http.getStreamPtr();
  int totalBytes = 0;
  uint8_t buf[512];
  unsigned long t0 = millis();
  unsigned long lastData = t0;

  while ((http.connected() || stream->available()) && (millis() - t0 < 30000) &&
         (millis() - lastData < 5000)) {
    int avail = stream->available();
    if (avail > 0) {
      int toRead = (avail > (int)sizeof(buf)) ? sizeof(buf) : avail;
      int r = stream->read(buf, toRead);
      if (r > 0) {
        f.write(buf, r);
        totalBytes += r;
        lastData = millis();
      }
    } else {
      vTaskDelay(pdMS_TO_TICKS(10));
    }
  }

  f.close();
  http.end();
  delete client; // fully clean up — no stale socket

  Serial.printf("[ASSIST] Downloaded %d bytes\n", totalBytes);

  if (totalBytes > 0 && totalBytes < 256) {
    Serial.printf("[ASSIST] Only %d bytes — likely error page\n", totalBytes);
    File df = LittleFS.open(FILE_UBX, "r");
    if (df) {
      uint8_t dbuf[128];
      int dn = df.read(dbuf, sizeof(dbuf));
      df.close();
      dumpBytes("Small download", dbuf, dn, 120);
    }
    LittleFS.remove(FILE_UBX);
    return 0;
  }

  return totalBytes;
}

// ============================================================
// Download AssistNow — proper TOKEN vs CHIPCODE routing
//
// TOKEN → online-live1/live2 with ?token=
// CHIPCODE → assistnow.services.u-blox.com with ?chipcode=
//
// Max 1 attempt per URL. No spinning retries.
// If ALL fail, caller falls back to cache injection.
// ============================================================
bool downloadAssistNow() {
  if (!ensureFS())
    return false;
  if (assistDownloadedThisBoot && validateUBXFile()) {
    Serial.println("[ASSIST] Already downloaded this boot, reuse cache");
    telemetrySetAssistStatus("cache_fresh");
    return true;
  }

  // FRESH CACHE → skip download entirely, inject directly
  if (isCacheFresh() && validateUBXFile()) {
    Serial.println("[ASSIST] Cache fresh + valid → skip download");
    telemetrySetAssistStatus("cache_fresh");
    return true;
  }

  if (WiFi.status() != WL_CONNECTED)
    return false;

  bool hasToken = (strlen(ASSIST_TOKEN) > 5);
  bool hasChipcode = (strlen(ASSIST_CHIPCODE) > 5);

  if (!hasToken && !hasChipcode) {
    Serial.println("[ASSIST] No token/chipcode → cache-only mode");
    telemetrySetAssistStatus("no_credentials");
    return false;
  }

  // Short delay after WiFi connect for TLS stack stability
  vTaskDelay(pdMS_TO_TICKS(1000));

  String urls[4];
  int urlCount = 0;

  // TOKEN → online-live endpoints (uses ?token=)
  if (hasToken) {
    urls[urlCount++] =
        "https://online-live1.services.u-blox.com/GetOnlineData.ashx"
        "?token=" +
        String(ASSIST_TOKEN) + "&gnss=gps,gal&datatype=eph,alm,aux";
    urls[urlCount++] =
        "https://online-live2.services.u-blox.com/GetOnlineData.ashx"
        "?token=" +
        String(ASSIST_TOKEN) + "&gnss=gps,gal&datatype=eph,alm,aux";
  }

  // CHIPCODE → assistnow endpoint (uses ?chipcode=, different host!)
  if (hasChipcode) {
    urls[urlCount++] =
        "https://assistnow.services.u-blox.com/GetAssistNowData.ashx"
        "?chipcode=" +
        String(ASSIST_CHIPCODE) + "&gnss=gps,gal&data=uporb_1,ualm";
  }

  Serial.printf("[ASSIST] %d URL(s) to try\n", urlCount);

  for (int i = 0; i < urlCount; i++) {
    Serial.printf("[ASSIST] Attempt %d/%d\n", i + 1, urlCount);
    int bytes = tryDownloadURL(urls[i]);
    if (bytes > 0 && validateUBXFile()) {
      saveCacheTimestamp();
      assistDownloadedThisBoot = true;
      Serial.printf("[ASSIST] ✓ OK: %d bytes\n", bytes);
      telemetrySetAssistStatus("download_ok");
      return true;
    }
    // No delay before next URL — just move on
  }

  Serial.println("[ASSIST] All downloads failed");
  telemetrySetAssistStatus("download_fail");
  return false;
}

// ============================================================
// Inject from cache. Works without WiFi or credentials.
// Always sets ASSIST_STATUS appropriately.
// ============================================================
bool injectAssistNow(HardwareSerial &gpsSerial) {
  if (!ensureFS())
    return false;

  if (!LittleFS.exists(FILE_UBX)) {
    Serial.println("[ASSIST] No cache (/assistnow.ubx)");
    Serial.println("[ASSIST] To enable offline AssistNow:");
    Serial.println("[ASSIST]   1. Place 'assistnow.ubx' in data/");
    Serial.println("[ASSIST]   2. Run: pio run -t uploadfs");
    telemetrySetAssistStatus("no_cache");
    return false;
  }

  if (!validateUBXFile()) {
    telemetrySetAssistStatus("cache_invalid");
    return false;
  }

  File f = LittleFS.open(FILE_UBX, "r");
  if (!f)
    return false;

  int fileSize = f.size();
  int totalBytes = 0;
  Serial.printf("[ASSIST] Injecting %d bytes...\n", fileSize);

  while (f.available()) {
    uint8_t buf[64];
    int r = f.read(buf, sizeof(buf));
    if (r > 0) {
      gpsSerial.write(buf, r);
      totalBytes += r;
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  f.close();

  Serial.printf("[ASSIST] Injected %d bytes\n", totalBytes);

  if (totalBytes > 0) {
    // Set status: keep download_ok/cache_fresh if already set
      if (strcmp(ASSIST_STATUS, "download_ok") != 0 &&
          strcmp(ASSIST_STATUS, "download_sim_ok") != 0 &&
          strcmp(ASSIST_STATUS, "cache_fresh") != 0) {
        telemetrySetAssistStatus("cached_injected");
      }
    return true;
  }
  return false;
}

// ============================================================
// Download AssistNow via SIM modem (cellular HTTP GET)
//
// Same URL strategy as WiFi version but uses SIM7680C_httpGetToFile().
// Only tries if SIM has data capability.
// ============================================================
bool downloadAssistNowViaSIM() {
  if (!ensureFS())
    return false;
  if (assistDownloadedThisBoot && validateUBXFile()) {
    Serial.println("[ASSIST-SIM] Already downloaded this boot, reuse cache");
    telemetrySetAssistStatus("cache_fresh");
    return true;
  }

  // Fresh cache → skip
  if (isCacheFresh() && validateUBXFile()) {
    Serial.println("[ASSIST-SIM] Cache fresh + valid, skip");
    telemetrySetAssistStatus("cache_fresh");
    return true;
  }

  if (!SIM_hasCapability(SIM_CAP_DATA_OK)) {
    Serial.println("[ASSIST-SIM] No SIM data capability");
    return false;
  }

  bool hasToken = (strlen(ASSIST_TOKEN) > 5);
  bool hasChipcode = (strlen(ASSIST_CHIPCODE) > 5);

  if (!hasToken && !hasChipcode) {
    Serial.println("[ASSIST-SIM] No credentials");
    telemetrySetAssistStatus("no_credentials");
    return false;
  }

  String urls[4];
  int urlCount = 0;

  // TOKEN endpoints
  if (hasToken) {
    urls[urlCount++] =
        "https://online-live1.services.u-blox.com/GetOnlineData.ashx"
        "?token=" +
        String(ASSIST_TOKEN) + "&gnss=gps,gal&datatype=eph,alm,aux";
    urls[urlCount++] =
        "https://online-live2.services.u-blox.com/GetOnlineData.ashx"
        "?token=" +
        String(ASSIST_TOKEN) + "&gnss=gps,gal&datatype=eph,alm,aux";
  }

  // CHIPCODE endpoint
  if (hasChipcode) {
    urls[urlCount++] =
        "https://assistnow.services.u-blox.com/GetAssistNowData.ashx"
        "?chipcode=" +
        String(ASSIST_CHIPCODE) + "&gnss=gps,gal&data=uporb_1,ualm";
  }

  Serial.printf("[ASSIST-SIM] %d URL(s) to try\n", urlCount);

  for (int i = 0; i < urlCount; i++) {
    Serial.printf("[ASSIST-SIM] Attempt %d/%d\n", i + 1, urlCount);
    int bytes = SIM7680C_httpGetToFile(urls[i], FILE_UBX);
    if (bytes > 0 && validateUBXFile()) {
      saveCacheTimestamp();
      assistDownloadedThisBoot = true;
      Serial.printf("[ASSIST-SIM] OK: %d bytes\n", bytes);
      telemetrySetAssistStatus("download_sim_ok");
      return true;
    }
  }

  Serial.println("[ASSIST-SIM] All SIM downloads failed");
  telemetrySetAssistStatus("download_sim_fail");
  return false;
}
