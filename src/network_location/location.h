#pragma once
#include "Config.h"

// ============================================================
// Network location: cell-first geolocation with optional WiFi fallback
//
// Provides coarse location when GPS is unavailable.
// Tuned for deployments where WiFi is rare or unreliable.
//
// Attempt order:
//   1. Cell geolocation via AT+CLBS
//   2. WiFi geolocation API, only when WiFi is actually usable
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
