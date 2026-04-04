#pragma once
#include <Arduino.h>

#define BUZZER_PIN 44
void buzzer_init();
void buzzer_beep(int duration = 100, int times = 1, int gap = 100);
void buzzer_sos();
extern bool buzzerActive; // biến điều khiển từ buttonTask
