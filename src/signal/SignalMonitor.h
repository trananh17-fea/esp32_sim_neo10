#pragma once
#include <Arduino.h>

// ============================================================
// Signal Monitor — samples signal every 10 seconds
//
// ALWAYS updates SIGNAL_4G, SIGNAL_WIFI, SIGNAL_CSQ_RAW,
// SIGNAL_RSSI_RAW (even when warnings are disabled!).
// [MON] task depends on these cached values.
//
// CSQ → 0..10 mapping (linear):
//   level = csq * 10 / 31
//   CSQ 28 → 9, CSQ 31 → 10, CSQ 15 → 4
//
// WiFi RSSI → 0..10 mapping (linear):
//   level = (rssi + 100) / 5
//   RSSI -58 → 8, RSSI -65 → 7, RSSI -50 → 10
//
// Warning triggers (only when SIGNAL_WARN_ENABLE=true):
//   1) Rapid drop >= 3 levels within 60s
//   2) Sustained low <= 3/10 for 3 consecutive samples
// ============================================================

void signalMonitorTask(void *pvParameters);
int wifi_getSignalLevel();
