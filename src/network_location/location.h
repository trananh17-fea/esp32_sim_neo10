#pragma once
#include "Config.h"

// ============================================================
// Network location: hybrid geolocation using cell + nearby WiFi
//
// Provides coarse location when GPS is unavailable.
// Tuned for deployments where WiFi is rare or unreliable.
//
// Attempt order:
//   1. Hybrid geolocation via SIM internet (cell + scanned WiFi BSSIDs)
//   2. Cell geolocation via AT+CLBS
//   3. Cell-only geolocation via SIM internet
//   4. WiFi geolocation API when STA is connected
//
// Task behavior:
//   - Wait 8s after boot
//   - Skip while GPS is fresh
//   - Skip while SOS is active
//   - Refresh every 30 minutes if GPS is still unavailable
//
// Requires:
//   - NETLOC_API_KEY for WiFi geolocation API
//   - NETLOC_PROVIDER = google or unwiredlabs
//
// Log tag: [NETLOC]
// ============================================================

bool acquireNetworkLocationNow();
void networkLocationTask(void *pvParameters);
String getLastWiFiScanDebugJson();
