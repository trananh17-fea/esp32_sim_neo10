#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>

#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "Storage/Storage.h"
#include "WiFiManager/WiFiManager.h"
#include "assistnow/assistnow.h"
#include "button/button.h"
#include "buzzer/buzzer.h"
#include "geofencing/geofencing.h"
#include "signal/SignalMonitor.h"
#include "strip/strip.h"
#include "tracking/tracking.h"
#include "webserver/webserver.h"

// Task handles
extern TaskHandle_t xHandle_gps;
extern TaskHandle_t xHandle_sim7680c;