#include "main.h"

TaskHandle_t xHandle_gps = NULL;
TaskHandle_t xHandle_sim7680c = NULL;
TaskHandle_t xHandle_netloc = NULL;

static void monitorTask(void *pvParameters) {
  vTaskDelay(pdMS_TO_TICKS(4000));

  while (true) {
    ConfigSnapshot cfg = {};
    TelemetrySnapshot telem = {};
    getConfigSnapshot(&cfg);
    getTelemetrySnapshot(&telem);

    // GPS
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.9f;
    unsigned long age = gps.location.isValid() ? gps.location.age() : 99999;
    double lat = GPS_getLatitude();
    double lng = GPS_getLongitude();
    unsigned long ttff = 0;
    if (telem.firstFixMs > 0)
      ttff = (telem.firstFixMs - telem.bootMs) / 1000;

    // Distance to home
    bool hasHome = (cfg.homeLat != 0 || cfg.homeLng != 0);
    double distHome = -1;
    if (hasHome && telem.gpsReady && (lat != 0 || lng != 0))
      distHome = calculateDistance(lat, lng, cfg.homeLat, cfg.homeLng);

    // Signal (all from cached globals, no mutex needed)
    int s4g = telem.signal4G;
    int swifi = telem.signalWiFi;
    int csq = telem.signalCsqRaw;
    int rssi = telem.signalRssiRaw;
    int dbm = (csq >= 0 && csq <= 31) ? (-113 + 2 * csq) : 0;
    SimCapability simCap = static_cast<SimCapability>(telem.simCapabilityLevel);

    // Build ONE line in buffer
    char line[384];
    int p = 0;

    p += snprintf(line + p, sizeof(line) - p,
                  "[MON] fix=%d sats=%d hdop=%.1f lat=%.6f lng=%.6f "
                  "age=%lu TTFF=%lus",
                  telem.gpsReady ? 1 : 0, sats, hdop, lat, lng, age, ttff);

    if (hasHome && distHome >= 0)
      p += snprintf(line + p, sizeof(line) - p, " | dist=%.0fm home=1",
                    distHome);
    else if (hasHome)
      p += snprintf(line + p, sizeof(line) - p, " | dist=-- home=1");
    else
      p += snprintf(line + p, sizeof(line) - p, " | dist=-- home=0");

    p += snprintf(line + p, sizeof(line) - p,
                  " | 4G=%d/10(csq=%d,dbm=%d) WiFi=%d/10(rssi=%d)", s4g, csq,
                  dbm, swifi, rssi);

    p += snprintf(line + p, sizeof(line) - p, " | wifi=%d sim=%s",
                  (WiFi.status() == WL_CONNECTED) ? 1 : 0,
                  SIM_capabilityName(simCap));

    p += snprintf(line + p, sizeof(line) - p, " | assist=%s trk=%d",
                  telem.assistStatus, telem.trackWifiCode);

    // Print atomically
    serialLog(line);

    vTaskDelay(pdMS_TO_TICKS(30000));
  }
}

void setup() {
  // Create serial mutex FIRST, before anything prints
  serialMutex = xSemaphoreCreateMutex();
  initSharedState();

  Serial.begin(115200);
  delay(200);
  telemetrySetBootMs(millis());
  pinMode(15, OUTPUT);
  digitalWrite(15, HIGH);

  logLine("=== SOS GPS Tracker ===");

  // 1) NVS
  initStorage();
  loadDataFromRom();

  // 2) Hardware
  buzzer_init();

  // 3) WiFi
  initWiFi();

  // 4) Portal
  initFriendlyNamePortal();

  // 5) Geofencing
  initGeofencing();

  // 6) Tracking
  Tracking_Init();

  logLine("--- STARTING TASKS ---");

  xTaskCreatePinnedToCore(task_init_sim7680c, "simInit", 8192, NULL, 1,
                          &xHandle_sim7680c, 0);
  xTaskCreatePinnedToCore(gpsTask, "gpsTask", 8192, NULL, 1, &xHandle_gps, 1);

  xTaskCreate(buttonTask, "btnTask", 4096, NULL, 1, NULL);
  xTaskCreate(signalMonitorTask, "sigMon", 8192, NULL, 1, NULL);
  xTaskCreate(monitorTask, "monTask", 6144, NULL, 1, NULL);
  xTaskCreate(networkLocationTask, "netLoc", 8192, NULL, 1, &xHandle_netloc);
}

void loop() {
  Tracking_Loop();
  loopFriendlyNamePortal();
  vTaskDelay(50);
}
