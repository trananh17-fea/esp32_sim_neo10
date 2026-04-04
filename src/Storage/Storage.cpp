#include "Storage.h"
#include <Arduino.h>

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
    Serial.println("[STORAGE] Flash init failed, restarting...");
    ESP.restart();
    return;
  }
  err = nvs_open("storage", NVS_READWRITE, &nvsHandle);
  if (err != ESP_OK) {
    Serial.println("[STORAGE] NVS open failed, restarting...");
    ESP.restart();
  }
  Serial.println("[STORAGE] NVS ready");
}

// ============================================================
// First-run check: if "FIRST_RUN" key doesn't exist, set defaults
// Once set, never touch again — user config takes priority.
// ============================================================
static void handleFirstRun() {
  uint8_t ran = 0;
  if (nvs_get_u8(nvsHandle, "FIRST_RUN", &ran) != ESP_OK) {
    // First boot ever — seed default chipcode
    nvs_set_str(nvsHandle, "CHIPCODE", "RkNGNDM1MEUzNTU0OjUzRUVENjI0");
    nvs_set_u8(nvsHandle, "FIRST_RUN", 1);
    nvs_commit(nvsHandle);
    Serial.println("[STORAGE] First run: seeded default CHIPCODE");
  }
}

static void ensureFixedHotline() {
  const char *kFixedHotline = "0982690587";
  strncpy(HOTLINE_NUMBER, kFixedHotline, sizeof(HOTLINE_NUMBER) - 1);
  HOTLINE_NUMBER[sizeof(HOTLINE_NUMBER) - 1] = '\0';

  char savedHotline[sizeof(HOTLINE_NUMBER)] = {0};
  size_t len = sizeof(savedHotline);
  esp_err_t err = nvs_get_str(nvsHandle, "HOTLINE", savedHotline, &len);
  if (err == ESP_OK && strcmp(savedHotline, HOTLINE_NUMBER) == 0)
    return;

  nvs_set_str(nvsHandle, "HOTLINE", HOTLINE_NUMBER);
  nvs_commit(nvsHandle);
  Serial.printf("[STORAGE] Fixed HOTLINE saved: %s\n", HOTLINE_NUMBER);
}

// ============================================================
void loadDataFromRom() {
  Serial.println("[STORAGE] Loading config...");

  // First-run seeds (only once, ever)
  handleFirstRun();

  // Phone numbers
  nvsReadStr("CALL_1", CALL_1, sizeof(CALL_1), DEFAULT_PHONE);
  nvsReadStr("CALL_2", CALL_2, sizeof(CALL_2), "");
  nvsReadStr("CALL_3", CALL_3, sizeof(CALL_3), "");
  ensureFixedHotline();
  strncpy(PHONE, CALL_1, sizeof(PHONE) - 1);

  nvsReadI32("RING_SEC", &RING_SECONDS, 30);
  nvsReadStr("SMS_TPL", SMS_TEMPLATE, sizeof(SMS_TEMPLATE), SMS_TEXT);
  strncpy(SMS, SMS_TEMPLATE, sizeof(SMS) - 1);

  // Geofence
  nvsReadBool("GEO_EN", &GEOFENCE_ENABLE, false);
  nvsReadI32("GEO_RAD", &GEOFENCE_RADIUS_M, 200);
  double defLat = atof(GPS_LOCAL_LAT);
  double defLng = atof(GPS_LOCAL_LNG);
  nvsReadBlob("HOME_LAT", &HOME_LAT, sizeof(HOME_LAT), &defLat);
  nvsReadBlob("HOME_LNG", &HOME_LNG, sizeof(HOME_LNG), &defLng);
  nvsReadBlob("GPS_LAT", &GPS_LAT, sizeof(GPS_LAT), &defLat);
  nvsReadBlob("GPS_LNG", &GPS_LNG, sizeof(GPS_LNG), &defLng);

  // Signal warning
  nvsReadBool("SIG_EN", &SIGNAL_WARN_ENABLE, false);
  nvsReadI32("SIG_COOL", &SIGNAL_WARN_COOLDOWN_MIN, 15);
  nvsReadI32("SIG_WCALL", &SIGNAL_WARN_CALL_MODE, 0);

  // AssistNow — plain NVS read, no forced defaults
  nvsReadStr("CHIPCODE", ASSIST_CHIPCODE, sizeof(ASSIST_CHIPCODE), "");
  nvsReadStr("ASST_TOK", ASSIST_TOKEN, sizeof(ASSIST_TOKEN), "");

  // SIM tracking
  nvsReadBool("SIM_TRK", &SIM_TRACKING_ENABLE, true);

  Serial.printf("[STORAGE] C1=%s C2=%s C3=%s HOT=%s\n", CALL_1, CALL_2, CALL_3,
                HOTLINE_NUMBER);
  Serial.printf("[STORAGE] CHIPCODE='%s' TOKEN='%s'\n", ASSIST_CHIPCODE,
                ASSIST_TOKEN);
}

// ============================================================
void saveAllConfig() {
  strncpy(PHONE, CALL_1, sizeof(PHONE) - 1);
  strncpy(SMS, SMS_TEMPLATE, sizeof(SMS) - 1);

  nvs_set_str(nvsHandle, "CALL_1", CALL_1);
  nvs_set_str(nvsHandle, "CALL_2", CALL_2);
  nvs_set_str(nvsHandle, "CALL_3", CALL_3);
  nvs_set_str(nvsHandle, "HOTLINE", HOTLINE_NUMBER);
  nvs_set_i32(nvsHandle, "RING_SEC", RING_SECONDS);
  nvs_set_str(nvsHandle, "SMS_TPL", SMS_TEMPLATE);

  nvs_set_u8(nvsHandle, "GEO_EN", GEOFENCE_ENABLE ? 1 : 0);
  nvs_set_i32(nvsHandle, "GEO_RAD", GEOFENCE_RADIUS_M);
  nvs_set_blob(nvsHandle, "HOME_LAT", &HOME_LAT, sizeof(HOME_LAT));
  nvs_set_blob(nvsHandle, "HOME_LNG", &HOME_LNG, sizeof(HOME_LNG));

  nvs_set_u8(nvsHandle, "SIG_EN", SIGNAL_WARN_ENABLE ? 1 : 0);
  nvs_set_i32(nvsHandle, "SIG_COOL", SIGNAL_WARN_COOLDOWN_MIN);
  nvs_set_i32(nvsHandle, "SIG_WCALL", SIGNAL_WARN_CALL_MODE);

  nvs_set_str(nvsHandle, "CHIPCODE", ASSIST_CHIPCODE);
  nvs_set_str(nvsHandle, "ASST_TOK", ASSIST_TOKEN);
  nvs_set_u8(nvsHandle, "SIM_TRK", SIM_TRACKING_ENABLE ? 1 : 0);

  nvs_commit(nvsHandle);
  Serial.println("[STORAGE] Saved");
}
