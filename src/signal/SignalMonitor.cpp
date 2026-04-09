#include "SignalMonitor.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include <WiFi.h>
#include <nvs.h>

// ============================================================
// WiFi RSSI → 0..10
//
// Linear mapping: -100 dBm = 0, -50 dBm = 10
// Formula: level = (rssi + 100) / 5, clamped to 0..10
//
//   RSSI    Level
//   -50     10
//   -55      9
//   -60      8
//   -65      7
//   -70      6
//   -75      5
//   -80      4
//   -85      3
//   -90      2
//   -95      1
//   -100     0
// ============================================================
int wifi_getSignalLevel(int *rawRssi) {
  if (WiFi.status() != WL_CONNECTED)
    return 0;
  int rssi = WiFi.RSSI();
  if (rawRssi)
    *rawRssi = rssi;
  int level = (rssi + 100) / 5;
  if (level < 0)
    level = 0;
  if (level > 10)
    level = 10;
  return level;
}

// ============================================================
// CSQ → 0..10
//
// Linear mapping: CSQ 0-31 maps to level 0-10
// Formula: level = csq * 10 / 31
//
//   CSQ  dBm(-113+2*csq)  Level
//    0    -113              0
//    3    -107              0
//    6    -101              1
//    9     -95              2
//   12     -89              3
//   15     -83              4
//   18     -77              5
//   21     -71              6
//   24     -65              7
//   27     -59              8
//   28     -57              9
//   31     -51             10
//   99   unknown            0
// ============================================================
static int csqToLevel(int csq) {
  if (csq >= 99 || csq <= 0)
    return 0;
  int level = csq * 10 / 31;
  if (level > 10)
    level = 10;
  return level;
}

// ============================================================
// Get combined signal level — ALWAYS updates globals!
// ============================================================
static int getSignalLevel() {
  // WiFi
  int rssi = 0;
  int levelWiFi = wifi_getSignalLevel(&rssi);

  // 4G
  int csq = 99;
  int level4G = 0;
  if (SIM_hasCapability(SIM_CAP_RADIO_OK)) {
    sim_isRegistered(); // keep voice/data gating in sync as network comes/goes
    csq = sim_readCSQ();
    level4G = csqToLevel(csq);
  }
  telemetrySetSignalLevels(level4G, levelWiFi, csq, rssi);

  // Combined: prefer 4G (primary comms for SMS/call)
  if (SIM_hasCapability(SIM_CAP_VOICE_SMS_OK) && level4G > 0)
    return level4G;
  return levelWiFi;
}

static void refreshBatteryTelemetry() {
  if (!SIM_hasCapability(SIM_CAP_RADIO_OK)) {
    telemetrySetBatteryStatus(false, -1, 0.0f);
    return;
  }

  int batteryPercent = -1;
  float batteryVoltageV = 0.0f;
  if (SIM_getBatteryStatus(&batteryPercent, &batteryVoltageV)) {
    telemetrySetBatteryStatus(true, batteryPercent, batteryVoltageV);
    return;
  }

  telemetrySetBatteryStatus(false, -1, 0.0f);
}

// ============================================================
// Send warning — SMS always, optional call per SIGNAL_WARN_CALL_MODE
//   0 = SMS only (default)
//   1 = SMS + call HOTLINE only
//   2 = SMS + call cascade (CALL1..3 then HOTLINE)
// ============================================================
static void sendWarning() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  String link = getGPSLink();
  String msg = "Canh bao sap mat song! Vi tri: " + link;

  int sent = 0;
  const char *nums[] = {cfg.call1, cfg.call2, cfg.call3};
  for (int i = 0; i < 3; i++) {
    if (strlen(nums[i]) >= 3) {
      SIM7680C_sendSMS_to(nums[i], msg);
      logPrintf("[SIGNAL] warn_sms_sent to=%s", nums[i]);
      sent++;
    }
  }
  if (sent == 0)
    logLine("[SIGNAL] warn: no phone numbers configured!");

  if (cfg.signalWarnCallMode == 1 && strlen(cfg.hotline) >= 3) {
    logPrintf("[SIGNAL] warn_call_hotline_started hotline=%s ring=%ds",
              cfg.hotline, cfg.ringSeconds);
    SIM7680C_callNumber(cfg.hotline, cfg.ringSeconds);
  } else if (cfg.signalWarnCallMode == 2) {
    logLine("[SIGNAL] warn_call_cascade_started");
    SIM7680C_callCascade();
  } else {
    logLine("[SIGNAL] warn_call_mode=off (SMS only)");
  }
}

// ============================================================
// Signal Monitor Task
//
// CRITICAL: Always samples signal even if warnings are disabled!
// This powers SIGNAL_4G/SIGNAL_WIFI/SIGNAL_CSQ_RAW/SIGNAL_RSSI_RAW
// which are read by the [MON] monitor task.
// ============================================================
#define SAMPLE_INTERVAL_MS 60000
#define HISTORY_SIZE 6

void signalMonitorTask(void *pvParameters) {
  logLine("[SIGNAL] Monitor task started");
  vTaskDelay(pdMS_TO_TICKS(10000)); // wait for modem init

  int history[HISTORY_SIZE] = {5, 5, 5, 5, 5, 5};
  int histIdx = 0;
  unsigned long lastWarnMs = 0;

  while (true) {
    // *** ALWAYS update signal levels (this was the critical bug) ***
    int level = getSignalLevel();
    refreshBatteryTelemetry();

    // --- Warning logic: only runs if enabled ---
    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);
    if (cfg.signalWarnEnable && !telemetryIsSosActive()) {
      history[histIdx] = level;
      histIdx = (histIdx + 1) % HISTORY_SIZE;

      unsigned long cooldownMs =
          (unsigned long)cfg.signalWarnCooldownMin * 60000UL;
      bool inCooldown =
          (lastWarnMs > 0 && (millis() - lastWarnMs) < cooldownMs);

      if (!inCooldown) {
        bool trigger = false;

        // Rule 1: Rapid drop >= 3 levels
        int maxRecent = 0;
        for (int i = 0; i < HISTORY_SIZE; i++) {
          if (history[i] > maxRecent)
            maxRecent = history[i];
        }
        if (maxRecent - level >= 3) {
          logPrintf("[SIGNAL] Rapid drop: %d -> %d", maxRecent, level);
          trigger = true;
        }

        // Rule 2: Sustained low <= 3 for 3 consecutive
        if (!trigger) {
          int lowCount = 0;
          for (int i = 0; i < 3; i++) {
            int idx = (histIdx - 1 - i + HISTORY_SIZE) % HISTORY_SIZE;
            if (history[idx] <= 3)
              lowCount++;
          }
          if (lowCount >= 3) {
            logPrintf("[SIGNAL] Sustained low (%d consecutive)", lowCount);
            trigger = true;
          }
        }

        if (trigger) {
          logPrintf("[SIGNAL] TRIGGER! Level=%d", level);
          sendWarning();
          lastWarnMs = millis();
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(SAMPLE_INTERVAL_MS));
  }
}
