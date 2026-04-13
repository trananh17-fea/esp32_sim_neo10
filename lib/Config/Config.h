#ifndef CONFIG_H
#define CONFIG_H
#include <Arduino.h>
#include <nvs.h>
#include <nvs_flash.h>
#include <stdarg.h>

// ============================================================
// Global shared state
// ============================================================
extern nvs_handle_t nvsHandle;
extern SemaphoreHandle_t serialMutex;

constexpr size_t CONFIG_PHONE_LEN = 37;
constexpr size_t CONFIG_SMS_LEN = 256;
constexpr size_t CONFIG_ASSIST_CHIPCODE_LEN = 64;
constexpr size_t CONFIG_ASSIST_TOKEN_LEN = 128;
constexpr size_t TELEMETRY_STATUS_LEN = 32;
constexpr size_t CONFIG_NETLOC_KEY_LEN = 64;
constexpr size_t CONFIG_NETLOC_RELAY_LEN = 192;
constexpr size_t CONFIG_TRACKING_URL_LEN = 192;
constexpr size_t CONFIG_DEVICE_ID_LEN = 48;
constexpr size_t CONFIG_DEVICE_NAME_LEN = 64;

// ============================================================
// Location source priority (higher = better)
// ============================================================
enum LocationSource : uint8_t {
  LOC_NONE = 0,
  LOC_HOME = 1,
  LOC_CELL_GEO = 2,
  LOC_WIFI_GEO = 3,
  LOC_GPS = 4,
};

const char *locationSourceName(LocationSource src);

// ============================================================
// Best available location — single source of truth
// All consumers (tracking, SOS, webserver) should use this.
// ============================================================
struct BestLocationResult {
  double lat;
  double lng;
  float accuracyM; // estimated accuracy in meters
  LocationSource source;
  unsigned long ageMs; // how old is this fix (millis since obtained)
  bool valid;          // true if we have any usable location
};

BestLocationResult getBestAvailableLocation();

struct ConfigSnapshot {
  char deviceId[CONFIG_DEVICE_ID_LEN];
  char deviceName[CONFIG_DEVICE_NAME_LEN];
  char call1[CONFIG_PHONE_LEN];
  char call2[CONFIG_PHONE_LEN];
  char call3[CONFIG_PHONE_LEN];
  char hotline[CONFIG_PHONE_LEN];
  int ringSeconds;
  char smsTemplate[CONFIG_SMS_LEN];
  bool geofenceEnable;
  double homeLat;
  double homeLng;
  int geofenceRadiusM;
  bool signalWarnEnable;
  int signalWarnCooldownMin;
  int signalWarnCallMode;
  char assistChipcode[CONFIG_ASSIST_CHIPCODE_LEN];
  char assistToken[CONFIG_ASSIST_TOKEN_LEN];
  bool simTrackingEnable;
  bool wifiApEnable;
  char wifiTrackingUrl[CONFIG_TRACKING_URL_LEN];
  char simTrackingUrl[CONFIG_TRACKING_URL_LEN];
  unsigned long trackingCurrentMovingIntervalMs;
  unsigned long trackingCurrentStationaryIntervalMs;
  unsigned long trackingHistoryMovingIntervalMs;
  unsigned long trackingHistoryStationaryIntervalMs;
  // --- Network location config ---
  bool netlocEnable;
  char netlocApiKey[CONFIG_NETLOC_KEY_LEN];
  char netlocProvider[32];
  char netlocRelayUrl[CONFIG_NETLOC_RELAY_LEN];
  char simNetlocRelayUrl[CONFIG_NETLOC_RELAY_LEN];
};

struct TelemetrySnapshot {
  bool gpsReady;
  bool assistReady;
  uint8_t simCapabilityLevel;
  bool sosActive;
  bool sosCancelRequested;
  bool batteryReady;
  int signal4G;
  int signalWiFi;
  int signalCsqRaw;
  int signalRssiRaw;
  int batteryPercent;
  float batteryVoltageV;
  unsigned long firstFixMs;
  unsigned long lastGpsUpdateMs; // millis() of most recent GPS position update
  unsigned long bootMs;
  int trackWifiCode;
  int trackSimCode;
  char assistStatus[TELEMETRY_STATUS_LEN];
  // --- Network location state ---
  bool networkLocReady;
  double networkLocLat;
  double networkLocLng;
  float networkLocAccuracyM;
  unsigned long networkLocAtMs; // millis() when location was obtained
  LocationSource networkLocSource;
};

void initSharedState();
void getConfigSnapshot(ConfigSnapshot *out);
void applyConfigSnapshot(const ConfigSnapshot *snapshot);
void updateHomeConfig(double lat, double lng);
void getTelemetrySnapshot(TelemetrySnapshot *out);
void telemetrySetGpsReady(bool ready, unsigned long firstFixMs);
void telemetrySetLastGpsUpdate();
void telemetrySetAssistReady(bool ready);
void telemetrySetSimCapability(uint8_t level);
void telemetrySetSosState(bool active);
void telemetrySetSosCancelRequested(bool requested);
bool telemetryIsSosActive();
bool telemetryIsSosCancellationRequested();
void telemetrySetSignalLevels(int signal4G, int signalWiFi, int signalCsqRaw,
                              int signalRssiRaw);
void telemetrySetBatteryStatus(bool ready, int percent, float voltageV);
void telemetrySetBootMs(unsigned long bootMs);
void telemetrySetTrackCodes(int wifiCode, int simCode);
void telemetrySetTrackWifiCode(int wifiCode);
void telemetrySetTrackSimCode(int simCode);
void telemetrySetAssistStatus(const char *status);
void telemetrySetNetworkLocation(double lat, double lng, float accuracyM,
                                 LocationSource source);

void logLine(const char *line);
void logPrintf(const char *fmt, ...);

// --- GPS state ---
extern double GPS_LAT;
extern double GPS_LNG;
extern String GPS_LINK;
extern bool GPS_READY;
extern bool ASSIST_READY;
extern char TRACKER_DEVICE_ID[CONFIG_DEVICE_ID_LEN];
extern char TRACKER_DEVICE_NAME[CONFIG_DEVICE_NAME_LEN];

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
extern bool WIFI_AP_ENABLE;
extern char WIFI_TRACKING_URL[CONFIG_TRACKING_URL_LEN];
extern char SIM_TRACKING_URL[CONFIG_TRACKING_URL_LEN];
extern unsigned long TRACKING_CURRENT_MOVING_INTERVAL_MS;
extern unsigned long TRACKING_CURRENT_STATIONARY_INTERVAL_MS;
extern unsigned long TRACKING_HISTORY_MOVING_INTERVAL_MS;
extern unsigned long TRACKING_HISTORY_STATIONARY_INTERVAL_MS;

// --- Network location config ---
extern bool NETLOC_ENABLE;
extern char NETLOC_API_KEY[CONFIG_NETLOC_KEY_LEN];
extern char NETLOC_PROVIDER[32];
extern char NETLOC_RELAY_URL[CONFIG_NETLOC_RELAY_LEN];
extern char SIM_NETLOC_RELAY_URL[CONFIG_NETLOC_RELAY_LEN];

// --- Runtime flags ---
extern volatile uint8_t SIM_CAPABILITY_LEVEL;
extern volatile bool SOS_ACTIVE;
extern volatile bool SOS_CANCEL_REQUESTED;
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
static inline void serialLog(const char *line) { logLine(line); }

#endif
