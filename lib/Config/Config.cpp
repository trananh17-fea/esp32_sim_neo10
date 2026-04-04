#include "Config.h"

nvs_handle_t nvsHandle;
SemaphoreHandle_t serialMutex = NULL;

double GPS_LAT = 0.0;
double GPS_LNG = 0.0;
String GPS_LINK = "";
bool GPS_READY = false;
bool ASSIST_READY = false;

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

volatile bool SIM_READY = false;
volatile bool SOS_ACTIVE = false;
volatile int SIGNAL_4G = 0;
volatile int SIGNAL_WIFI = 0;
volatile int SIGNAL_CSQ_RAW = 99;
volatile int SIGNAL_RSSI_RAW = 0;

volatile unsigned long FIRST_FIX_MS = 0;
volatile unsigned long BOOT_MS = 0;
const char *ASSIST_STATUS = "not_run";
volatile int TRACK_WIFI_CODE = 0;
volatile int TRACK_SIM_CODE = 0;

char PHONE[37] = "";
char SMS[256] = "";
