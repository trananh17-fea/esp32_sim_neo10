#include "WiFiManager.h"
#include "server.h"
#include <time.h>

static constexpr const char *AP_SSID = "TV_DEVICE";
static constexpr const char *AP_PASS = "123456788";
static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_MASK(255, 255, 255, 0);

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
// Sets APSTA so AP is always available + STA can connect to router.
// ============================================================
void initWiFi() {
  WiFi.persistent(false);
  WiFi.mode(WIFI_MODE_APSTA); // <-- THE ONLY WiFi.mode() call
  WiFi.setSleep(WIFI_PS_NONE);
  WiFi.setAutoReconnect(true);
  WiFi.onEvent(onWiFiEvent);

  configureSoftAp();
  startStaConnect();

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED)
    Serial.printf("\n[WIFI] STA OK  IP=%s\n",
                  WiFi.localIP().toString().c_str());
  else
    Serial.println("\n[WIFI] STA failed (AP still running)");
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
  WiFi.mode(WIFI_MODE_APSTA);
  WiFi.setSleep(WIFI_PS_NONE);
  configureSoftAp();
  if (strlen(SSID_Name) > 0)
    startStaConnect();
  WiFi.setAutoReconnect(true);
}
