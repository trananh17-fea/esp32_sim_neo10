#include "buzzer.h"

bool buzzerActive = false;

void buzzer_init() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

void buzzer_beep(int duration, int times, int gap) {
  for (int i = 0; i < times; i++) {
    tone(BUZZER_PIN, 2000); // Thay thế digitalWrite(HIGH) bằng tone 2kHz
    delay(duration);
    noTone(BUZZER_PIN); // Tắt âm thanh
    digitalWrite(BUZZER_PIN, LOW);
    delay(gap);
  }
}

void buzzer_sos() {
  while (buzzerActive) // chạy cho đến khi tắt
  {
    // 3 tiếng ngắn (S)
    for (int i = 0; i < 3; i++) {
      if (!buzzerActive)
        break;
      buzzer_beep(100, 1, 100);
      vTaskDelay(pdMS_TO_TICKS(10));
    }
    if (!buzzerActive)
      break;
    vTaskDelay(pdMS_TO_TICKS(200));

    // 3 tiếng dài (O)
    for (int i = 0; i < 3; i++) {
      if (!buzzerActive)
        break;
      buzzer_beep(400, 1, 100);
      vTaskDelay(pdMS_TO_TICKS(10));
    }
    if (!buzzerActive)
      break;
    vTaskDelay(pdMS_TO_TICKS(200));

    // 3 tiếng ngắn (S)
    for (int i = 0; i < 3; i++) {
      if (!buzzerActive)
        break;
      buzzer_beep(100, 1, 100);
      vTaskDelay(pdMS_TO_TICKS(10));
    }

    // nghỉ 1 giây rồi lặp lại
    for (int k = 0; k < 10; k++) {
      if (!buzzerActive)
        break;
      vTaskDelay(pdMS_TO_TICKS(100));
    }
  }

  // Khi thoát vòng lặp, đảm bảo tắt còi
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("[Buzzer] SOS Stopped");
}