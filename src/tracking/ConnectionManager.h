#pragma once

#include "Config.h"
#include <Arduino.h>

class ConnectionManager {
public:
  bool sendTrackingPayload(const String &payload, const ConfigSnapshot &cfg,
                           const String &fallbackGetUrl);

private:
  bool sendViaWiFi(const String &payload, const ConfigSnapshot &cfg);
  bool sendViaSIM(const String &payload, const ConfigSnapshot &cfg);
};
