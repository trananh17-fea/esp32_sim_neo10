#ifndef STRIP_H
#define STRIP_H

#include <Adafruit_NeoPixel.h>

void initStrip();
void setBrightness(uint8_t b);

// ONLY ledTask should call setColor — no other task!
void setColor(uint8_t red, uint8_t green, uint8_t blue);

// LED state machine task — SINGLE SOURCE OF TRUTH
void ledTask(void *pvParameters);

#endif