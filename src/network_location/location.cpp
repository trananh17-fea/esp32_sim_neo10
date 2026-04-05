#include "location.h"
#include "DATAEG/SIM7680C.h"
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

static constexpr unsigned long NETLOC_RECHECK_WHEN_GPS_FRESH_MS = 300000UL;
static constexpr unsigned long NETLOC_REFRESH_NO_GPS_MS = 1800000UL;

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

  logLine("[NETLOC] Scanning WiFi APs...");

  // Scan APs (synchronous, returns when done)
  int n = WiFi.scanNetworks(false, false, false, 300);
  if (n <= 0) {
    logPrintf("[NETLOC] Scan found %d APs", n);
    WiFi.scanDelete();
    return false;
  }

  logPrintf("[NETLOC] Found %d APs", n);

  // Build JSON body for Geolocation API
  String body = "";
  bool isUnwired = (strcmp(cfg.netlocProvider, "unwiredlabs") == 0);
  
  if (isUnwired) {
    body = "{\"token\":\"";
    body += cfg.netlocApiKey;
    body += "\",\"wifi\":[";
  } else {
    body = "{\"wifiAccessPoints\":[";
  }

  int count = 0;
  int maxAPs = (n > 10) ? 10 : n; // limit to strongest 10

  for (int i = 0; i < maxAPs; i++) {
    if (count > 0)
      body += ",";
    
    if (isUnwired) {
      body += "{\"bssid\":\"";
      body += WiFi.BSSIDstr(i);
      body += "\",\"signal\":";
      body += String(WiFi.RSSI(i));
      body += "}";
    } else {
      body += "{\"macAddress\":\"";
      body += WiFi.BSSIDstr(i);
      body += "\",\"signalStrength\":";
      body += String(WiFi.RSSI(i));
      body += ",\"channel\":";
      body += String(WiFi.channel(i));
      body += "}";
    }
    count++;
  }
  body += isUnwired ? "],\"address\":1}" : "]}";

  WiFi.scanDelete();

  if (count < 2) {
    logLine("[NETLOC] Need at least 2 APs for geolocation");
    return false;
  }

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

  bool isUnwired = (strcmp(cfg.netlocProvider, "unwiredlabs") == 0);
  String url;
  String body;

  if (isUnwired) {
    url = "https://us1.unwiredlabs.com/v2/process.php";
    body = "{\"token\":\"";
    body += cfg.netlocApiKey;
    body += "\",\"radio\":\"";
    body += radio;
    body += "\",\"mcc\":";
    body += String(mcc);
    body += ",\"mnc\":";
    body += String(mnc);
    body += ",\"cells\":[{\"lac\":";
    body += String(lac);
    body += ",\"cid\":";
    body += String(cellId);
    body += "}],\"address\":1}";
  } else {
    int csq = sim_readCSQ();
    int dbm = (csq >= 0 && csq <= 31) ? (-113 + 2 * csq) : -113;
    url = "https://www.googleapis.com/geolocation/v1/geolocate?key=";
    url += cfg.netlocApiKey;
    body = "{\"radioType\":\"";
    body += radio;
    body += "\",\"considerIp\":true,\"cellTowers\":[{\"mobileCountryCode\":";
    body += String(mcc);
    body += ",\"mobileNetworkCode\":";
    body += String(mnc);
    body += ",\"locationAreaCode\":";
    body += String(lac);
    body += ",\"cellId\":";
    body += String(cellId);
    body += ",\"signalStrength\":";
    body += String(dbm);
    body += "}]}";
  }

  String response;
  if (!SIM7680C_httpPostWithResponse(url, "application/json", body, response)) {
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
//   4) Try cell geolocation first (AT+CLBS)
//   5) If cell fails and WiFi is usable, try WiFi geolocation
//   6) Refresh every 30 min while GPS is still down
// ============================================================
bool acquireNetworkLocationNow() {
  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  if (telem.sosActive) {
    logLine("[NETLOC] SOS active, skip immediate acquire");
    return false;
  }

  bool success = doCellGeolocationCLBS();
  if (!success && WiFi.status() == WL_CONNECTED)
    success = doWiFiGeolocation();
  if (!success)
    success = doCellGeolocationViaSIMApi();
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
    } else {
      logLine("[NETLOC] All network location methods failed");
    }

    vTaskDelay(pdMS_TO_TICKS(NETLOC_REFRESH_NO_GPS_MS));
  }
}
