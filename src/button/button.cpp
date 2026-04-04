#include "button.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "buzzer/buzzer.h"


// ============================================================
// SOS Emergency Task
// 1) Send SMS to all configured numbers (CALL_1/2/3 + HOTLINE)
// 2) Call cascade: CALL_1 → CALL_2 → CALL_3 → HOTLINE
// ============================================================
static void sosTask(void *pvParameters) {
  SOS_ACTIVE = true;
  Serial.println("[SOS] === EMERGENCY TRIGGERED ===");

  // 1) Build SMS with GPS link
  String link = getGPSLink();
  String msg = String(SMS_TEMPLATE) + " - Link: " + link +
               "\nWeb: https://thanhvu220809.github.io/gps-dashboard/";

  // 2) Send SMS to all numbers
  const char *nums[] = {CALL_1, CALL_2, CALL_3, HOTLINE_NUMBER};
  for (int i = 0; i < 4; i++) {
    if (strlen(nums[i]) >= 3) {
      Serial.printf("[SOS] SMS #%d -> %s\n", i + 1, nums[i]);
      SIM7680C_sendSMS_to(nums[i], msg);
    }
  }

  // 3) Call cascade
  Serial.println("[SOS] Starting call cascade...");
  SIM7680C_callCascade();

  Serial.println("[SOS] === EMERGENCY COMPLETE ===");
  SOS_ACTIVE = false;
  vTaskDelete(NULL);
}

// ============================================================
// Button Task — double-click / long press detection
// ============================================================
void buttonTask(void *pvParameters) {
  Serial.println("[Button] Task started");
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  bool lastState = HIGH;
  unsigned long pressedTime = 0;
  int clickCount = 0;
  unsigned long lastClickTime = 0;
  const unsigned long doubleClickGap = 400;

  while (true) {
    bool state = digitalRead(BUTTON_PIN);

    // Press down
    if (state == LOW && lastState == HIGH) {
      pressedTime = millis();
    }

    // Release
    if (state == HIGH && lastState == LOW) {
      unsigned long dur = millis() - pressedTime;

      // =====================================
      // CASE 1: Short click (<400ms) — double-click detection
      // =====================================
      if (dur < 400) {
        clickCount++;
        if (clickCount == 1) {
          lastClickTime = millis();
        } else if (clickCount == 2 &&
                   (millis() - lastClickTime) < doubleClickGap) {
          Serial.println("[Button] Double Click -> SMS + CALL (no buzzer)");
          xTaskCreatePinnedToCore(sosTask, "sosTask", 8192, NULL, 2, NULL, 1);
          clickCount = 0;
        }
        vTaskDelay(pdMS_TO_TICKS(50));
      }

      // =====================================
      // CASE 2: Hold 1-3s → SMS + CALL + BUZZER SOS
      // =====================================
      else if (dur >= 1000 && dur <= 3000) {
        Serial.println("[Button] Hold 1-3s -> SOS + BUZZER");
        xTaskCreatePinnedToCore(sosTask, "sosTask", 8192, NULL, 2, NULL, 1);
        if (!buzzerActive) {
          buzzerActive = true;
          xTaskCreatePinnedToCore(
              [](void *) {
                buzzer_sos();
                vTaskDelete(NULL);
              },
              "buzzerSOS", 4096, NULL, 1, NULL, 0);
        }
        clickCount = 0;
      }

      // =====================================
      // CASE 3: Hold >3s → STOP SOS buzzer
      // =====================================
      else if (dur > 3000) {
        if (buzzerActive) {
          Serial.println("[Button] Hold >3s -> STOP BUZZER");
          buzzerActive = false;
        } else {
          Serial.println("[Button] Hold >3s, buzzer already off");
        }
        clickCount = 0;
      }
    }

    // Reset click counter on timeout
    if (clickCount > 0 && (millis() - lastClickTime > doubleClickGap)) {
      clickCount = 0;
    }

    lastState = state;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
