#ifndef CONFIG_H
#define CONFIG_H
#include <Arduino.h>
#include <nvs.h>
#include <nvs_flash.h>

// ============================================================
// Global shared state
// ============================================================
extern nvs_handle_t nvsHandle;
extern SemaphoreHandle_t serialMutex;

// --- GPS state ---
extern double GPS_LAT;
extern double GPS_LNG;
extern String GPS_LINK;
extern bool GPS_READY;
extern bool ASSIST_READY;

// --- Multi-phone config (NVS) ---
extern char CALL_1[37];
extern char CALL_2[37];
extern char CALL_3[37];
extern char HOTLINE_NUMBER[37];
extern int RING_SECONDS;
extern char SMS_TEMPLATE[256];

// --- Geofence config (NVS) ---
extern bool GEOFENCE_ENABLE;
extern double HOME_LAT;
extern double HOME_LNG;
extern int GEOFENCE_RADIUS_M;

// --- Signal warning config (NVS) ---
extern bool SIGNAL_WARN_ENABLE;
extern int SIGNAL_WARN_COOLDOWN_MIN;
extern int SIGNAL_WARN_CALL_MODE;
// 0 = SMS only (default)
// 1 = SMS + call HOTLINE
// 2 = SMS + call cascade (CALL1..3 then HOTLINE)

// --- AssistNow ---
extern char ASSIST_CHIPCODE[64];
extern char ASSIST_TOKEN[128];

// --- SIM tracking ---
extern bool SIM_TRACKING_ENABLE;

// --- Runtime flags ---
extern volatile bool SIM_READY;
extern volatile bool SOS_ACTIVE;
extern volatile int SIGNAL_4G;
extern volatile int SIGNAL_WIFI;
extern volatile int SIGNAL_CSQ_RAW;
extern volatile int SIGNAL_RSSI_RAW;

// --- Monitor state ---
extern volatile unsigned long FIRST_FIX_MS;
extern volatile unsigned long BOOT_MS;
extern const char *ASSIST_STATUS;
extern volatile int TRACK_WIFI_CODE;
extern volatile int TRACK_SIM_CODE;

// Legacy compat
extern char PHONE[37];
extern char SMS[256];

// Thread-safe log helper
static inline void serialLog(const char *line) {
  if (serialMutex)
    xSemaphoreTake(serialMutex, pdMS_TO_TICKS(100));
  Serial.println(line);
  if (serialMutex)
    xSemaphoreGive(serialMutex);
}

#endif