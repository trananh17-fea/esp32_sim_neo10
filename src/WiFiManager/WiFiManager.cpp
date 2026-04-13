#include "WiFiManager.h"
#include "Config.h"
#include "server.h"
#include <time.h>

static constexpr const char *AP_SSID = "TV_DEVICE";
static constexpr const char *AP_PASS = "123456788";
static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_MASK(255, 255, 255, 0);

static bool staCredentialsConfigured() { return strlen(SSID_Name) > 0; }

static bool shouldStartSta() { return staCredentialsConfigured(); }

static bool shouldStartAp() {
  if (!staCredentialsConfigured())
    return true;
  return WIFI_AP_ENABLE;
}

static void stopSta(bool powerOffRadio) {
  WiFi.setAutoReconnect(false);
  WiFi.disconnect(powerOffRadio, false);
  delay(120);
}

static void configureSoftAp() {
  WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
  if (WiFi.softAP(AP_SSID, AP_PASS, 6, 0))
    Serial.printf("[WIFI] AP OK  SSID=%s  IP=%s\n", AP_SSID,
                  WiFi.softAPIP().toString().c_str());
  else
    Serial.println("[WIFI] AP FAILED");
}

static void startStaConnect() {
  Serial.printf("[WIFI] STA connecting to '%s'...\n", SSID_Name);
  WiFi.begin(SSID_Name, SSID_Password);
}

// ============================================================
// WiFi event handler (informational only)
// ============================================================
static void onWiFiEvent(WiFiEvent_t event) {
  switch (event) {
  case ARDUINO_EVENT_WIFI_STA_GOT_IP:
    Serial.printf("[WIFI] STA connected, IP: %s\n",
                  WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
    Serial.println("[WIFI] SNTP sync requested");
    break;
  case ARDUINO_EVENT_WIFI_AP_START:
    Serial.printf("[WIFI] AP started, SSID: %s  IP: %s\n",
                  WiFi.softAPSSID().c_str(),
                  WiFi.softAPIP().toString().c_str());
    break;
  case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
    Serial.println("[WIFI] STA disconnected");
    break;
  default:
    break;
  }
}

// ============================================================
// ** SINGLE SOURCE OF TRUTH for WiFi.mode() **
// Connectivity policy:
//   - STA follows hardcoded credentials.
//   - AP host TV_DEVICE follows the saved config.
// ============================================================
void initWiFi() {
  WiFi.persistent(false);
  WiFi.setSleep(WIFI_PS_MIN_MODEM);
  WiFi.setAutoReconnect(true);
  WiFi.onEvent(onWiFiEvent);

  if (shouldStartSta() && shouldStartAp()) {
    Serial.println("[WIFI] Mode=AP+STA");
    WiFi.mode(WIFI_MODE_APSTA);
    configureSoftAp();
    stopSta(false);
    WiFi.setAutoReconnect(true);
    startStaConnect();
  } else if (shouldStartSta()) {
    Serial.println("[WIFI] Mode=STA only (AP host disabled by config)");
    WiFi.mode(WIFI_MODE_STA);
    stopSta(false);
    WiFi.setAutoReconnect(true);
    startStaConnect();
  } else {
    WiFi.mode(WIFI_MODE_AP);
    configureSoftAp();
    Serial.println("[WIFI] Mode=AP only (no STA credentials)");
  }

  unsigned long t0 = millis();
  while (shouldStartSta() && WiFi.status() != WL_CONNECTED &&
         millis() - t0 < 8000) {
    delay(400);
    Serial.print(".");
  }

  if (shouldStartSta() && WiFi.status() == WL_CONNECTED)
    Serial.printf("\n[WIFI] STA OK  IP=%s\n",
                  WiFi.localIP().toString().c_str());
  else if (shouldStartSta())
    Serial.println("\n[WIFI] STA failed");
  else
    Serial.println("\n[WIFI] AP-only mode active");
}

void wifiEnterScanMode() {
  WiFi.setAutoReconnect(false);
  WiFi.disconnect(true, false);
  delay(100);
  WiFi.mode(WIFI_MODE_STA);
  delay(100);
  WiFi.disconnect(true, false);
  delay(100);
}

void wifiRestoreApStaMode() {
  if (shouldStartSta() && shouldStartAp()) {
    Serial.println("[WIFI] Reconfiguring WiFi: AP+STA");
    WiFi.mode(WIFI_MODE_APSTA);
    WiFi.setSleep(WIFI_PS_MIN_MODEM);
    configureSoftAp();
    stopSta(false);
    WiFi.setAutoReconnect(true);
    startStaConnect();
    return;
  }

  if (shouldStartSta()) {
    Serial.println("[WIFI] Reconfiguring WiFi: STA only (AP host disabled)");
    WiFi.mode(WIFI_MODE_STA);
    WiFi.setSleep(WIFI_PS_MIN_MODEM);
    stopSta(false);
    WiFi.setAutoReconnect(true);
    startStaConnect();
    return;
  }

  Serial.println("[WIFI] Reconfiguring WiFi: AP only (no STA credentials)");
  stopSta(true);
  WiFi.mode(WIFI_MODE_AP);
  WiFi.setSleep(WIFI_PS_MIN_MODEM);
  configureSoftAp();
}
