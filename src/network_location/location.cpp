#include "location.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "WiFiManager/WiFiManager.h"
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

static constexpr unsigned long NETLOC_RECHECK_WHEN_GPS_FRESH_MS = 300000UL;
static constexpr unsigned long NETLOC_REFRESH_NO_GPS_MS = 1800000UL;
static constexpr int NETLOC_MAX_WIFI_APS = 10;
static String LAST_WIFI_SCAN_JSON = "{\"ok\":false,\"count\":0,\"aps\":[]}";
static String LAST_WIFI_SCAN_COMPACT = "";

static String urlEncode(const String &input) {
  String out;
  const char *hex = "0123456789ABCDEF";
  for (size_t i = 0; i < input.length(); ++i) {
    unsigned char c = static_cast<unsigned char>(input[i]);
    const bool safe =
        (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' ||
        c == '~';
    if (safe) {
      out += static_cast<char>(c);
    } else {
      out += '%';
      out += hex[(c >> 4) & 0x0F];
      out += hex[c & 0x0F];
    }
  }
  return out;
}


static void cacheWiFiScanDebug(const wifi_ap_record_t *records, uint16_t count,
                               bool ok) {
  String json = "{\"ok\":";
  json += ok ? "true" : "false";
  json += ",\"count\":";
  json += String(count);
  json += ",\"aps\":[";

  for (uint16_t i = 0; i < count; ++i) {
    if (i > 0)
      json += ",";

    char bssidBuf[18];
    snprintf(bssidBuf, sizeof(bssidBuf), "%02X:%02X:%02X:%02X:%02X:%02X",
             records[i].bssid[0], records[i].bssid[1], records[i].bssid[2],
             records[i].bssid[3], records[i].bssid[4], records[i].bssid[5]);

    json += "{\"bssid\":\"";
    json += bssidBuf;
    json += "\",\"rssi\":";
    json += String(records[i].rssi);
    json += ",\"channel\":";
    json += String(records[i].primary);
    json += "}";
  }

  json += "]}";
  LAST_WIFI_SCAN_JSON = json;
}

static bool isPlausibleCoord(double lat, double lng) {
  return lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 &&
         !(lat == 0.0 && lng == 0.0);
}

static bool normalizeLocationPair(double *lat, double *lng) {
  if (!lat || !lng)
    return false;

  if (isPlausibleCoord(*lat, *lng))
    return true;

  if (isPlausibleCoord(*lng, *lat)) {
    const double swappedLat = *lng;
    const double swappedLng = *lat;
    *lat = swappedLat;
    *lng = swappedLng;
    logLine("[NETLOC] Swapped lat/lng to normalize location pair");
    return true;
  }

  return false;
}

static int scanNearbyWiFi(String *googleJson, String *unwiredJson) {
  if (!googleJson || !unwiredJson)
    return 0;

  *googleJson = "";
  *unwiredJson = "";

  logLine("[NETLOC] Scanning nearby WiFi BSSIDs...");
  wifiEnterScanMode();
  vTaskDelay(pdMS_TO_TICKS(250));

  int found = WiFi.scanNetworks(false, false, false, 300, 0, nullptr, nullptr);
  if (found < 0) {
    logPrintf("[NETLOC] WiFi scan failed (%d)", found);
    vTaskDelay(pdMS_TO_TICKS(250));
    found = WiFi.scanNetworks();
  }

  wifiRestoreApStaMode();

  if (found <= 0) {
    cacheWiFiScanDebug(nullptr, 0, false);
    logPrintf("[NETLOC] WiFi scan found %d APs", found);
    return 0;
  }

  int count = 0;
  int maxAPs = (found > NETLOC_MAX_WIFI_APS) ? NETLOC_MAX_WIFI_APS : found;
  wifi_ap_record_t apRecords[NETLOC_MAX_WIFI_APS];
  memset(apRecords, 0, sizeof(apRecords));
  LAST_WIFI_SCAN_COMPACT = "";

  for (int i = 0; i < maxAPs; i++) {
    const String bssid = WiFi.BSSIDstr(i);
    const int rssi = WiFi.RSSI(i);
    const int channel = WiFi.channel(i);
    if (bssid.length() < 11)
      continue;

    sscanf(bssid.c_str(), "%hhX:%hhX:%hhX:%hhX:%hhX:%hhX", &apRecords[count].bssid[0],
           &apRecords[count].bssid[1], &apRecords[count].bssid[2],
           &apRecords[count].bssid[3], &apRecords[count].bssid[4],
           &apRecords[count].bssid[5]);
    apRecords[count].rssi = rssi;
    apRecords[count].primary = channel;

    String compactBssid = bssid;
    compactBssid.replace(":", "");
    if (!LAST_WIFI_SCAN_COMPACT.isEmpty())
      LAST_WIFI_SCAN_COMPACT += ';';
    LAST_WIFI_SCAN_COMPACT += compactBssid;
    LAST_WIFI_SCAN_COMPACT += '|';
    LAST_WIFI_SCAN_COMPACT += String(rssi);
    LAST_WIFI_SCAN_COMPACT += '|';
    LAST_WIFI_SCAN_COMPACT += String(channel);

    if (count > 0) {
      *googleJson += ",";
      *unwiredJson += ",";
    }

    *googleJson += "{\"macAddress\":\"";
    *googleJson += bssid;
    *googleJson += "\",\"signalStrength\":";
    *googleJson += String(rssi);
    *googleJson += ",\"channel\":";
    *googleJson += String(channel);
    *googleJson += "}";

    *unwiredJson += "{\"bssid\":\"";
    *unwiredJson += bssid;
    *unwiredJson += "\",\"signal\":";
    *unwiredJson += String(rssi);
    *unwiredJson += "}";

    count++;
  }

  cacheWiFiScanDebug(apRecords, count, count > 0);
  WiFi.scanDelete();
  logPrintf("[NETLOC] Nearby WiFi APs usable=%d", count);
  for (int i = 0; i < count; ++i) {
    char bssidBuf[18];
    snprintf(bssidBuf, sizeof(bssidBuf), "%02X:%02X:%02X:%02X:%02X:%02X",
             apRecords[i].bssid[0], apRecords[i].bssid[1], apRecords[i].bssid[2],
             apRecords[i].bssid[3], apRecords[i].bssid[4], apRecords[i].bssid[5]);
    logPrintf("[NETLOC] AP[%d] bssid=%s rssi=%d ch=%d", i, bssidBuf,
              apRecords[i].rssi, apRecords[i].primary);
  }
  return count;
}

static bool parseLocationApiResponse(const String &response, double *lat,
                                     double *lng, float *accuracy) {
  if (!lat || !lng || !accuracy)
    return false;

  *lat = 0.0;
  *lng = 0.0;
  *accuracy = 9999.0f;

  int latIdx = response.indexOf("\"lat\"");
  int lngIdx = response.indexOf("\"lng\"");
  if (lngIdx < 0)
    lngIdx = response.indexOf("\"lon\"");
  int accIdx = response.indexOf("\"accuracy\"");

  if (latIdx < 0 || lngIdx < 0)
    return false;

  int colonLat = response.indexOf(':', latIdx + 5);
  if (colonLat > 0) {
    int endLat = response.indexOf(',', colonLat);
    if (endLat < 0)
      endLat = response.indexOf('}', colonLat);
    if (endLat > colonLat)
      *lat = response.substring(colonLat + 1, endLat).toDouble();
  }

  int colonLng = response.indexOf(':', lngIdx + 5);
  if (colonLng > 0) {
    int endLng = response.indexOf(',', colonLng);
    if (endLng < 0)
      endLng = response.indexOf('}', colonLng);
    if (endLng > colonLng)
      *lng = response.substring(colonLng + 1, endLng).toDouble();
  }

  if (accIdx > 0) {
    int colonAcc = response.indexOf(':', accIdx + 10);
    if (colonAcc > 0) {
      int endAcc = response.indexOf(',', colonAcc);
      if (endAcc < 0)
        endAcc = response.indexOf('}', colonAcc);
      if (endAcc > colonAcc)
        *accuracy = response.substring(colonAcc + 1, endAcc).toFloat();
    }
  }

  return normalizeLocationPair(lat, lng);
}

// ============================================================
// WiFi Geolocation — scan nearby APs, send to API
// ============================================================
static bool doWiFiGeolocation() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  if (strlen(cfg.netlocApiKey) < 5) {
    logLine("[NETLOC] No API key, skip WiFi geoloc");
    return false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    logLine("[NETLOC] WiFi not connected, skip scan");
    return false;
  }

  // Build JSON body for Geolocation API
  String googleWiFiJson;
  String unwiredWiFiJson;
  int count = scanNearbyWiFi(&googleWiFiJson, &unwiredWiFiJson);
  if (count < 2) {
    logLine("[NETLOC] Need at least 2 APs for WiFi geolocation");
    return false;
  }

  String body = "";
  bool isUnwired = (strcmp(cfg.netlocProvider, "unwiredlabs") == 0);
  
  if (isUnwired) {
    body = "{\"token\":\"";
    body += cfg.netlocApiKey;
    body += "\",\"wifi\":[";
    body += unwiredWiFiJson;
  } else {
    body = "{\"wifiAccessPoints\":[";
    body += googleWiFiJson;
  }
  body += isUnwired ? "],\"address\":1}" : "]}";

  // POST to Geolocation API
  String url = "";
  if (isUnwired) {
    url = "https://us1.unwiredlabs.com/v2/process.php";
  } else {
    url = "https://www.googleapis.com/geolocation/v1/geolocate?key=";
    url += cfg.netlocApiKey;
  }

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure(); // skip cert verify for simplicity

  if (!http.begin(client, url)) {
    logLine("[NETLOC] HTTP begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int httpCode = http.POST(body);

  if (httpCode != 200) {
    logPrintf("[NETLOC] WiFi geoloc API error: %d", httpCode);
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  // Parse response: { "location": { "lat": X, "lng": Y }, "accuracy": Z }
  double lat = 0, lng = 0;
  float accuracy = 9999;
  if (!parseLocationApiResponse(response, &lat, &lng, &accuracy)) {
    logLine("[NETLOC] Cannot parse geoloc response");
    return false;
  }

  logPrintf("[NETLOC] WiFi geoloc: lat=%.6f lng=%.6f acc=%.0fm", lat, lng,
            accuracy);

  telemetrySetNetworkLocation(lat, lng, accuracy, LOC_WIFI_GEO);
  return true;
}

// ============================================================
// Hybrid geolocation via SIM internet:
// send serving cell + nearby WiFi BSSIDs in one request.
// ============================================================
static bool doHybridGeolocationViaSIMApi() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  if (strlen(cfg.netlocApiKey) < 5) {
    logLine("[NETLOC] No API key, skip hybrid geoloc");
    return false;
  }
  if (!SIM_hasCapability(SIM_CAP_DATA_OK)) {
    logLine("[NETLOC] SIM data not ready, skip hybrid geoloc");
    return false;
  }

  int mcc = 0;
  int mnc = 0;
  int lac = 0;
  int cellId = 0;
  String radio = "gsm";
  if (!SIM_getCellInfo(&mcc, &mnc, &lac, &cellId, &radio)) {
    logLine("[NETLOC] No serving cell info for hybrid geoloc");
    return false;
  }

  String googleWiFiJson;
  String unwiredWiFiJson;
  int wifiCount = scanNearbyWiFi(&googleWiFiJson, &unwiredWiFiJson);

  int csq = sim_readCSQ();
  int dbm = (csq >= 0 && csq <= 31) ? (-113 + 2 * csq) : -113;
  const bool isUnwired = (strcmp(cfg.netlocProvider, "unwiredlabs") == 0);
  String relayBase = String(cfg.netlocRelayUrl);
  relayBase.trim();
  if (relayBase.length() < 8) {
    logLine("[NETLOC] Relay URL missing, skip hybrid geoloc");
    return false;
  }
  String relayUrl = relayBase;
  relayUrl += "?provider=";
  relayUrl += urlEncode(String(isUnwired ? "unwiredlabs" : "google"));
  relayUrl += "&key=";
  relayUrl += urlEncode(String(cfg.netlocApiKey));
  relayUrl += "&radio=";
  relayUrl += urlEncode(radio);
  relayUrl += "&mcc=" + String(mcc);
  relayUrl += "&mnc=" + String(mnc);
  relayUrl += "&lac=" + String(lac);
  relayUrl += "&cid=" + String(cellId);
  relayUrl += "&dbm=" + String(dbm);
  relayUrl += "&wifi=";
  relayUrl += urlEncode(LAST_WIFI_SCAN_COMPACT);

  logPrintf("[NETLOC] Hybrid geoloc via SIM: wifiAPs=%d radio=%s cell=%d/%d/%d/%d",
            wifiCount, radio.c_str(), mcc, mnc, lac, cellId);

  String response;
  if (!SIM7680C_httpGetWithResponse(relayUrl, response)) {
    if (response.length() > 0)
      logPrintf("[NETLOC] Hybrid geoloc error body: %s", response.c_str());
    logLine("[NETLOC] Hybrid geoloc request failed");
    return false;
  }

  double lat = 0.0;
  double lng = 0.0;
  float accuracy = 9999.0f;
  if (!parseLocationApiResponse(response, &lat, &lng, &accuracy)) {
    logPrintf("[NETLOC] Hybrid response parse failed: %s", response.c_str());
    return false;
  }

  logPrintf("[NETLOC] Hybrid geoloc: lat=%.6f lng=%.6f acc=%.0fm",
            lat, lng, accuracy);
  telemetrySetNetworkLocation(lat, lng, accuracy, LOC_CELL_GEO);
  return true;
}

// ============================================================
// Cell geolocation via internet over SIM data
// Uses current serving cell info + configured geolocation provider.
// ============================================================
static bool doCellGeolocationViaSIMApi() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  if (strlen(cfg.netlocApiKey) < 5) {
    logLine("[NETLOC] No API key, skip SIM internet geoloc");
    return false;
  }
  if (!SIM_hasCapability(SIM_CAP_DATA_OK)) {
    logLine("[NETLOC] SIM data not ready, skip internet geoloc");
    return false;
  }

  int mcc = 0;
  int mnc = 0;
  int lac = 0;
  int cellId = 0;
  String radio = "gsm";
  if (!SIM_getCellInfo(&mcc, &mnc, &lac, &cellId, &radio)) {
    logLine("[NETLOC] No serving cell info for SIM internet geoloc");
    return false;
  }

  int csq = sim_readCSQ();
  int dbm = (csq >= 0 && csq <= 31) ? (-113 + 2 * csq) : -113;
  const bool isUnwired = (strcmp(cfg.netlocProvider, "unwiredlabs") == 0);
  String relayBase = String(cfg.netlocRelayUrl);
  relayBase.trim();
  if (relayBase.length() < 8) {
    logLine("[NETLOC] Relay URL missing, skip SIM internet geoloc");
    return false;
  }
  String relayUrl = relayBase;
  relayUrl += "?provider=";
  relayUrl += urlEncode(String(isUnwired ? "unwiredlabs" : "google"));
  relayUrl += "&key=";
  relayUrl += urlEncode(String(cfg.netlocApiKey));
  relayUrl += "&radio=";
  relayUrl += urlEncode(radio);
  relayUrl += "&mcc=" + String(mcc);
  relayUrl += "&mnc=" + String(mnc);
  relayUrl += "&lac=" + String(lac);
  relayUrl += "&cid=" + String(cellId);
  relayUrl += "&dbm=" + String(dbm);

  String response;
  if (!SIM7680C_httpGetWithResponse(relayUrl, response)) {
    if (response.length() > 0)
      logPrintf("[NETLOC] SIM internet geoloc error body: %s",
                response.c_str());
    logLine("[NETLOC] SIM internet geoloc request failed");
    return false;
  }

  double lat = 0.0;
  double lng = 0.0;
  float accuracy = 9999.0f;
  if (!parseLocationApiResponse(response, &lat, &lng, &accuracy)) {
    logPrintf("[NETLOC] SIM internet response parse failed: %s",
              response.c_str());
    return false;
  }

  logPrintf("[NETLOC] SIM internet geoloc: lat=%.6f lng=%.6f acc=%.0fm",
            lat, lng, accuracy);
  telemetrySetNetworkLocation(lat, lng, accuracy, LOC_CELL_GEO);
  return true;
}

// ============================================================
// Cell Geolocation via AT+CLBS (built-in LBS on some SIM modules)
// Response: +CLBS: 0,<lng>,<lat>,<accuracy>
// ============================================================
static bool doCellGeolocationCLBS() {
  if (!SIM_hasCapability(SIM_CAP_VOICE_SMS_OK)) {
    logLine("[NETLOC] SIM not ready for CLBS");
    return false;
  }

  TelemetrySnapshot preTelem = {};
  getTelemetrySnapshot(&preTelem);
  if (preTelem.sosActive) {
    logLine("[NETLOC] SOS active, skipping CLBS to free modem");
    return false;
  }

  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  // Enable CLBS
  simSerial.println("AT+CLBSCFG=1,3,\"lbs-simcom.com\",0");
  vTaskDelay(pdMS_TO_TICKS(500));
  while (simSerial.available())
    simSerial.read();

  simSerial.println("AT+CLBS=4,1");
  String resp = "";
  unsigned long t0 = millis();
  while (millis() - t0 < 15000) {
    TelemetrySnapshot telem = {};
    getTelemetrySnapshot(&telem);
    if (telem.sosActive) {
      logLine("[NETLOC] SOS triggered! Aborting CLBS");
      break;
    }

    while (simSerial.available()) {
      char c = simSerial.read();
      resp += c;
    }
    if (resp.indexOf("+CLBS:") >= 0 && resp.indexOf("\n", resp.indexOf("+CLBS:")) >= 0)
      break;
    if (resp.indexOf("ERROR") >= 0)
      break;
    vTaskDelay(pdMS_TO_TICKS(100));
  }

  if (simMutex)
    xSemaphoreGive(simMutex);

  // Parse +CLBS: 0,<lng>,<lat>,<accuracy>
  int idx = resp.indexOf("+CLBS: 0,");
  if (idx < 0) {
    logPrintf("[NETLOC] CLBS failed or unsupported: %s", resp.c_str());
    return false;
  }

  idx += 9; // skip "+CLBS: 0,"
  // Parse lng
  int c1 = resp.indexOf(',', idx);
  if (c1 < 0)
    return false;
  double lng = resp.substring(idx, c1).toDouble();

  // Parse lat
  int c2 = resp.indexOf(',', c1 + 1);
  if (c2 < 0)
    return false;
  double lat = resp.substring(c1 + 1, c2).toDouble();

  // Parse accuracy
  float accuracy = resp.substring(c2 + 1).toFloat();
  if (accuracy <= 0)
    accuracy = 500; // default if not reported

  if (!normalizeLocationPair(&lat, &lng)) {
    logLine("[NETLOC] CLBS returned invalid coordinates");
    return false;
  }

  logPrintf("[NETLOC] Cell CLBS: lat=%.6f lng=%.6f acc=%.0fm", lat, lng,
            accuracy);

  telemetrySetNetworkLocation(lat, lng, accuracy, LOC_CELL_GEO);
  return true;
}

// ============================================================
// Network Location Task
//
// Flow:
//   1) Wait 8s after boot
//   2) If GPS already has fresh fix, skip
//   3) If SOS is active, skip
//   4) Try API-based coarse location only
//   5) If all trusted methods fail, keep no coarse location
//   6) Refresh every 30 min while GPS is still down
// ============================================================
bool acquireNetworkLocationNow() {
  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  if (telem.sosActive) {
    logLine("[NETLOC] SOS active, skip immediate acquire");
    return false;
  }

  // For ESP32-only testing, WiFi geolocation is the only available source
  // when SIM/GPS are absent. It still needs a real STA uplink to call the
  // geolocation API, but it should be attempted first when available.
  if (WiFi.status() == WL_CONNECTED) {
    if (doWiFiGeolocation())
      return true;
    logLine("[NETLOC] WiFi uplink present but WiFi geoloc failed, trying SIM-based methods");
  }

  if (WiFi.status() != WL_CONNECTED && !SIM_hasCapability(SIM_CAP_DATA_OK)) {
    logLine("[NETLOC] No internet uplink: AP-only mode cannot resolve WiFi scans to coordinates");
    String googleWiFiJson;
    String unwiredWiFiJson;
    scanNearbyWiFi(&googleWiFiJson, &unwiredWiFiJson);
  }

  bool success = doHybridGeolocationViaSIMApi();
  if (!success)
    success = doCellGeolocationViaSIMApi();
  if (!success)
    logLine("[NETLOC] Trusted coarse geolocation unavailable (CLBS disabled)");
  return success;
}

void networkLocationTask(void *pvParameters) {
  // Initial delay — give GPS and SIM time to attempt fix
  vTaskDelay(pdMS_TO_TICKS(8000));

  logLine("[NETLOC] Task started");

  while (true) {
    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);

    if (!cfg.netlocEnable) {
      vTaskDelay(pdMS_TO_TICKS(10000));
      continue;
    }

    TelemetrySnapshot telem = {};
    getTelemetrySnapshot(&telem);

    if (telem.sosActive) {
      logLine("[NETLOC] SOS active, deferring network location");
      vTaskDelay(pdMS_TO_TICKS(10000));
      continue;
    }

    if (!telem.assistReady && (millis() - telem.bootMs) < 45000UL) {
      logLine("[NETLOC] Assist still in progress, deferring network location");
      vTaskDelay(pdMS_TO_TICKS(5000));
      continue;
    }

    // If GPS has recent fix, no need for network location
    if (telem.gpsReady && telem.lastGpsUpdateMs > 0) {
      unsigned long gpsAge = millis() - telem.lastGpsUpdateMs;
      if (gpsAge < 60000) { // < 1 minute
        logLine("[NETLOC] GPS active, skip network location");
        vTaskDelay(pdMS_TO_TICKS(NETLOC_RECHECK_WHEN_GPS_FRESH_MS));
        continue;
      }
    }

    logLine("[NETLOC] No recent GPS, attempting network location...");

    bool success = acquireNetworkLocationNow();

    if (success) {
      logLine("[NETLOC] Network location obtained");

      TelemetrySnapshot postTelem = {};
      getTelemetrySnapshot(&postTelem);
      if (!postTelem.gpsReady && postTelem.networkLocReady) {
        uint32_t accM = (postTelem.networkLocAccuracyM > 100.0f)
                            ? (uint32_t)postTelem.networkLocAccuracyM
                            : 100U;
        if (accM > 100000U)
          accM = 100000U;
        GPS_injectApproxPosition(postTelem.networkLocLat, postTelem.networkLocLng,
                                 accM);

        time_t now = time(nullptr);
        if (now > 1704067200UL) {
          struct tm *t = gmtime(&now);
          GPS_injectApproxTime(t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
                               t->tm_hour, t->tm_min, t->tm_sec, 1000);
        }
      }
    } else {
      logLine("[NETLOC] All network location methods failed");
    }

    vTaskDelay(pdMS_TO_TICKS(NETLOC_REFRESH_NO_GPS_MS));
  }
}

String getLastWiFiScanDebugJson() { return LAST_WIFI_SCAN_JSON; }
