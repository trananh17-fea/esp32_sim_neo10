#include "button.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "WiFiManager/WiFiManager.h"
#include "buzzer/buzzer.h"

static TaskHandle_t sSosTaskHandle = NULL;
static TaskHandle_t sBuzzerTaskHandle = NULL;
static constexpr unsigned long kShortClickMinMs = 60;
static constexpr unsigned long kShortClickMaxMs = 400;
static constexpr unsigned long kMultiClickGapMs = 400;
static constexpr int kSilentSosClickCount = 2;
static constexpr int kToggleApClickCount = 5;

static void sosTask(void *pvParameters) {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  telemetrySetSosCancelRequested(false);
  logLine("[SOS] === EMERGENCY TRIGGERED ===");

  String link = getGPSLink();
  String msg =
      String(cfg.smsTemplate) + " - Link: " + link + "\nWeb: " + HOT_SERVER;

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

  telemetrySetSosState(true);
  telemetrySetSosCancelRequested(false);

  BaseType_t ok = xTaskCreatePinnedToCore(sosTask, "sosTask", 8192, NULL, 2,
                                          &sSosTaskHandle, 1);
  if (ok != pdPASS) {
    telemetrySetSosState(false);
    telemetrySetSosCancelRequested(false);
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

static void toggleProvisioningAp() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);
  cfg.wifiApEnable = !cfg.wifiApEnable;

  nvs_set_u8(nvsHandle, "WIFI_AP_EN", cfg.wifiApEnable ? 1 : 0);
  esp_err_t err = nvs_commit(nvsHandle);
  if (err != ESP_OK) {
    logPrintf("[Button] 5 Click -> save AP host failed (%d)", (int)err);
    return;
  }

  applyConfigSnapshot(&cfg);
  wifiRestoreApStaMode();
  logPrintf("[Button] 5 Click -> AP host %s", cfg.wifiApEnable ? "ON" : "OFF");
}

static void handleMultiClickAction(int clickCount) {
  if (clickCount >= kToggleApClickCount) {
    toggleProvisioningAp();
    return;
  }

  if (clickCount == kSilentSosClickCount) {
    logLine("[Button] Double Click -> SOS Silent (SMS + CALL)");
    startSosTask(false);
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

    if (currentState == LOW && lastState == HIGH) {
      pressedTime = millis();
    }

    if (currentState == HIGH && lastState == LOW) {
      unsigned long duration = millis() - pressedTime;

      if (duration >= 1000 && duration <= 3000) {
        logLine("[Button] Hold 1-3s -> SOS + BUZZER");
        startSosTask(true);
        clickCount = 0;
      } else if (duration > 3000) {
        logLine("[Button] Hold >3s -> CANCEL SOS");
        cancelSosAndStopBuzzer();
        clickCount = 0;
      } else if (duration >= kShortClickMinMs && duration < kShortClickMaxMs) {
        unsigned long gap = millis() - lastReleaseTime;
        if (gap < kMultiClickGapMs)
          clickCount++;
        else
          clickCount = 1;
        lastReleaseTime = millis();
      }
    }

    if (clickCount > 0 && (millis() - lastReleaseTime) > kMultiClickGapMs) {
      handleMultiClickAction(clickCount);
      clickCount = 0;
    }

    lastState = currentState;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
