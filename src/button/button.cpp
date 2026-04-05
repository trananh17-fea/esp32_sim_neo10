#include "button.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "buzzer/buzzer.h"

static TaskHandle_t sSosTaskHandle = NULL;
static TaskHandle_t sBuzzerTaskHandle = NULL;

static void sosTask(void *pvParameters) {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  telemetrySetSosState(true);
  telemetrySetSosCancelRequested(false);
  logLine("[SOS] === EMERGENCY TRIGGERED ===");

  String link = getGPSLink();
  String msg = String(cfg.smsTemplate) + " - Link: " + link +
               "\nWeb: https://thanhvu220809.github.io/gps-dashboard/";

  const char *nums[] = {cfg.call1, cfg.call2, cfg.call3, cfg.hotline};
  for (int i = 0; i < 4; i++) {
    if (telemetryIsSosCancellationRequested()) {
      logLine("[SOS] Cancelled before SMS fanout completed");
      break;
    }
    if (strlen(nums[i]) >= 3) {
      logPrintf("[SOS] SMS #%d -> %s", i + 1, nums[i]);
      SIM7680C_sendSMS_to(nums[i], msg);
    }
  }

  if (!telemetryIsSosCancellationRequested()) {
    logLine("[SOS] Starting call cascade...");
    SIM7680C_callCascade();
  }

  if (telemetryIsSosCancellationRequested())
    logLine("[SOS] === EMERGENCY CANCELLED ===");
  else
    logLine("[SOS] === EMERGENCY COMPLETE ===");

  telemetrySetSosCancelRequested(false);
  telemetrySetSosState(false);
  sSosTaskHandle = NULL;
  vTaskDelete(NULL);
}

static void startSosTask(bool enableBuzzer) {
  if (telemetryIsSosActive() || sSosTaskHandle != NULL) {
    logLine("[SOS] Trigger ignored, SOS already active");
    return;
  }

  BaseType_t ok =
      xTaskCreatePinnedToCore(sosTask, "sosTask", 8192, NULL, 2,
                              &sSosTaskHandle, 1);
  if (ok != pdPASS) {
    sSosTaskHandle = NULL;
    logLine("[SOS] Failed to create sosTask");
    return;
  }

  if (enableBuzzer && !buzzerActive && sBuzzerTaskHandle == NULL) {
    buzzerActive = true;
    xTaskCreatePinnedToCore(
        [](void *) {
          buzzer_sos();
          sBuzzerTaskHandle = NULL;
          vTaskDelete(NULL);
        },
        "buzzerSOS", 4096, NULL, 1, &sBuzzerTaskHandle, 0);
  }
}

static void cancelSosAndStopBuzzer() {
  bool handled = false;

  if (telemetryIsSosActive()) {
    telemetrySetSosCancelRequested(true);
    logLine("[Button] Hold >3s -> CANCEL SOS");
    handled = true;
  }

  if (buzzerActive) {
    buzzerActive = false;
    logLine("[Button] Hold >3s -> STOP BUZZER");
    handled = true;
  }

  if (!handled) {
    logLine("[Button] Hold >3s -> system already normal");
  }
}

void buttonTask(void *pvParameters) {
  logLine("[Button] Task started");
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  bool lastRawState = HIGH;
  bool stableState = HIGH;
  unsigned long lastDebounceTime = 0;
  unsigned long pressedTime = 0;
  unsigned long lastClickTime = 0;
  int clickCount = 0;

  const unsigned long debounceMs = 40;
  const unsigned long minShortPressMs = 60;
  const unsigned long shortPressMaxMs = 400;
  const unsigned long doubleClickGapMs = 400;

  while (true) {
    bool rawState = digitalRead(BUTTON_PIN);

    if (rawState != lastRawState) {
      lastDebounceTime = millis();
      lastRawState = rawState;
    }

    if ((millis() - lastDebounceTime) >= debounceMs && rawState != stableState) {
      stableState = rawState;

      if (stableState == LOW) {
        pressedTime = millis();
      } else {
        const unsigned long pressDurationMs = millis() - pressedTime;

        if (pressDurationMs >= minShortPressMs &&
            pressDurationMs < shortPressMaxMs) {
          clickCount++;
          if (clickCount == 1) {
            lastClickTime = millis();
          } else if (clickCount == 2 &&
                     (millis() - lastClickTime) < doubleClickGapMs) {
            logLine("[Button] Double Click -> SOS silent (SMS + CALL)");
            startSosTask(false);
            clickCount = 0;
          }
        } else if (pressDurationMs >= 1000 && pressDurationMs <= 3000) {
          logLine("[Button] Hold 1-3s -> SOS + BUZZER");
          startSosTask(true);
          clickCount = 0;
        } else if (pressDurationMs > 3000) {
          cancelSosAndStopBuzzer();
          clickCount = 0;
        }
      }
    }

    if (clickCount > 0 && stableState == HIGH &&
        (millis() - lastClickTime) > doubleClickGapMs) {
      clickCount = 0;
    }

    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
