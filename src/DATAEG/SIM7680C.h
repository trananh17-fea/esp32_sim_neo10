#pragma once
#include "Config.h"
#include <Arduino.h>
#include <HardwareSerial.h>


extern HardwareSerial simSerial;
extern SemaphoreHandle_t simMutex;

#define MCU_SIM_BAUDRATE 115200
#define SIM_TX_PIN 2
#define SIM_RX_PIN 3

// --- Init ---
void init_sim7680c();
void task_init_sim7680c(void *pvParameters);

// --- SMS ---
void SIM7680C_sendSMS_to(const char *number, const String &message);
void SIM7680C_sendSMS(const String &message); // sends to CALL_1 (legacy)

// --- Call cascade (SOS) ---
// Calls number for ringSeconds. Returns true if answered.
bool SIM7680C_callNumber(const char *number, int ringSeconds);
void SIM7680C_callCascade(); // CALL_1 -> CALL_2 -> CALL_3 -> HOTLINE

// --- HTTP ---
void SIM7680C_httpPost(const String &url, const String &contentType,
                       const String &body);

// --- Signal ---
bool sim_isRegistered();
int sim_readCSQ();        // raw CSQ value (0-31, 99=unknown)
int sim_getSignalLevel(); // mapped to 0..10

// --- Helpers ---
String sim_readResponse(uint32_t timeoutMs);
