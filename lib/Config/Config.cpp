#include "Config.h"
#include <TinyGPSPlus.h>

extern TinyGPSPlus gps;

nvs_handle_t nvsHandle;
SemaphoreHandle_t serialMutex = NULL;
static SemaphoreHandle_t configMutex = NULL;
static SemaphoreHandle_t telemetryMutex = NULL;
static char ASSIST_STATUS_BUF[TELEMETRY_STATUS_LEN] = "not_run";

double GPS_LAT = 0.0;
double GPS_LNG = 0.0;
String GPS_LINK = "";
bool GPS_READY = false;
bool ASSIST_READY = false;
char TRACKER_DEVICE_ID[CONFIG_DEVICE_ID_LEN] = "TRACKER_KV";
char TRACKER_DEVICE_NAME[CONFIG_DEVICE_NAME_LEN] = "ESP32 Tracker";

char CALL_1[37] = "";
char CALL_2[37] = "";
char CALL_3[37] = "";
char HOTLINE_NUMBER[37] = "0982690587";
int RING_SECONDS = 30;
char SMS_TEMPLATE[256] = "I need support. Please visit at: ";

bool GEOFENCE_ENABLE = false;
double HOME_LAT = 0.0;
double HOME_LNG = 0.0;
int GEOFENCE_RADIUS_M = 200;

bool SIGNAL_WARN_ENABLE = false;
int SIGNAL_WARN_COOLDOWN_MIN = 15;
int SIGNAL_WARN_CALL_MODE = 0; // 0=SMS, 1=SMS+hotline, 2=SMS+cascade

char ASSIST_CHIPCODE[64] = ""; // no compiled-in default; loaded from NVS only
char ASSIST_TOKEN[128] = "";

bool SIM_TRACKING_ENABLE = true;

bool NETLOC_ENABLE = true;
char NETLOC_API_KEY[CONFIG_NETLOC_KEY_LEN] =
    "pk.aae008bb12d51de2ae1af94369c73b14";
char NETLOC_PROVIDER[32] =
    "unwiredlabs"; // Hoặc đổi thành "unwiredlabs" nếu dùng Unwired Labs

char NETLOC_RELAY_URL[CONFIG_NETLOC_RELAY_LEN] =
    "https://gps-tracker.ahcntab.workers.dev/api/geolocate";

volatile uint8_t SIM_CAPABILITY_LEVEL = 0;
volatile bool SOS_ACTIVE = false;
volatile bool SOS_CANCEL_REQUESTED = false;
volatile int SIGNAL_4G = 0;
volatile int SIGNAL_WIFI = 0;
volatile int SIGNAL_CSQ_RAW = 99;
volatile int SIGNAL_RSSI_RAW = 0;

volatile unsigned long FIRST_FIX_MS = 0;
volatile unsigned long LAST_GPS_UPDATE_MS = 0;
volatile unsigned long BOOT_MS = 0;
const char *ASSIST_STATUS = ASSIST_STATUS_BUF;
volatile int TRACK_WIFI_CODE = 0;
volatile int TRACK_SIM_CODE = 0;

// --- Network location state ---
static volatile bool NETLOC_READY = false;
static volatile double NETLOC_LAT = 0.0;
static volatile double NETLOC_LNG = 0.0;
static volatile float NETLOC_ACC = 0.0f;
static volatile unsigned long NETLOC_AT_MS = 0;
static volatile LocationSource NETLOC_SOURCE = LOC_NONE;
static volatile bool FUSED_READY = false;
static volatile double FUSED_LAT = 0.0;
static volatile double FUSED_LNG = 0.0;
static volatile float FUSED_ACC = 99999.0f;
static volatile unsigned long FUSED_AT_MS = 0;
static volatile LocationSource FUSED_SOURCE = LOC_NONE;

char PHONE[37] = "";
char SMS[256] = "";

static inline void lockConfig() {
  if (configMutex)
    xSemaphoreTake(configMutex, portMAX_DELAY);
}

static inline void unlockConfig() {
  if (configMutex)
    xSemaphoreGive(configMutex);
}

static inline void lockTelemetry() {
  if (telemetryMutex)
    xSemaphoreTake(telemetryMutex, portMAX_DELAY);
}

static inline void unlockTelemetry() {
  if (telemetryMutex)
    xSemaphoreGive(telemetryMutex);
}

static bool isValidCoordPair(double lat, double lng) {
  if (lat < -90.0 || lat > 90.0)
    return false;
  if (lng < -180.0 || lng > 180.0)
    return false;
  if (lat == 0.0 && lng == 0.0)
    return false;
  return true;
}

static float estimateGpsAccuracyM() {
  float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.9f;
  int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;

  float acc = hdop * 5.0f;
  if (sats < 4)
    acc *= 2.5f;
  else if (sats < 6)
    acc *= 1.5f;

  if (acc < 5.0f)
    acc = 5.0f;
  if (acc > 80.0f)
    acc = 80.0f;
  return acc;
}

static double distanceMeters(double latA, double lngA, double latB, double lngB) {
  if (!isValidCoordPair(latA, lngA) || !isValidCoordPair(latB, lngB))
    return -1.0;
  const double R = 6371000.0;
  const double toRad = PI / 180.0;
  const double dLat = (latB - latA) * toRad;
  const double dLng = (lngB - lngA) * toRad;
  const double a = sin(dLat / 2.0) * sin(dLat / 2.0) +
                   cos(latA * toRad) * cos(latB * toRad) *
                       sin(dLng / 2.0) * sin(dLng / 2.0);
  return R * 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
}

static bool isTrustedNetworkCandidate(LocationSource source, float accuracyM) {
  if (source == LOC_WIFI_GEO)
    return accuracyM > 0.0f && accuracyM <= 1500.0f;
  if (source == LOC_CELL_GEO)
    return accuracyM > 0.0f && accuracyM <= 1200.0f;
  return false;
}

static bool passesJumpGate(double lat, double lng, float accuracyM,
                           LocationSource source, unsigned long nowMs) {
  if (!FUSED_READY || !isValidCoordPair(FUSED_LAT, FUSED_LNG))
    return true;

  const unsigned long ageMs = nowMs - FUSED_AT_MS;
  if (ageMs > 1800000UL)
    return true;

  const double jumpM = distanceMeters(lat, lng, FUSED_LAT, FUSED_LNG);
  if (jumpM < 0.0)
    return true;

  if (source == LOC_GPS)
    return true;

  const double allowedM =
      max(400.0, 2.5 * max<double>(accuracyM, static_cast<double>(FUSED_ACC)));
  return jumpM <= allowedM;
}

static void rememberFusedLocation(const BestLocationResult &result, unsigned long nowMs) {
  FUSED_READY = result.valid;
  if (!result.valid)
    return;
  FUSED_LAT = result.lat;
  FUSED_LNG = result.lng;
  FUSED_ACC = result.accuracyM;
  FUSED_AT_MS = nowMs;
  FUSED_SOURCE = result.source;
}

static void syncLegacyUnlocked() {
  strncpy(PHONE, CALL_1, sizeof(PHONE) - 1);
  PHONE[sizeof(PHONE) - 1] = '\0';
  strncpy(SMS, SMS_TEMPLATE, sizeof(SMS) - 1);
  SMS[sizeof(SMS) - 1] = '\0';
}

void initSharedState() {
  if (!configMutex)
    configMutex = xSemaphoreCreateMutex();
  if (!telemetryMutex)
    telemetryMutex = xSemaphoreCreateMutex();
}

void getConfigSnapshot(ConfigSnapshot *out) {
  if (!out)
    return;

  lockConfig();
  strncpy(out->deviceId, TRACKER_DEVICE_ID, sizeof(out->deviceId) - 1);
  out->deviceId[sizeof(out->deviceId) - 1] = '\0';
  strncpy(out->deviceName, TRACKER_DEVICE_NAME, sizeof(out->deviceName) - 1);
  out->deviceName[sizeof(out->deviceName) - 1] = '\0';
  strncpy(out->call1, CALL_1, sizeof(out->call1) - 1);
  out->call1[sizeof(out->call1) - 1] = '\0';
  strncpy(out->call2, CALL_2, sizeof(out->call2) - 1);
  out->call2[sizeof(out->call2) - 1] = '\0';
  strncpy(out->call3, CALL_3, sizeof(out->call3) - 1);
  out->call3[sizeof(out->call3) - 1] = '\0';
  strncpy(out->hotline, HOTLINE_NUMBER, sizeof(out->hotline) - 1);
  out->hotline[sizeof(out->hotline) - 1] = '\0';
  out->ringSeconds = RING_SECONDS;
  strncpy(out->smsTemplate, SMS_TEMPLATE, sizeof(out->smsTemplate) - 1);
  out->smsTemplate[sizeof(out->smsTemplate) - 1] = '\0';
  out->geofenceEnable = GEOFENCE_ENABLE;
  out->homeLat = HOME_LAT;
  out->homeLng = HOME_LNG;
  out->geofenceRadiusM = GEOFENCE_RADIUS_M;
  out->signalWarnEnable = SIGNAL_WARN_ENABLE;
  out->signalWarnCooldownMin = SIGNAL_WARN_COOLDOWN_MIN;
  out->signalWarnCallMode = SIGNAL_WARN_CALL_MODE;
  strncpy(out->assistChipcode, ASSIST_CHIPCODE,
          sizeof(out->assistChipcode) - 1);
  out->assistChipcode[sizeof(out->assistChipcode) - 1] = '\0';
  strncpy(out->assistToken, ASSIST_TOKEN, sizeof(out->assistToken) - 1);
  out->assistToken[sizeof(out->assistToken) - 1] = '\0';
  out->simTrackingEnable = SIM_TRACKING_ENABLE;
  out->netlocEnable = NETLOC_ENABLE;
  strncpy(out->netlocApiKey, NETLOC_API_KEY, sizeof(out->netlocApiKey) - 1);
  out->netlocApiKey[sizeof(out->netlocApiKey) - 1] = '\0';
  strncpy(out->netlocProvider, NETLOC_PROVIDER,
          sizeof(out->netlocProvider) - 1);
  out->netlocProvider[sizeof(out->netlocProvider) - 1] = '\0';
  strncpy(out->netlocRelayUrl, NETLOC_RELAY_URL,
          sizeof(out->netlocRelayUrl) - 1);
  out->netlocRelayUrl[sizeof(out->netlocRelayUrl) - 1] = '\0';
  unlockConfig();
}

void applyConfigSnapshot(const ConfigSnapshot *snapshot) {
  if (!snapshot)
    return;

  lockConfig();
  strncpy(TRACKER_DEVICE_ID, snapshot->deviceId, sizeof(TRACKER_DEVICE_ID) - 1);
  TRACKER_DEVICE_ID[sizeof(TRACKER_DEVICE_ID) - 1] = '\0';
  strncpy(TRACKER_DEVICE_NAME, snapshot->deviceName,
          sizeof(TRACKER_DEVICE_NAME) - 1);
  TRACKER_DEVICE_NAME[sizeof(TRACKER_DEVICE_NAME) - 1] = '\0';
  strncpy(CALL_1, snapshot->call1, sizeof(CALL_1) - 1);
  CALL_1[sizeof(CALL_1) - 1] = '\0';
  strncpy(CALL_2, snapshot->call2, sizeof(CALL_2) - 1);
  CALL_2[sizeof(CALL_2) - 1] = '\0';
  strncpy(CALL_3, snapshot->call3, sizeof(CALL_3) - 1);
  CALL_3[sizeof(CALL_3) - 1] = '\0';
  strncpy(HOTLINE_NUMBER, snapshot->hotline, sizeof(HOTLINE_NUMBER) - 1);
  HOTLINE_NUMBER[sizeof(HOTLINE_NUMBER) - 1] = '\0';
  RING_SECONDS = snapshot->ringSeconds;
  strncpy(SMS_TEMPLATE, snapshot->smsTemplate, sizeof(SMS_TEMPLATE) - 1);
  SMS_TEMPLATE[sizeof(SMS_TEMPLATE) - 1] = '\0';
  GEOFENCE_ENABLE = snapshot->geofenceEnable;
  HOME_LAT = snapshot->homeLat;
  HOME_LNG = snapshot->homeLng;
  GEOFENCE_RADIUS_M = snapshot->geofenceRadiusM;
  SIGNAL_WARN_ENABLE = snapshot->signalWarnEnable;
  SIGNAL_WARN_COOLDOWN_MIN = snapshot->signalWarnCooldownMin;
  SIGNAL_WARN_CALL_MODE = snapshot->signalWarnCallMode;
  strncpy(ASSIST_CHIPCODE, snapshot->assistChipcode,
          sizeof(ASSIST_CHIPCODE) - 1);
  ASSIST_CHIPCODE[sizeof(ASSIST_CHIPCODE) - 1] = '\0';
  strncpy(ASSIST_TOKEN, snapshot->assistToken, sizeof(ASSIST_TOKEN) - 1);
  ASSIST_TOKEN[sizeof(ASSIST_TOKEN) - 1] = '\0';
  SIM_TRACKING_ENABLE = snapshot->simTrackingEnable;
  NETLOC_ENABLE = snapshot->netlocEnable;
  strncpy(NETLOC_API_KEY, snapshot->netlocApiKey, sizeof(NETLOC_API_KEY) - 1);
  NETLOC_API_KEY[sizeof(NETLOC_API_KEY) - 1] = '\0';
  strncpy(NETLOC_PROVIDER, snapshot->netlocProvider,
          sizeof(NETLOC_PROVIDER) - 1);
  NETLOC_PROVIDER[sizeof(NETLOC_PROVIDER) - 1] = '\0';
  strncpy(NETLOC_RELAY_URL, snapshot->netlocRelayUrl,
          sizeof(NETLOC_RELAY_URL) - 1);
  NETLOC_RELAY_URL[sizeof(NETLOC_RELAY_URL) - 1] = '\0';
  syncLegacyUnlocked();
  unlockConfig();
}

void updateHomeConfig(double lat, double lng) {
  lockConfig();
  HOME_LAT = lat;
  HOME_LNG = lng;
  unlockConfig();
}

void getTelemetrySnapshot(TelemetrySnapshot *out) {
  if (!out)
    return;

  lockTelemetry();
  out->gpsReady = GPS_READY;
  out->assistReady = ASSIST_READY;
  out->simCapabilityLevel = SIM_CAPABILITY_LEVEL;
  out->sosActive = SOS_ACTIVE;
  out->sosCancelRequested = SOS_CANCEL_REQUESTED;
  out->signal4G = SIGNAL_4G;
  out->signalWiFi = SIGNAL_WIFI;
  out->signalCsqRaw = SIGNAL_CSQ_RAW;
  out->signalRssiRaw = SIGNAL_RSSI_RAW;
  out->firstFixMs = FIRST_FIX_MS;
  out->lastGpsUpdateMs = LAST_GPS_UPDATE_MS;
  out->bootMs = BOOT_MS;
  out->trackWifiCode = TRACK_WIFI_CODE;
  out->trackSimCode = TRACK_SIM_CODE;
  strncpy(out->assistStatus, ASSIST_STATUS ? ASSIST_STATUS : "",
          sizeof(out->assistStatus) - 1);
  out->assistStatus[sizeof(out->assistStatus) - 1] = '\0';
  out->networkLocReady = NETLOC_READY;
  out->networkLocLat = NETLOC_LAT;
  out->networkLocLng = NETLOC_LNG;
  out->networkLocAccuracyM = NETLOC_ACC;
  out->networkLocAtMs = NETLOC_AT_MS;
  out->networkLocSource = (LocationSource)NETLOC_SOURCE;
  unlockTelemetry();
}

void telemetrySetGpsReady(bool ready, unsigned long firstFixMs) {
  lockTelemetry();
  GPS_READY = ready;
  FIRST_FIX_MS = firstFixMs;
  unlockTelemetry();
}

void telemetrySetLastGpsUpdate() {
  lockTelemetry();
  LAST_GPS_UPDATE_MS = millis();
  unlockTelemetry();
}

void telemetrySetAssistReady(bool ready) {
  lockTelemetry();
  ASSIST_READY = ready;
  unlockTelemetry();
}

void telemetrySetSimCapability(uint8_t level) {
  lockTelemetry();
  SIM_CAPABILITY_LEVEL = level;
  unlockTelemetry();
}

void telemetrySetSosState(bool active) {
  lockTelemetry();
  SOS_ACTIVE = active;
  unlockTelemetry();
}

void telemetrySetSosCancelRequested(bool requested) {
  lockTelemetry();
  SOS_CANCEL_REQUESTED = requested;
  unlockTelemetry();
}

bool telemetryIsSosActive() {
  lockTelemetry();
  bool active = SOS_ACTIVE;
  unlockTelemetry();
  return active;
}

bool telemetryIsSosCancellationRequested() {
  lockTelemetry();
  bool requested = SOS_CANCEL_REQUESTED;
  unlockTelemetry();
  return requested;
}

void telemetrySetSignalLevels(int signal4G, int signalWiFi, int signalCsqRaw,
                              int signalRssiRaw) {
  lockTelemetry();
  SIGNAL_4G = signal4G;
  SIGNAL_WIFI = signalWiFi;
  SIGNAL_CSQ_RAW = signalCsqRaw;
  SIGNAL_RSSI_RAW = signalRssiRaw;
  unlockTelemetry();
}

void telemetrySetBootMs(unsigned long bootMs) {
  lockTelemetry();
  BOOT_MS = bootMs;
  unlockTelemetry();
}

void telemetrySetTrackCodes(int wifiCode, int simCode) {
  lockTelemetry();
  TRACK_WIFI_CODE = wifiCode;
  TRACK_SIM_CODE = simCode;
  unlockTelemetry();
}

void telemetrySetTrackWifiCode(int wifiCode) {
  lockTelemetry();
  TRACK_WIFI_CODE = wifiCode;
  unlockTelemetry();
}

void telemetrySetTrackSimCode(int simCode) {
  lockTelemetry();
  TRACK_SIM_CODE = simCode;
  unlockTelemetry();
}

void telemetrySetAssistStatus(const char *status) {
  lockTelemetry();
  strncpy(ASSIST_STATUS_BUF, status ? status : "",
          sizeof(ASSIST_STATUS_BUF) - 1);
  ASSIST_STATUS_BUF[sizeof(ASSIST_STATUS_BUF) - 1] = '\0';
  ASSIST_STATUS = ASSIST_STATUS_BUF;
  unlockTelemetry();
}

void telemetrySetNetworkLocation(double lat, double lng, float accuracyM,
                                 LocationSource source) {
  lockTelemetry();
  NETLOC_READY = true;
  NETLOC_LAT = lat;
  NETLOC_LNG = lng;
  NETLOC_ACC = accuracyM;
  NETLOC_AT_MS = millis();
  NETLOC_SOURCE = source;
  unlockTelemetry();
}

const char *locationSourceName(LocationSource src) {
  switch (src) {
  case LOC_GPS:
    return "gps";
  case LOC_WIFI_GEO:
    return "wifi_geo";
  case LOC_CELL_GEO:
    return "cell_geo";
  case LOC_HOME:
    return "home";
  default:
    return "none";
  }
}

// ============================================================
// getBestAvailableLocation — single source of truth
//
// Priority: GPS > WIFI_GEO > CELL_GEO > HOME > NONE
// GPS fix must be current (age < 60s).
// Network location must be reasonably fresh (age < 5 min).
// ============================================================
static BestLocationResult getBestAvailableLocationLegacy() {
  BestLocationResult result = {};
  result.valid = false;
  result.source = LOC_NONE;
  result.accuracyM = 99999;
  result.ageMs = 99999;

  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  unsigned long now = millis();

  // 1) GPS — best accuracy, but only if we have a recent fix
  if (telem.gpsReady) {
    if (isValidCoordPair(GPS_LAT, GPS_LNG)) {
      result.lat = GPS_LAT;
      result.lng = GPS_LNG;
      result.accuracyM = 10.0f; // NEO-M10 typical
      result.source = LOC_GPS;
      result.ageMs =
          (telem.lastGpsUpdateMs > 0) ? (now - telem.lastGpsUpdateMs) : 0;
      result.valid = true;
      return result;
    }
  }

  // 2) Network location (WiFi or Cell geolocation)
  if (telem.networkLocReady && telem.networkLocAtMs > 0 &&
      isValidCoordPair(telem.networkLocLat, telem.networkLocLng)) {
    unsigned long age = now - telem.networkLocAtMs;
    if (age < 300000UL) { // < 5 minutes
      result.lat = telem.networkLocLat;
      result.lng = telem.networkLocLng;
      result.accuracyM = telem.networkLocAccuracyM;
      result.source = telem.networkLocSource;
      result.ageMs = age;
      result.valid = true;
      return result;
    }
  }

  // 3) HOME fallback
  bool hasHome = isValidCoordPair(cfg.homeLat, cfg.homeLng);
  if (hasHome) {
    result.lat = cfg.homeLat;
    result.lng = cfg.homeLng;
    result.accuracyM = 5000.0f; // home is very approximate
    result.source = LOC_HOME;
    result.ageMs = 0;
    result.valid = true;
    return result;
  }

  // 4) NONE — no location available
  return result;
}

BestLocationResult getBestAvailableLocation() {
  BestLocationResult result = {};
  result.valid = false;
  result.source = LOC_NONE;
  result.accuracyM = 99999;
  result.ageMs = 99999;

  TelemetrySnapshot telem = {};
  getTelemetrySnapshot(&telem);
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);
  const unsigned long now = millis();

  BestLocationResult gpsCandidate = {};
  gpsCandidate.valid = false;
  if (telem.gpsReady && isValidCoordPair(GPS_LAT, GPS_LNG)) {
    gpsCandidate.lat = GPS_LAT;
    gpsCandidate.lng = GPS_LNG;
    gpsCandidate.accuracyM = estimateGpsAccuracyM();
    gpsCandidate.source = LOC_GPS;
    gpsCandidate.ageMs =
        (telem.lastGpsUpdateMs > 0) ? (now - telem.lastGpsUpdateMs) : 0;
    gpsCandidate.valid = gpsCandidate.ageMs < 60000UL;
  }

  BestLocationResult netCandidate = {};
  netCandidate.valid = false;
  if (telem.networkLocReady && telem.networkLocAtMs > 0 &&
      isValidCoordPair(telem.networkLocLat, telem.networkLocLng)) {
    netCandidate.lat = telem.networkLocLat;
    netCandidate.lng = telem.networkLocLng;
    netCandidate.accuracyM = telem.networkLocAccuracyM;
    netCandidate.source = telem.networkLocSource;
    netCandidate.ageMs = now - telem.networkLocAtMs;
    netCandidate.valid =
        netCandidate.ageMs < 300000UL &&
        isTrustedNetworkCandidate(netCandidate.source, netCandidate.accuracyM) &&
        passesJumpGate(netCandidate.lat, netCandidate.lng,
                       netCandidate.accuracyM, netCandidate.source, now);
  }

  if (gpsCandidate.valid && netCandidate.valid) {
    const double gapM = distanceMeters(gpsCandidate.lat, gpsCandidate.lng,
                                       netCandidate.lat, netCandidate.lng);
    const double allowedM =
        max(50.0, gpsCandidate.accuracyM + (2.0 * netCandidate.accuracyM));
    if (gapM >= 0.0 && gapM <= allowedM) {
      const double wGps =
          1.0 / max(25.0, static_cast<double>(gpsCandidate.accuracyM) *
                              static_cast<double>(gpsCandidate.accuracyM));
      const double wNet =
          1.0 / max(100.0, static_cast<double>(netCandidate.accuracyM) *
                               static_cast<double>(netCandidate.accuracyM));
      const double wSum = wGps + wNet;
      result.lat = (gpsCandidate.lat * wGps + netCandidate.lat * wNet) / wSum;
      result.lng = (gpsCandidate.lng * wGps + netCandidate.lng * wNet) / wSum;
      result.accuracyM = static_cast<float>(sqrt(1.0 / wSum));
      result.source = LOC_GPS;
      result.ageMs = min(gpsCandidate.ageMs, netCandidate.ageMs);
      result.valid = true;
      rememberFusedLocation(result, now);
      return result;
    }
  }

  if (gpsCandidate.valid) {
    result = gpsCandidate;
    rememberFusedLocation(result, now);
    return result;
  }

  if (netCandidate.valid) {
    result = netCandidate;
    rememberFusedLocation(result, now);
    return result;
  }

  const bool hasHome = isValidCoordPair(cfg.homeLat, cfg.homeLng);
  if (hasHome) {
    result.lat = cfg.homeLat;
    result.lng = cfg.homeLng;
    result.accuracyM = 5000.0f;
    result.source = LOC_HOME;
    result.ageMs = 0;
    result.valid = true;
    rememberFusedLocation(result, now);
    return result;
  }

  rememberFusedLocation(result, now);
  return result;
}

void logLine(const char *line) {
  if (serialMutex)
    xSemaphoreTake(serialMutex, pdMS_TO_TICKS(100));
  Serial.println(line);
  if (serialMutex)
    xSemaphoreGive(serialMutex);
}

void logPrintf(const char *fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  logLine(buf);
}
