#pragma once
#include "Config.h"
#include <Arduino.h>
#include <HardwareSerial.h>

extern HardwareSerial simSerial;
extern SemaphoreHandle_t simMutex;

#define MCU_SIM_BAUDRATE 115200
#define SIM_TX_PIN 2
#define SIM_RX_PIN 3

enum SimCapability : uint8_t {
  SIM_CAP_NONE = 0,
  SIM_CAP_BOOTING = 1,
  SIM_CAP_RADIO_OK = 2,
  SIM_CAP_VOICE_SMS_OK = 3,
  SIM_CAP_DATA_OK = 4,
  SIM_CAP_HTTP_OK = 5,
};

// --- Init ---
void init_sim7680c();
void task_init_sim7680c(void *pvParameters);

// --- Capability state ---
SimCapability SIM_getCapability();
void SIM_setCapability(SimCapability capability);
bool SIM_hasCapability(SimCapability minimumCapability);
const char *SIM_capabilityName(SimCapability capability);

// --- SMS ---
void SIM7680C_sendSMS_to(const char *number, const String &message);
void SIM7680C_sendSMS(const String &message); // sends to CALL_1 (legacy)

// --- Call cascade (SOS) ---
// Calls number for ringSeconds. Returns true if answered.
bool SIM7680C_callNumber(const char *number, int ringSeconds);
void SIM7680C_callCascade(); // CALL_1 -> CALL_2 -> CALL_3 -> HOTLINE

// --- HTTP ---
bool SIM7680C_httpPost(const String &url, const String &contentType,
                       const String &body);
bool SIM7680C_httpPostWithResponse(const String &url, const String &contentType,
                                   const String &body, String &outResponse);

// HTTP GET via SIM modem — downloads binary content and saves to LittleFS file.
// Returns number of bytes downloaded, or 0 on failure.
int SIM7680C_httpGetToFile(const String &url, const char *filePath);
bool SIM7680C_httpGetWithResponse(const String &url, String &outResponse);
bool SIM7680C_isTlsHostBlocked(const String &url);
void SIM7680C_clearTlsHostBlocklist();

// --- Time ---
// Read network time from SIM module (AT+CCLK?)
// Returns true if valid time was parsed. Output is UTC.
bool SIM_getNetworkTime(int *year, int *month, int *day, int *hour,
                        int *minute, int *second);

// --- Cell info ---
bool SIM_getCellInfo(int *mcc, int *mnc, int *lac, int *cellId, String *radio);

// --- Signal ---
bool sim_isRegistered();
int sim_readCSQ();        // raw CSQ value (0-31, 99=unknown)
int sim_getSignalLevel(); // mapped to 0..10
bool SIM_getBatteryStatus(int *percent, float *voltageV);

// --- Helpers ---
String sim_readResponse(uint32_t timeoutMs);
