#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>

// The ONLY place WiFi mode is configured. Do NOT set WiFi.mode() elsewhere.
void initWiFi();
void wifiEnterScanMode();
void wifiRestoreApStaMode();
const char *wifiStaHostname();
String wifiStaHostnameFqdn();
String wifiStaHostnameUrl();
String wifiStaIpString();

#endif
