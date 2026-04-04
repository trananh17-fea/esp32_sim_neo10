#include "main.h"

TaskHandle_t xHandle_gps = NULL;
TaskHandle_t xHandle_sim7680c = NULL;

static void monitorTask(void *pvParameters) {
  vTaskDelay(pdMS_TO_TICKS(4000));

  while (true) {
    // GPS
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    float hdop = gps.hdop.isValid() ? gps.hdop.hdop() : 99.9f;
    unsigned long age = gps.location.isValid() ? gps.location.age() : 99999;
    double lat = GPS_getLatitude();
    double lng = GPS_getLongitude();
    unsigned long ttff = 0;
    if (FIRST_FIX_MS > 0)
      ttff = (FIRST_FIX_MS - BOOT_MS) / 1000;

    // Distance to home
    bool hasHome = (HOME_LAT != 0 || HOME_LNG != 0);
    double distHome = -1;
    if (hasHome && GPS_READY && (lat != 0 || lng != 0))
      distHome = calculateDistance(lat, lng, HOME_LAT, HOME_LNG);

    // Signal (all from cached globals, no mutex needed)
    int s4g = SIGNAL_4G;
    int swifi = SIGNAL_WIFI;
    int csq = SIGNAL_CSQ_RAW;
    int rssi = SIGNAL_RSSI_RAW;
    int dbm = (csq >= 0 && csq <= 31) ? (-113 + 2 * csq) : 0;

    // Build ONE line in buffer
    char line[384];
    int p = 0;

    p += snprintf(line + p, sizeof(line) - p,
                  "[MON] fix=%d sats=%d hdop=%.1f lat=%.6f lng=%.6f "
                  "age=%lu TTFF=%lus",
                  GPS_READY ? 1 : 0, sats, hdop, lat, lng, age, ttff);

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

    p += snprintf(line + p, sizeof(line) - p, " | wifi=%d sim=%d",
                  (WiFi.status() == WL_CONNECTED) ? 1 : 0, SIM_READY ? 1 : 0);

    p += snprintf(line + p, sizeof(line) - p, " | assist=%s trk=%d",
                  ASSIST_STATUS, TRACK_WIFI_CODE);

    // Print atomically
    serialLog(line);

    vTaskDelay(pdMS_TO_TICKS(2000));
  }
}

void setup() {
  // Create serial mutex FIRST, before anything prints
  serialMutex = xSemaphoreCreateMutex();

  Serial.begin(115200);
  delay(200);
  BOOT_MS = millis();

  Serial.println("=== SOS GPS Tracker ===");

  // 1) NVS
  initStorage();
  loadDataFromRom();

  // 2) Hardware
  buzzer_init();
  initStrip();

  // 3) WiFi
  initWiFi();

  // 4) Portal
  initFriendlyNamePortal();

  // 5) Geofencing
  initGeofencing();

  // 6) Tracking
  Tracking_Init();

  Serial.println("--- STARTING TASKS ---");

  xTaskCreatePinnedToCore(task_init_sim7680c, "simInit", 8192, NULL, 1,
                          &xHandle_sim7680c, 0);
  xTaskCreatePinnedToCore(gpsTask, "gpsTask", 8192, NULL, 1, &xHandle_gps, 1);

  xTaskCreate(buttonTask, "btnTask", 4096, NULL, 1, NULL);
  xTaskCreate(ledTask, "ledTask", 2048, NULL, 1, NULL);
  xTaskCreate(signalMonitorTask, "sigMon", 4096, NULL, 1, NULL);
  xTaskCreate(monitorTask, "monTask", 4096, NULL, 1, NULL);
}

void loop() {
  Tracking_Loop();
  loopFriendlyNamePortal();
  vTaskDelay(pdMS_TO_TICKS(16));
}
