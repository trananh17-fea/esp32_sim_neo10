#pragma once
#include <Arduino.h>

void Tracking_Init();
void Tracking_Loop();

// One-shot test request, returns JSON result string for portal display
String trackingTestRequest();
