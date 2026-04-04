#ifndef GEOFENCING_H
#define GEOFENCING_H

#include <Arduino.h>
#include <Config.h>

// HOME_LAT, HOME_LNG, GEOFENCE_ENABLE, GEOFENCE_RADIUS_M
// are all defined in Config.h / Config.cpp

void initGeofencing();
void saveHomeLocation(double lat, double lng);
double calculateDistance(double lat1, double lng1, double lat2, double lng2);

#endif
