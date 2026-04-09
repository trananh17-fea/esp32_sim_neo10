#include "ConnectionManager.h"
#include "DATAEG/SIM7680C.h"
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

static constexpr const char *DEFAULT_TRACKING_URL =
    "https://gps-tracker.ahcntab.workers.dev/update";

bool ConnectionManager::sendViaWiFi(const String &payload,
                                    const ConfigSnapshot &cfg) {
  if (WiFi.status() != WL_CONNECTED)
    return false;

  const char *wifiUrl = strlen(cfg.wifiTrackingUrl) >= 8 ? cfg.wifiTrackingUrl
                                                         : DEFAULT_TRACKING_URL;

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  if (!http.begin(client, wifiUrl)) {
    logLine("[TRACK] WiFi HTTP begin fail");
    telemetrySetTrackWifiCode(-1);
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);
  const int code = http.POST(payload);
  telemetrySetTrackWifiCode(code);
  http.end();

  if (code >= 200 && code < 300) {
    telemetrySetTrackSimCode(0);
    logPrintf("[TRACK] WiFi OK (%d)", code);
    return true;
  }

  logPrintf("[TRACK] WiFi fail: %d", code);
  return false;
}

bool ConnectionManager::sendViaSIM(const String &payload,
                                   const ConfigSnapshot &cfg) {
  if (!SIM_hasCapability(SIM_CAP_DATA_OK) || !cfg.simTrackingEnable)
    return false;
  if (telemetryIsSosActive())
    return false;
  const String simUrl =
      strlen(cfg.simTrackingUrl) >= 8 ? String(cfg.simTrackingUrl)
                                      : String(DEFAULT_TRACKING_URL);
  if (strlen(cfg.simTrackingUrl) < 8) {
    logLine("[TRACK] SIM tracking URL missing, using default update endpoint");
  }
  if (SIM7680C_isTlsHostBlocked(simUrl)) {
    logPrintf("[TRACK] SIM TLS blocked for host=%s", simUrl.c_str());
    telemetrySetTrackSimCode(715);
    return false;
  }

  logLine("[TRACK] SIM POST...");
  if (SIM7680C_httpPost(simUrl, "application/json", payload)) {
    return true;
  }

  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  logPrintf("[TRACK] SIM fail: %d capability=%s", telem.trackSimCode,
            SIM_capabilityName(SIM_getCapability()));
  return false;
}

bool ConnectionManager::sendTrackingPayload(const String &payload,
                                            const ConfigSnapshot &cfg,
                                            const String &fallbackGetUrl) {
  if (telemetryIsSosActive())
    return false;

  if (sendViaWiFi(payload, cfg))
    return true;

  if (sendViaSIM(payload, cfg))
    return true;

  if (telemetryIsSosActive())
    return false;

  if (fallbackGetUrl.isEmpty())
    return false;

  logPrintf("[TRACK] SIM GET fallback urlLen=%d", fallbackGetUrl.length());
  if (SIM7680C_isTlsHostBlocked(fallbackGetUrl)) {
    logLine("[TRACK] clearing TLS blocklist before GET fallback retry");
    SIM7680C_clearTlsHostBlocklist();
  }
  String response;
  if (!SIM7680C_httpGetWithResponse(fallbackGetUrl, response)) {
    if (response.length() > 0)
      logPrintf("[TRACK] SIM GET fallback body=%s", response.c_str());
    else
      logLine("[TRACK] SIM GET fallback failed");
    return false;
  }

  logPrintf("[TRACK] SIM GET fallback OK body=%s", response.c_str());
  telemetrySetTrackSimCode(200);
  return true;
}
