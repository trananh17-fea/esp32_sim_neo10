#include "strip.h"
#include "Config.h"
#include <WiFi.h>

// ============================================================
// LED STATE MACHINE — SINGLE SOURCE OF TRUTH
//
// Priority (highest first):
//   1. SOS active   → fast red blink
//   2. Portal active (AP has clients) → blue blink
//   3. GPS no fix   → solid red
//   4. GPS fix + network OK → solid green
//   5. GPS fix, no network  → yellow
// ============================================================

#define LED_PIN 16
static Adafruit_NeoPixel strip(1, LED_PIN, NEO_GRB + NEO_KHZ800);

static uint8_t curR = 0, curG = 0, curB = 0;

void setColor(uint8_t red, uint8_t green, uint8_t blue) {
  if (curR == red && curG == green && curB == blue)
    return;
  curR = red;
  curG = green;
  curB = blue;
  strip.setPixelColor(0, strip.Color(red, green, blue));
  strip.show();
}

void setBrightness(uint8_t b) {
  strip.setBrightness(b);
  strip.show();
}

void initStrip() {
  strip.begin();
  strip.show();
  strip.setBrightness(20);
  setColor(0, 0, 0);
}

void ledTask(void *pvParameters) {
  bool toggle = false;

  while (true) {
    toggle = !toggle;

    // Priority 1: SOS active → fast red blink
    if (SOS_ACTIVE) {
      setColor(toggle ? 255 : 0, 0, 0);
      vTaskDelay(pdMS_TO_TICKS(250));
      continue;
    }

    // Priority 2: AP has clients → blue blink (portal in use)
    if (WiFi.softAPgetStationNum() > 0) {
      setColor(0, 0, toggle ? 255 : 60);
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    // Priority 3: No GPS fix → solid red
    if (!GPS_READY) {
      setColor(255, 0, 0);
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    // Priority 4: GPS fix + network → solid green
    bool networkOK = (WiFi.status() == WL_CONNECTED) || SIM_READY;
    if (networkOK) {
      setColor(0, 255, 0);
    } else {
      // GPS fix but no network → yellow
      setColor(255, 180, 0);
    }

    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}