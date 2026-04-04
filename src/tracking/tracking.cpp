#include "tracking.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "geofencing/geofencing.h"
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#define DEVICE_ID "TRACKER_KV"
#define SERVER_URL "https://gps-tracker.thanhvu220809.workers.dev/update"

static unsigned long lastSendMS = 0;

void Tracking_Init() { Serial.println("[TRACK] Init"); }

static bool isValidCoordPair(double lat, double lng) {
  if (lat < -90.0 || lat > 90.0)
    return false;
  if (lng < -180.0 || lng > 180.0)
    return false;
  if (lat == 0.0 && lng == 0.0)
    return false;
  return true;
}

static void appendGeoFields(String &json, double currentLat, double currentLng) {
  bool homeSet = isValidCoordPair(HOME_LAT, HOME_LNG);
  bool currentValid = isValidCoordPair(currentLat, currentLng);
  double distanceToHomeM = -1.0;

  if (homeSet && currentValid) {
    distanceToHomeM =
        calculateDistance(currentLat, currentLng, HOME_LAT, HOME_LNG);
    if (distanceToHomeM < 0.0)
      distanceToHomeM = -1.0;
  }

  bool insideGeofence =
      homeSet && GEOFENCE_ENABLE && (distanceToHomeM >= 0.0) &&
      (distanceToHomeM <= static_cast<double>(GEOFENCE_RADIUS_M));

  json += ",\"homeSet\":";
  json += homeSet ? "true" : "false";

  if (homeSet) {
    json += ",\"homeLat\":";
    json += String(HOME_LAT, 6);
    json += ",\"homeLng\":";
    json += String(HOME_LNG, 6);
  }

  json += ",\"geoEnabled\":";
  json += GEOFENCE_ENABLE ? "true" : "false";
  json += ",\"geoRadiusM\":";
  json += String(GEOFENCE_RADIUS_M);
  json += ",\"distanceToHomeM\":";
  if (distanceToHomeM >= 0.0)
    json += String(distanceToHomeM, 1);
  else
    json += "-1";
  json += ",\"insideGeofence\":";
  json += insideGeofence ? "true" : "false";

  Serial.printf("[TRACK] geo en=%d home=%d rad=%d dist=%.1f in=%d\n",
                GEOFENCE_ENABLE ? 1 : 0, homeSet ? 1 : 0, GEOFENCE_RADIUS_M,
                distanceToHomeM, insideGeofence ? 1 : 0);
}

static String buildTrackingPayload(double lat, double lng, bool isTest) {
  String json = "{\"id\":\"" + String(DEVICE_ID) +
                "\","
                "\"lat\":" +
                String(lat, 6) +
                ","
                "\"lng\":" +
                String(lng, 6);

  appendGeoFields(json, lat, lng);

  if (isTest)
    json += ",\"test\":true";

  json += "}";
  return json;
}

// ============================================================
// Send via WiFi
// ============================================================
static bool sendViaWiFi(const String &json) {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  if (!http.begin(client, SERVER_URL)) {
    Serial.println("[TRACK] WiFi HTTP begin fail");
    TRACK_WIFI_CODE = -1;
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int code = http.POST(json);
  TRACK_WIFI_CODE = code;

  if (code >= 200 && code < 300) {
    Serial.printf("[TRACK] WiFi OK (%d)\n", code);
  } else {
    Serial.printf("[TRACK] WiFi fail: %d %s\n", code,
                  http.errorToString(code).c_str());
  }
  http.end();
  return (code >= 200 && code < 300);
}

// ============================================================
// Send via SIM (4G)
// HTTP 715 = SIM7680C SSL handshake failure with Cloudflare
// Disable with SIM_TRACKING_ENABLE=false while debugging
// ============================================================
static void sendViaSIM(const String &json) {
  if (!SIM_READY || !SIM_TRACKING_ENABLE)
    return;
  if (SOS_ACTIVE)
    return;

  Serial.println("[TRACK] SIM POST...");
  SIM7680C_httpPost(SERVER_URL, "application/json", json);
  // Note: SIM7680C_httpPost doesn't return a code cleanly,
  // but it logs the status internally
}

// ============================================================
void Tracking_Loop() {
  if (millis() - lastSendMS < 10000)
    return;
  lastSendMS = millis();
  if (SOS_ACTIVE)
    return;

  double lat = GPS_getLatitude();
  double lng = GPS_getLongitude();
  if (lat == 0 && lng == 0) {
    if (HOME_LAT != 0 || HOME_LNG != 0) {
      lat = HOME_LAT;
      lng = HOME_LNG;
    }
  }

  String json = buildTrackingPayload(lat, lng, false);

  bool wifiOK = sendViaWiFi(json);
  if (!wifiOK)
    sendViaSIM(json);
}

// ============================================================
// One-shot test (for /track_test hidden endpoint)
// ============================================================
String trackingTestRequest() {
  if (WiFi.status() != WL_CONNECTED)
    return "{\"error\":\"WiFi not connected\"}";

  double lat = GPS_getLatitude();
  double lng = GPS_getLongitude();
  if (lat == 0 && lng == 0) {
    if (HOME_LAT != 0 || HOME_LNG != 0) {
      lat = HOME_LAT;
      lng = HOME_LNG;
    }
  }

  String json = buildTrackingPayload(lat, lng, true);

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  if (!http.begin(client, SERVER_URL))
    return "{\"error\":\"HTTP begin failed\"}";

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int code = http.POST(json);
  String payloadEcho = json;
  payloadEcho.replace("\"", "'");
  String result =
      "{\"http_code\":" + String(code) + ",\"payload\":\"" + payloadEcho + "\"";
  if (code > 0) {
    String body = http.getString();
    body.replace("\"", "'");
    result += ",\"body\":\"" + body + "\"";
  } else {
    result += ",\"error\":\"" + http.errorToString(code) + "\"";
  }
  result += "}";
  http.end();
  return result;
}
