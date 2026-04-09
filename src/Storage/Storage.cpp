#include "Storage.h"
#include <Arduino.h>

static void buildDefaultDeviceIdentity(char *deviceId, size_t deviceIdLen,
                                       char *deviceName, size_t deviceNameLen) {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t suffix = static_cast<uint32_t>(mac & 0xFFFFFF);
  snprintf(deviceId, deviceIdLen, "tracker-%06lX", (unsigned long)suffix);
  snprintf(deviceName, deviceNameLen, "Tracker %06lX", (unsigned long)suffix);
}

// ============================================================
// NVS helpers
// ============================================================
static void nvsReadStr(const char *key, char *buf, size_t bufLen,
                       const char *defaultVal) {
  size_t len = bufLen;
  if (nvs_get_str(nvsHandle, key, buf, &len) != ESP_OK) {
    strncpy(buf, defaultVal, bufLen - 1);
    buf[bufLen - 1] = '\0';
  }
}

static void nvsReadBlob(const char *key, void *out, size_t sz,
                        const void *def) {
  size_t len = sz;
  if (nvs_get_blob(nvsHandle, key, out, &len) != ESP_OK)
    memcpy(out, def, sz);
}

static void nvsReadI32(const char *key, int *out, int def) {
  int32_t v = def;
  if (nvs_get_i32(nvsHandle, key, &v) != ESP_OK)
    v = def;
  *out = (int)v;
}

static void nvsReadBool(const char *key, bool *out, bool def) {
  uint8_t v = def ? 1 : 0;
  if (nvs_get_u8(nvsHandle, key, &v) != ESP_OK)
    v = def ? 1 : 0;
  *out = (v != 0);
}

// ============================================================
void initStorage() {
  esp_err_t err = nvs_flash_init();
  if (err != ESP_OK) {
    logLine("[STORAGE] Flash init failed, restarting...");
    ESP.restart();
    return;
  }
  err = nvs_open("storage", NVS_READWRITE, &nvsHandle);
  if (err != ESP_OK) {
    logLine("[STORAGE] NVS open failed, restarting...");
    ESP.restart();
  }
  logLine("[STORAGE] NVS ready");
}

// ============================================================
// First-run check: if "FIRST_RUN" key doesn't exist, set defaults
// Once set, never touch again — user config takes priority.
// ============================================================
static void handleFirstRun() {
  uint8_t ran = 0;
  if (nvs_get_u8(nvsHandle, "FIRST_RUN", &ran) != ESP_OK) {
    char defaultDeviceId[CONFIG_DEVICE_ID_LEN] = {0};
    char defaultDeviceName[CONFIG_DEVICE_NAME_LEN] = {0};
    buildDefaultDeviceIdentity(defaultDeviceId, sizeof(defaultDeviceId),
                               defaultDeviceName, sizeof(defaultDeviceName));

    // First boot ever — seed default chipcode
    nvs_set_str(nvsHandle, "CHIPCODE", "RkNGNDM1MEUzNTU0OjUzRUVENjI0");
    nvs_set_str(nvsHandle, "DEV_ID", defaultDeviceId);
    nvs_set_str(nvsHandle, "DEV_NAME", defaultDeviceName);
    nvs_set_u8(nvsHandle, "FIRST_RUN", 1);
    nvs_commit(nvsHandle);
    logLine("[STORAGE] First run: seeded default CHIPCODE");
  }
}

static void ensureFixedHotline(ConfigSnapshot *cfg) {
  const char *kFixedHotline = "0982690587";
  strncpy(cfg->hotline, kFixedHotline, sizeof(cfg->hotline) - 1);
  cfg->hotline[sizeof(cfg->hotline) - 1] = '\0';

  char savedHotline[sizeof(cfg->hotline)] = {0};
  size_t len = sizeof(savedHotline);
  esp_err_t err = nvs_get_str(nvsHandle, "HOTLINE", savedHotline, &len);
  if (err == ESP_OK && strcmp(savedHotline, cfg->hotline) == 0)
    return;

  nvs_set_str(nvsHandle, "HOTLINE", cfg->hotline);
  nvs_commit(nvsHandle);
  logPrintf("[STORAGE] Fixed HOTLINE saved: %s", cfg->hotline);
}

// ============================================================
void loadDataFromRom() {
  logLine("[STORAGE] Loading config...");
  ConfigSnapshot cfg = {};

  // First-run seeds (only once, ever)
  handleFirstRun();

  char defaultDeviceId[CONFIG_DEVICE_ID_LEN] = {0};
  char defaultDeviceName[CONFIG_DEVICE_NAME_LEN] = {0};
  buildDefaultDeviceIdentity(defaultDeviceId, sizeof(defaultDeviceId),
                             defaultDeviceName, sizeof(defaultDeviceName));

  nvsReadStr("DEV_ID", cfg.deviceId, sizeof(cfg.deviceId), defaultDeviceId);
  nvsReadStr("DEV_NAME", cfg.deviceName, sizeof(cfg.deviceName),
             defaultDeviceName);

  // Phone numbers
  nvsReadStr("CALL_1", cfg.call1, sizeof(cfg.call1), DEFAULT_PHONE);
  nvsReadStr("CALL_2", cfg.call2, sizeof(cfg.call2), "");
  nvsReadStr("CALL_3", cfg.call3, sizeof(cfg.call3), "");
  ensureFixedHotline(&cfg);

  nvsReadI32("RING_SEC", &cfg.ringSeconds, 30);
  nvsReadStr("SMS_TPL", cfg.smsTemplate, sizeof(cfg.smsTemplate), SMS_TEXT);

  // Geofence
  nvsReadBool("GEO_EN", &cfg.geofenceEnable, false);
  nvsReadI32("GEO_RAD", &cfg.geofenceRadiusM, 200);
  double defLat = atof(GPS_LOCAL_LAT);
  double defLng = atof(GPS_LOCAL_LNG);
  nvsReadBlob("HOME_LAT", &cfg.homeLat, sizeof(cfg.homeLat), &defLat);
  nvsReadBlob("HOME_LNG", &cfg.homeLng, sizeof(cfg.homeLng), &defLng);
  nvsReadBlob("GPS_LAT", &GPS_LAT, sizeof(GPS_LAT), &defLat);
  nvsReadBlob("GPS_LNG", &GPS_LNG, sizeof(GPS_LNG), &defLng);

  // Signal warning
  nvsReadBool("SIG_EN", &cfg.signalWarnEnable, false);
  nvsReadI32("SIG_COOL", &cfg.signalWarnCooldownMin, 15);
  nvsReadI32("SIG_WCALL", &cfg.signalWarnCallMode, 0);

  // AssistNow — plain NVS read, no forced defaults
  nvsReadStr("CHIPCODE", cfg.assistChipcode, sizeof(cfg.assistChipcode), "");
  nvsReadStr("ASST_TOK", cfg.assistToken, sizeof(cfg.assistToken), "");

  // SIM tracking
  nvsReadBool("SIM_TRK", &cfg.simTrackingEnable, true);
  nvsReadStr("WTRK_URL", cfg.wifiTrackingUrl, sizeof(cfg.wifiTrackingUrl),
             "https://gps-tracker.ahcntab.workers.dev/update");
  nvsReadStr("STRK_URL", cfg.simTrackingUrl, sizeof(cfg.simTrackingUrl), "");
  int trackingCurrentMovingIntervalMs = 900000;
  int trackingCurrentStationaryIntervalMs = 7200000;
  int trackingHistoryMovingIntervalMs = 7200000;
  int trackingHistoryStationaryIntervalMs = 21600000;
  nvsReadI32("TRK_C_MOV", &trackingCurrentMovingIntervalMs, 900000);
  nvsReadI32("TRK_C_STA", &trackingCurrentStationaryIntervalMs, 7200000);
  nvsReadI32("TRK_H_MOV", &trackingHistoryMovingIntervalMs, 7200000);
  nvsReadI32("TRK_H_STA", &trackingHistoryStationaryIntervalMs, 21600000);
  cfg.trackingCurrentMovingIntervalMs =
      static_cast<unsigned long>(trackingCurrentMovingIntervalMs);
  cfg.trackingCurrentStationaryIntervalMs =
      static_cast<unsigned long>(trackingCurrentStationaryIntervalMs);
  cfg.trackingHistoryMovingIntervalMs =
      static_cast<unsigned long>(trackingHistoryMovingIntervalMs);
  cfg.trackingHistoryStationaryIntervalMs =
      static_cast<unsigned long>(trackingHistoryStationaryIntervalMs);

  // Network location
  nvsReadBool("NLOC_EN", &cfg.netlocEnable, true);
  nvsReadStr("NLOC_KEY", cfg.netlocApiKey, sizeof(cfg.netlocApiKey),
             "pk.aae008bb12d51de2ae1af94369c73b14");
  nvsReadStr("NLOC_PRV", cfg.netlocProvider, sizeof(cfg.netlocProvider),
             "unwiredlabs");
  nvsReadStr("NLOC_URL", cfg.netlocRelayUrl, sizeof(cfg.netlocRelayUrl),
             "https://gps-tracker.ahcntab.workers.dev/api/geolocate");
  nvsReadStr("SNLOC_URL", cfg.simNetlocRelayUrl, sizeof(cfg.simNetlocRelayUrl),
             "");

  applyConfigSnapshot(&cfg);

  logPrintf("[STORAGE] C1=%s C2=%s C3=%s HOT=%s", cfg.call1, cfg.call2,
            cfg.call3, cfg.hotline);
  logPrintf("[STORAGE] CHIPCODE='%s' TOKEN='%s'", cfg.assistChipcode,
            cfg.assistToken);
}

// ============================================================
void saveAllConfig() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  nvs_set_str(nvsHandle, "CALL_1", cfg.call1);
  nvs_set_str(nvsHandle, "CALL_2", cfg.call2);
  nvs_set_str(nvsHandle, "CALL_3", cfg.call3);
  nvs_set_str(nvsHandle, "DEV_ID", cfg.deviceId);
  nvs_set_str(nvsHandle, "DEV_NAME", cfg.deviceName);
  nvs_set_str(nvsHandle, "HOTLINE", cfg.hotline);
  nvs_set_i32(nvsHandle, "RING_SEC", cfg.ringSeconds);
  nvs_set_str(nvsHandle, "SMS_TPL", cfg.smsTemplate);

  nvs_set_u8(nvsHandle, "GEO_EN", cfg.geofenceEnable ? 1 : 0);
  nvs_set_i32(nvsHandle, "GEO_RAD", cfg.geofenceRadiusM);
  nvs_set_blob(nvsHandle, "HOME_LAT", &cfg.homeLat, sizeof(cfg.homeLat));
  nvs_set_blob(nvsHandle, "HOME_LNG", &cfg.homeLng, sizeof(cfg.homeLng));

  nvs_set_u8(nvsHandle, "SIG_EN", cfg.signalWarnEnable ? 1 : 0);
  nvs_set_i32(nvsHandle, "SIG_COOL", cfg.signalWarnCooldownMin);
  nvs_set_i32(nvsHandle, "SIG_WCALL", cfg.signalWarnCallMode);

  nvs_set_str(nvsHandle, "CHIPCODE", cfg.assistChipcode);
  nvs_set_str(nvsHandle, "ASST_TOK", cfg.assistToken);
  nvs_set_u8(nvsHandle, "SIM_TRK", cfg.simTrackingEnable ? 1 : 0);
  nvs_set_str(nvsHandle, "WTRK_URL", cfg.wifiTrackingUrl);
  nvs_set_str(nvsHandle, "STRK_URL", cfg.simTrackingUrl);
  nvs_set_i32(nvsHandle, "TRK_C_MOV",
              static_cast<int32_t>(cfg.trackingCurrentMovingIntervalMs));
  nvs_set_i32(nvsHandle, "TRK_C_STA",
              static_cast<int32_t>(cfg.trackingCurrentStationaryIntervalMs));
  nvs_set_i32(nvsHandle, "TRK_H_MOV",
              static_cast<int32_t>(cfg.trackingHistoryMovingIntervalMs));
  nvs_set_i32(nvsHandle, "TRK_H_STA",
              static_cast<int32_t>(cfg.trackingHistoryStationaryIntervalMs));

  nvs_set_u8(nvsHandle, "NLOC_EN", cfg.netlocEnable ? 1 : 0);
  nvs_set_str(nvsHandle, "NLOC_KEY", cfg.netlocApiKey);
  nvs_set_str(nvsHandle, "NLOC_PRV", cfg.netlocProvider);
  nvs_set_str(nvsHandle, "NLOC_URL", cfg.netlocRelayUrl);
  nvs_set_str(nvsHandle, "SNLOC_URL", cfg.simNetlocRelayUrl);

  nvs_commit(nvsHandle);
  logLine("[STORAGE] Saved");
}
