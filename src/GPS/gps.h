#ifndef GPS_H
#define GPS_H

#include "Config.h"
#include "server.h"
#include <Arduino.h>
#include <TinyGPSPlus.h>


#define GPS_RX_PIN 12
#define GPS_TX_PIN 13

extern TinyGPSPlus gps;
extern HardwareSerial SerialGPS;

void gpsTask(void *pvParameters);
String getGPSLink();
double GPS_getLatitude();
double GPS_getLongitude();

// Current coords (updated in gpsTask)
extern float currentLat;
extern float currentLng;

#endif
