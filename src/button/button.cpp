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

  BaseType_t ok = xTaskCreatePinnedToCore(sosTask, "sosTask", 8192, NULL, 2,
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
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  bool lastState = HIGH;
  unsigned long pressedTime = 0;
  unsigned long lastReleaseTime = 0;
  int clickCount = 0;

  while (true) {
    bool currentState = digitalRead(BUTTON_PIN);

    // Phát hiện nhấn xuống
    if (currentState == LOW && lastState == HIGH) {
      pressedTime = millis();
    }

    // Phát hiện thả nút
    if (currentState == HIGH && lastState == LOW) {
      unsigned long duration = millis() - pressedTime;

      // 1. Logic Nhấn giữ (Hold) - Ưu tiên hàng đầu
      if (duration >= 1000 && duration <= 3000) {
        logLine("[Button] Hold 1-3s -> SOS + BUZZER");
        startSosTask(true); // Có còi
        clickCount = 0;
      } else if (duration > 3000) {
        logLine("[Button] Hold >3s -> CANCEL SOS");
        cancelSosAndStopBuzzer();
        clickCount = 0;
      }
      // 2. Logic Nhấn ngắn (Click)
      else if (duration >= 60 && duration < 400) {
        unsigned long gap = millis() - lastReleaseTime;
        if (gap < 400) { // doubleClickGapMs
          clickCount++;
        } else {
          clickCount = 1;
        }
        lastReleaseTime = millis();

        if (clickCount == 2) {
          logLine("[Button] Double Click -> SOS Silent (SMS + CALL)");
          startSosTask(false); // Không còi
          clickCount = 0;
        }
      }
    }

    // Reset clickCount nếu quá thời gian chờ nhấn lần 2
    if (clickCount > 0 && (millis() - lastReleaseTime) > 400) {
      clickCount = 0;
    }

    lastState = currentState;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}