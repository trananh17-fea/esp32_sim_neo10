#include "tracking.h"
#include "ConnectionManager.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "geofencing/geofencing.h"
#include "network_location/location.h"
#include <ArduinoJson.h>
#include <WiFi.h>

static constexpr const char *DEFAULT_TRACKING_URL =
    "https://gps-tracker.ahcntab.workers.dev/update";
static constexpr const char *DEFAULT_TRACKING_GET_URL =
    "https://gps-tracker.ahcntab.workers.dev/update_get";

static constexpr unsigned long CURRENT_DISTANCE_MIN_GAP_MS = 900000UL;
static constexpr double CURRENT_DISTANCE_DELTA_M = 500.0;

static constexpr unsigned long HISTORY_DISTANCE_MIN_GAP_MS = 3600000UL;
static constexpr double HISTORY_DISTANCE_DELTA_M = 1500.0;
static constexpr unsigned long TRACK_SEND_RETRY_BACKOFF_MS = 60000UL;

static unsigned long lastCurrentSendMS = 0;
static unsigned long lastHistorySendMS = 0;
static unsigned long lastFailedSendMs = 0;
static double lastCurrentLat = 0.0;
static double lastCurrentLng = 0.0;
static double lastHistoryLat = 0.0;
static double lastHistoryLng = 0.0;
static LocationSource lastCurrentSource = LOC_NONE;
static LocationSource lastHistorySource = LOC_NONE;
static bool hasCurrentSnapshot = false;
static bool hasHistorySnapshot = false;
static unsigned long lastTrackingNetlocAttemptMs = 0;
static ConnectionManager connectionManager;
static constexpr unsigned long TRACK_NETLOC_RETRY_MS = 60000UL;

void Tracking_Init() { logLine("[TRACK] Init"); }

static bool isValidCoordPair(double lat, double lng) {
  if (lat < -90.0 || lat > 90.0)
    return false;
  if (lng < -180.0 || lng > 180.0)
    return false;
  if (lat == 0.0 && lng == 0.0)
    return false;
  return true;
}

static double distanceBetweenMeters(double latA, double lngA, double latB,
                                    double lngB) {
  if (!isValidCoordPair(latA, lngA) || !isValidCoordPair(latB, lngB))
    return -1.0;
  return calculateDistance(latA, lngA, latB, lngB);
}

static float readCurrentSpeedKmph() {
  return gps.speed.isValid() ? gps.speed.kmph() : 0.0f;
}

static bool isMovingNow(const BestLocationResult &loc, float speedKmph) {
  return loc.source == LOC_GPS && speedKmph >= 5.0f;
}

static bool shouldSendCurrentSnapshot(const BestLocationResult &loc,
                                      float speedKmph, unsigned long nowMs,
                                      const ConfigSnapshot &cfg) {
  if (!hasCurrentSnapshot)
    return true;

  if (loc.source != lastCurrentSource)
    return true;

  const double movedM =
      distanceBetweenMeters(loc.lat, loc.lng, lastCurrentLat, lastCurrentLng);
  if (movedM >= CURRENT_DISTANCE_DELTA_M &&
      (nowMs - lastCurrentSendMS) >= CURRENT_DISTANCE_MIN_GAP_MS) {
    return true;
  }

  const unsigned long intervalMs =
      isMovingNow(loc, speedKmph) ? cfg.trackingCurrentMovingIntervalMs
                                  : cfg.trackingCurrentStationaryIntervalMs;
  return (nowMs - lastCurrentSendMS) >= intervalMs;
}

static bool shouldWriteHistorySample(const BestLocationResult &loc,
                                     float speedKmph, unsigned long nowMs,
                                     const ConfigSnapshot &cfg) {
  if (!hasHistorySnapshot)
    return true;

  if (loc.source != lastHistorySource &&
      (nowMs - lastHistorySendMS) >= HISTORY_DISTANCE_MIN_GAP_MS) {
    return true;
  }

  const double movedM =
      distanceBetweenMeters(loc.lat, loc.lng, lastHistoryLat, lastHistoryLng);
  if (movedM >= HISTORY_DISTANCE_DELTA_M &&
      (nowMs - lastHistorySendMS) >= HISTORY_DISTANCE_MIN_GAP_MS) {
    return true;
  }

  const unsigned long intervalMs =
      isMovingNow(loc, speedKmph) ? cfg.trackingHistoryMovingIntervalMs
                                  : cfg.trackingHistoryStationaryIntervalMs;
  return (nowMs - lastHistorySendMS) >= intervalMs;
}

static bool shouldForceSendFreshNetworkLocation(const BestLocationResult &loc) {
  if (!loc.valid)
    return false;
  if (loc.source != LOC_CELL_GEO && loc.source != LOC_WIFI_GEO)
    return false;
  if (loc.ageMs > 15000UL)
    return false;
  if (!hasCurrentSnapshot)
    return true;
  if (lastCurrentSource == LOC_HOME || lastCurrentSource == LOC_NONE)
    return true;

  const double movedM =
      distanceBetweenMeters(loc.lat, loc.lng, lastCurrentLat, lastCurrentLng);
  return movedM >= 200.0;
}

static void rememberCurrentSnapshot(const BestLocationResult &loc,
                                    unsigned long nowMs) {
  lastCurrentSendMS = nowMs;
  lastCurrentLat = loc.lat;
  lastCurrentLng = loc.lng;
  lastCurrentSource = loc.source;
  hasCurrentSnapshot = true;
}

static void rememberHistorySnapshot(const BestLocationResult &loc,
                                    unsigned long nowMs) {
  lastHistorySendMS = nowMs;
  lastHistoryLat = loc.lat;
  lastHistoryLng = loc.lng;
  lastHistorySource = loc.source;
  hasHistorySnapshot = true;
}

static String urlEncodeTrack(const String &input) {
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

static void appendGeoFields(JsonDocument &doc, double currentLat,
                            double currentLng, const ConfigSnapshot &cfg) {
  bool homeSet = isValidCoordPair(cfg.homeLat, cfg.homeLng);
  bool currentValid = isValidCoordPair(currentLat, currentLng);
  double distanceToHomeM = -1.0;

  if (homeSet && currentValid) {
    distanceToHomeM =
        calculateDistance(currentLat, currentLng, cfg.homeLat, cfg.homeLng);
    if (distanceToHomeM < 0.0)
      distanceToHomeM = -1.0;
  }

  bool insideGeofence =
      homeSet && cfg.geofenceEnable && (distanceToHomeM >= 0.0) &&
      (distanceToHomeM <= static_cast<double>(cfg.geofenceRadiusM));

  doc["homeSet"] = homeSet;

  if (homeSet) {
    doc["homeLat"] = cfg.homeLat;
    doc["homeLng"] = cfg.homeLng;
  }

  doc["geoEnabled"] = cfg.geofenceEnable;
  doc["geoRadiusM"] = cfg.geofenceRadiusM;
  doc["distanceToHomeM"] = (distanceToHomeM >= 0.0) ? distanceToHomeM : -1;
  doc["insideGeofence"] = insideGeofence;

  logPrintf("[TRACK] geo en=%d home=%d rad=%d dist=%.1f in=%d",
            cfg.geofenceEnable ? 1 : 0, homeSet ? 1 : 0, cfg.geofenceRadiusM,
            distanceToHomeM, insideGeofence ? 1 : 0);
}

static void buildTrackingJson(JsonDocument &doc, bool isTest,
                              const ConfigSnapshot &cfg,
                              const BestLocationResult &loc,
                              bool historySample) {
  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  int satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
  float speedKmph = gps.speed.isValid() ? gps.speed.kmph() : 0.0f;

  doc["id"] = cfg.deviceId;
  doc["deviceId"] = cfg.deviceId;
  doc["name"] = cfg.deviceName;
  doc["deviceName"] = cfg.deviceName;
  doc["lat"] = loc.lat;
  doc["lng"] = loc.lng;
  doc["lon"] = loc.lng;
  doc["timestamp"] = static_cast<uint32_t>(millis());
  doc["locSource"] = locationSourceName(loc.source);
  doc["source"] = locationSourceName(loc.source);
  doc["locAccuracyM"] = loc.accuracyM;
  doc["accuracy"] = loc.accuracyM;
  doc["locAgeMs"] = loc.ageMs;
  doc["satellites"] = satellites;
  doc["speedKmph"] = speedKmph;
  doc["historySample"] = historySample;
  doc["fix"] = (loc.source == LOC_GPS);
  if (telem.batteryReady) {
    doc["batteryPercent"] = telem.batteryPercent;
    doc["batteryVoltageV"] = telem.batteryVoltageV;
  }
  appendGeoFields(doc, loc.lat, loc.lng, cfg);
  if (isTest)
    doc["test"] = true;
}

static String serializeTrackingPayload(bool isTest, const ConfigSnapshot &cfg,
                                       const BestLocationResult &loc,
                                       bool historySample) {
  JsonDocument doc;
  buildTrackingJson(doc, isTest, cfg, loc, historySample);
  String payload;
  serializeJson(doc, payload);
  return payload;
}

static String buildTrackingFallbackGetUrl(const ConfigSnapshot &cfg,
                                          const String &payload) {
  JsonDocument doc;
  if (deserializeJson(doc, payload) != DeserializationError::Ok)
    return "";

  String url = strlen(cfg.simTrackingUrl) >= 8 ? String(cfg.simTrackingUrl)
                                               : String(DEFAULT_TRACKING_URL);
  int queryCut = url.indexOf('?');
  if (queryCut >= 0)
    url = url.substring(0, queryCut);
  int updateIdx = url.indexOf("/update");
  if (updateIdx >= 0)
    url = url.substring(0, updateIdx) + "/update_get";
  else
    url = DEFAULT_TRACKING_GET_URL;
  url += "?deviceId=";
  url += urlEncodeTrack(String(static_cast<const char *>(doc["deviceId"])));
  url += "&deviceName=";
  url += urlEncodeTrack(String(static_cast<const char *>(doc["deviceName"])));
  url += "&lat=";
  url += String(doc["lat"].as<double>(), 6);
  url += "&lng=";
  url += String(doc["lng"].as<double>(), 6);
  url += "&locSource=";
  url += urlEncodeTrack(String(static_cast<const char *>(doc["locSource"])));
  url += "&locAccuracyM=";
  url += String(doc["locAccuracyM"].as<float>(), 1);
  url += "&locAgeMs=";
  url += String(doc["locAgeMs"].as<unsigned long>());
  url += "&satellites=";
  url += String(doc["satellites"].as<int>());
  url += "&speedKmph=";
  url += String(doc["speedKmph"].as<float>(), 1);
  url += "&historySample=";
  url += doc["historySample"].as<bool>() ? "1" : "0";
  if (!doc["batteryPercent"].isNull()) {
    url += "&batteryPercent=";
    url += String(doc["batteryPercent"].as<int>());
  }
  if (!doc["batteryVoltageV"].isNull()) {
    url += "&batteryVoltageV=";
    url += String(doc["batteryVoltageV"].as<float>(), 3);
  }
  return url;
}

static bool canAttemptTrackingNetloc() {
  return WiFi.status() == WL_CONNECTED || SIM_hasCapability(SIM_CAP_VOICE_SMS_OK);
}

// ============================================================
void Tracking_Loop() {
  if (telemetryIsSosActive())
    return;

  const unsigned long nowMs = millis();
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);
  BestLocationResult loc = getBestAvailableLocation();

  if ((!loc.valid || loc.source == LOC_HOME) && cfg.netlocEnable &&
      canAttemptTrackingNetloc() &&
      (lastTrackingNetlocAttemptMs == 0 ||
       (nowMs - lastTrackingNetlocAttemptMs) >= TRACK_NETLOC_RETRY_MS)) {
    lastTrackingNetlocAttemptMs = nowMs;
    if (acquireNetworkLocationNow()) {
      BestLocationResult refreshed = getBestAvailableLocation();
      if (refreshed.valid)
        loc = refreshed;
    }
  }

  if (!loc.valid)
    return;

  // Don't auto-track HOME fallback. It is only a rough placeholder and causes
  // noisy retries before the device has obtained any live location.
  if (loc.source == LOC_HOME)
    return;

  if (lastFailedSendMs > 0 &&
      (nowMs - lastFailedSendMs) < TRACK_SEND_RETRY_BACKOFF_MS) {
    return;
  }

  const float speedKmph = readCurrentSpeedKmph();
  const bool forceFreshNetloc = shouldForceSendFreshNetworkLocation(loc);
  const bool sendCurrent =
      forceFreshNetloc || shouldSendCurrentSnapshot(loc, speedKmph, nowMs, cfg);
  const bool writeHistory =
      shouldWriteHistorySample(loc, speedKmph, nowMs, cfg);

  if (!sendCurrent && !writeHistory)
    return;

  logPrintf("[TRACK] sending src=%s lat=%.6f lng=%.6f acc=%.1f age=%lu hist=%d",
            locationSourceName(loc.source), loc.lat, loc.lng, loc.accuracyM,
            loc.ageMs, writeHistory ? 1 : 0);
  if (forceFreshNetloc) {
    logLine("[TRACK] forcing immediate send for fresh network location");
  }

  const String payload = serializeTrackingPayload(false, cfg, loc, writeHistory);
  const String fallbackUrl = buildTrackingFallbackGetUrl(cfg, payload);
  bool sendOK =
      connectionManager.sendTrackingPayload(payload, cfg, fallbackUrl);

  if (sendOK) {
    lastFailedSendMs = 0;
    rememberCurrentSnapshot(loc, nowMs);
    if (writeHistory)
      rememberHistorySnapshot(loc, nowMs);
  } else {
    lastFailedSendMs = nowMs;
  }
}

// ============================================================
// One-shot test (for /track_test hidden endpoint)
// ============================================================
String trackingTestRequest() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);
  BestLocationResult loc = getBestAvailableLocation();
  if (!loc.valid)
    return "{\"error\":\"No location available\"}";

  String json = serializeTrackingPayload(true, cfg, loc, true);
  bool ok = connectionManager.sendTrackingPayload(
      json, cfg, buildTrackingFallbackGetUrl(cfg, json));
  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);

  String payloadEcho = json;
  payloadEcho.replace("\"", "'");
  String result = "{\"ok\":";
  result += ok ? "true" : "false";
  result += ",\"wifi_code\":";
  result += String(telem.trackWifiCode);
  result += ",\"sim_code\":";
  result += String(telem.trackSimCode);
  result += ",\"payload\":\"" + payloadEcho + "\"";
  result += "}";
  return result;
}
