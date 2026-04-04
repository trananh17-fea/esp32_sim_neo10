#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <WiFi.h>

// The ONLY place WiFi mode is configured. Do NOT set WiFi.mode() elsewhere.
void initWiFi();

#endif