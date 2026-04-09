#include "buzzer.h"

bool buzzerActive = false;

// KLJ-1230: passive piezo buzzer, resonant freq ~4100 Hz
// Sử dụng LEDC để tạo tín hiệu PWM thay vì tone() (ko hỗ trợ tốt trên ESP32-S3)
static bool _ledcAttached = false;

void buzzer_init() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

static void buzzer_on(uint32_t freq) {
  if (_ledcAttached) {
    ledcDetach(BUZZER_PIN);
    _ledcAttached = false;
  }
  if (ledcAttach(BUZZER_PIN, freq, 8)) { // 8-bit resolution
    _ledcAttached = true;
    ledcWrite(BUZZER_PIN, 128); // duty 50% -> square wave
  } else {
    Serial.println("[Buzzer] LEDC attach FAILED");
  }
}

static void buzzer_off() {
  if (_ledcAttached) {
    ledcWrite(BUZZER_PIN, 0);
    ledcDetach(BUZZER_PIN);
    _ledcAttached = false;
  }
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

void buzzer_beep(int duration, int times, int gap) {
  for (int i = 0; i < times; i++) {
    buzzer_on(BUZZER_FREQ);
    delay(duration);
    buzzer_off();
    delay(gap);
  }
}

// Cấu trúc để định nghĩa một phần của mã Morse
struct MorsePattern {
  int duration; // Độ dài tiếng bíp (ms)
  int count;    // Số lần bíp
};

void buzzer_sos() {
  //   // Định nghĩa mô hình SOS: 3 ngắn (100ms), 3 dài (400ms), 3 ngắn (100ms)
  //   const MorsePattern sos[] = {{100, 3}, {400, 3}, {100, 3}};
  //   const int gapBetweenLetters = 200; // Nghỉ giữa các chữ cái (S, O, S)

  //   while (buzzerActive) {
  //     for (int i = 0; i < 3; i++) { // Duyệt qua S, O, S
  //       for (int j = 0; j < sos[i].count; j++) {
  //         if (!buzzerActive)
  //           goto stop; // Thoát ngay lập tức nếu bị hủy

  //         // Thực hiện bíp
  //         buzzer_on(BUZZER_FREQ);

  //         // Thay vì delay() cứng, chia nhỏ thời gian để check cờ hủy
  //         int remaining = sos[i].duration;
  //         while (remaining > 0 && buzzerActive) {
  //           int step = (remaining > 50) ? 50 : remaining;
  //           vTaskDelay(pdMS_TO_TICKS(step));
  //           remaining -= step;
  //         }

  //         buzzer_off();
  //         vTaskDelay(pdMS_TO_TICKS(
  //             100)); // Khoảng nghỉ giữa các nhịp bíp trong cùng 1 chữ
  //       }

  //       if (!buzzerActive)
  //         goto stop;
  //       vTaskDelay(pdMS_TO_TICKS(gapBetweenLetters)); // Nghỉ giữa S-O, O-S
  //     }

  //     // Nghỉ 1 giây sau khi xong một chu kỳ SOS (chia nhỏ để nhạy lệnh tắt)
  //     for (int k = 0; k < 10 && buzzerActive; k++) {
  //       vTaskDelay(pdMS_TO_TICKS(100));
  //     }
  //   }

  // stop:
  //   buzzer_off();
  //   Serial.println("[Buzzer] SOS Stopped");
}