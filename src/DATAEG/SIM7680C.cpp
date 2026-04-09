#include "SIM7680C.h"
#include <LittleFS.h>

HardwareSerial simSerial(2);
SemaphoreHandle_t simMutex = NULL;
static String simTlsBlockedHosts[4];

static String sim_extractHost(const String &url) {
  int scheme = url.indexOf("://");
  int start = (scheme >= 0) ? (scheme + 3) : 0;
  int end = url.indexOf('/', start);
  if (end < 0)
    end = url.length();
  int colon = url.indexOf(':', start);
  if (colon >= 0 && colon < end)
    end = colon;
  return url.substring(start, end);
}

static bool sim_isCloudflareWorkerHost(const String &host) {
  return host.equalsIgnoreCase("gps-tracker.ahcntab.workers.dev") ||
         host.endsWith(".workers.dev");
}

static bool sim_isTlsHandshakeFailureCode(int statusCode) {
  return statusCode == 715;
}

static bool sim_isHostBlocked(const String &host) {
  if (host.isEmpty())
    return false;
  for (const String &blocked : simTlsBlockedHosts) {
    if (!blocked.isEmpty() && blocked.equalsIgnoreCase(host))
      return true;
  }
  return false;
}

static void sim_blockHost(const String &host) {
  if (host.isEmpty() || sim_isHostBlocked(host))
    return;

  for (String &blocked : simTlsBlockedHosts) {
    if (blocked.isEmpty()) {
      blocked = host;
      logPrintf("[SIM-SSL] host blocked after TLS failure: %s", host.c_str());
      return;
    }
  }

  simTlsBlockedHosts[0] = host;
  logPrintf("[SIM-SSL] host blocked after TLS failure: %s", host.c_str());
}

static void sim_configureHttpsContext(const String &url) {
  const String host = sim_extractHost(url);
  if (host.isEmpty())
    return;

  simSerial.println("AT+HTTPSSL=1");
  delay(200);
  while (simSerial.available())
    simSerial.read();

  const bool useCloudflarePreset = sim_isCloudflareWorkerHost(host);

  // Cloudflare Workers handshakes are stricter than AssistNow/u-blox on some
  // modem firmware builds, so keep a dedicated TLS1.2 + SNI preset here.
  simSerial.printf("AT+CSSLCFG=\"sslversion\",0,%d\r\n",
                   useCloudflarePreset ? 4 : 3);
  delay(100);
  simSerial.println("AT+CSSLCFG=\"authmode\",0,0");
  delay(100);
  simSerial.println("AT+CSSLCFG=\"ignorertctime\",0,1");
  delay(100);
  simSerial.println("AT+CSSLCFG=\"ignoretimediff\",0,1");
  delay(100);
  simSerial.println("AT+CSSLCFG=\"negotiatetime\",0,120");
  delay(100);
  simSerial.printf("AT+CSSLCFG=\"sni\",0,\"%s\"\r\n", host.c_str());
  delay(150);
  sim_readResponse(300);
  simSerial.println("AT+CSSLCFG=\"enableSNI\",0,1");
  delay(150);
  sim_readResponse(300);

  logPrintf("[SIM-SSL] host=%s preset=%s tls=%d", host.c_str(),
            useCloudflarePreset ? "cloudflare" : "default",
            useCloudflarePreset ? 4 : 3);
}

bool SIM7680C_isTlsHostBlocked(const String &url) {
  return sim_isHostBlocked(sim_extractHost(url));
}

void SIM7680C_clearTlsHostBlocklist() {
  for (String &blocked : simTlsBlockedHosts)
    blocked = "";
}

static bool sim_cancelRequested() {
  TelemetrySnapshot snapshot = {};
  getTelemetrySnapshot(&snapshot);
  return snapshot.sosActive && snapshot.sosCancelRequested;
}

SimCapability SIM_getCapability() {
  TelemetrySnapshot snapshot = {};
  getTelemetrySnapshot(&snapshot);
  return static_cast<SimCapability>(snapshot.simCapabilityLevel);
}

void SIM_setCapability(SimCapability capability) {
  telemetrySetSimCapability(static_cast<uint8_t>(capability));
}

bool SIM_hasCapability(SimCapability minimumCapability) {
  return SIM_getCapability() >= minimumCapability;
}

const char *SIM_capabilityName(SimCapability capability) {
  switch (capability) {
  case SIM_CAP_BOOTING:
    return "boot";
  case SIM_CAP_RADIO_OK:
    return "radio";
  case SIM_CAP_VOICE_SMS_OK:
    return "voice";
  case SIM_CAP_DATA_OK:
    return "data";
  case SIM_CAP_HTTP_OK:
    return "http";
  default:
    return "off";
  }
}

static bool sim_detectDataSession() {
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  simSerial.println("AT+CGATT?");
  String attachResp = sim_readResponse(500);
  bool attached = (attachResp.indexOf("+CGATT: 1") >= 0);
  bool hasIp = false;

  if (attached) {
    simSerial.println("AT+CGPADDR=1");
    String ipResp = sim_readResponse(700);
    int prefix = ipResp.indexOf("+CGPADDR: 1,");
    if (prefix >= 0) {
      for (int i = prefix + 12; i < ipResp.length(); i++) {
        if (ipResp[i] >= '0' && ipResp[i] <= '9') {
          hasIp = true;
          break;
        }
      }
    }
  }

  if (simMutex)
    xSemaphoreGive(simMutex);

  bool dataReady = attached && hasIp;
  if (dataReady) {
    SIM_setCapability(SIM_CAP_DATA_OK);
  } else if (SIM_getCapability() > SIM_CAP_VOICE_SMS_OK) {
    SIM_setCapability(SIM_CAP_VOICE_SMS_OK);
  }
  return dataReady;
}

static int sim_voltageToBatteryPercent(float voltageV) {
  const float kMinV = 3.30f;
  const float kMaxV = 3.80f;
  if (voltageV <= kMinV)
    return 0;
  if (voltageV >= kMaxV)
    return 100;
  const float ratio = (voltageV - kMinV) / (kMaxV - kMinV);
  return static_cast<int>((ratio * 100.0f) + 0.5f);
}

// ============================================================
// Helper: read modem response with timeout
// ============================================================
String sim_readResponse(uint32_t timeoutMs) {
  String r = "";
  unsigned long t0 = millis();
  while (millis() - t0 < timeoutMs) {
    while (simSerial.available()) {
      r += (char)simSerial.read();
    }
    vTaskDelay(1);
  }
  return r;
}

// ============================================================
// Init modem
// ============================================================
void init_sim7680c() {
  logLine("[SIM7680C] Init...");
  SIM_setCapability(SIM_CAP_BOOTING);
  telemetrySetTrackSimCode(0);

  simMutex = xSemaphoreCreateMutex();
  if (!simMutex) {
    logLine("[SIM7680C] Mutex creation FAILED!");
  }

  simSerial.begin(MCU_SIM_BAUDRATE, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);

  // Handshake
  bool ready = false;
  for (int i = 0; i < 10; i++) {
    simSerial.println("AT");
    delay(100);
    if (simSerial.find("OK")) {
      ready = true;
      break;
    }
  }
  if (!ready) {
    logLine("[SIM7680C] No response!");
    SIM_setCapability(SIM_CAP_NONE);
    return;
  }
  SIM_setCapability(SIM_CAP_RADIO_OK);

  // Đồng bộ thời gian
  logLine("[SIM] Đang ép đồng bộ thời gian qua NTP...");
  simSerial.println("AT+CNTP=\"pool.ntp.org\",28"); // 28 là múi giờ +7 (7*4)
  delay(200);
  simSerial.println("AT+CNTP");
  delay(1000); // Chờ module xử lý
  String ntpResp = sim_readResponse(5000);
  logPrintf("[SIM] NTP Response: %s", ntpResp.c_str());

  // PDP context (Viettel)
  simSerial.println("AT+CGATT=1");
  delay(100);
  simSerial.println("AT+CGDCONT=1,\"IP\",\"v-internet\"");
  delay(100);
  simSerial.println("AT+CGACT=1,1");
  delay(100);

  // Enable network time sync (NITZ -> CCLK) as early as possible.
  simSerial.println("AT+CLTS=1");
  delay(150);
  sim_readResponse(300);
  simSerial.println("AT&W");
  delay(150);
  sim_readResponse(300);

  // SSL relaxed config (demo stability)
  simSerial.println("AT+CSSLCFG=\"sslversion\",0,3");
  delay(100);
  simSerial.println("AT+CSSLCFG=\"authmode\",0,0");
  delay(100);
  simSerial.println("AT+CSSLCFG=\"ignoretimediff\",0,1");
  delay(100);

  // SMS text mode + CLCC unsolicited
  const char *cmds[] = {
      "AT+CPIN?",  "AT+CSQ", "AT+CREG?", "AT+COPS?", "AT+CPSI?", "AT+CCLK?",
      "AT+CMGF=1", // SMS text mode
      "AT+CLCC=1", // enable +CLCC URC for call state
  };
  for (auto &cmd : cmds) {
    simSerial.println(cmd);
    delay(150);
    // Drain response
    unsigned long t = millis();
    while (millis() - t < 300)
      if (simSerial.available())
        simSerial.read();
  }

  if (sim_isRegistered()) {
    SIM_setCapability(SIM_CAP_VOICE_SMS_OK);
    sim_detectDataSession();
  }

  logPrintf("[SIM7680C] Init done, capability=%s",
            SIM_capabilityName(SIM_getCapability()));
}

void task_init_sim7680c(void *pvParameters) {
  init_sim7680c();
  vTaskDelete(NULL);
}

// ============================================================
// Network registration check
// ============================================================
bool sim_isRegistered() {
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  simSerial.println("AT+CREG?");
  String r = sim_readResponse(500);

  if (simMutex)
    xSemaphoreGive(simMutex);

  bool registered = (r.indexOf(",1") > 0 || r.indexOf(",5") > 0);
  if (registered) {
    if (SIM_getCapability() < SIM_CAP_VOICE_SMS_OK)
      SIM_setCapability(SIM_CAP_VOICE_SMS_OK);
  } else if (SIM_getCapability() > SIM_CAP_RADIO_OK) {
    SIM_setCapability(SIM_CAP_RADIO_OK);
  }
  return registered;
}

// ============================================================
// CSQ reading  (0-31 valid, 99=unknown)
// Mapping to 0..10:
//   CSQ   dBm         Level
//   0     -113        0
//   1     -111        0
//   2-9   -109..-97   1-3
//   10-14 -93..-85    4-5
//   15-19 -83..-75    6-7
//   20-24 -71..-63    8-9
//   25-31 -61..-51    10
//   99    unknown     0
// ============================================================
int sim_readCSQ() {
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  simSerial.println("AT+CSQ");
  String r = sim_readResponse(500);

  if (simMutex)
    xSemaphoreGive(simMutex);

  // Parse "+CSQ: xx,yy"
  int idx = r.indexOf("+CSQ: ");
  if (idx < 0)
    return 99;
  int comma = r.indexOf(",", idx);
  if (comma < 0)
    return 99;
  int csq = r.substring(idx + 6, comma).toInt();
  return csq;
}

int sim_getSignalLevel() {
  int csq = sim_readCSQ();
  if (csq == 99 || csq == 0)
    return 0;
  if (csq <= 1)
    return 0;
  if (csq <= 9)
    return (csq - 2) * 3 / 8 + 1; // ~1-3
  if (csq <= 14)
    return (csq - 10) + 4; // 4-8 mapped to 4-5
  if (csq <= 19)
    return 6 + (csq - 15) / 3; // 6-7
  if (csq <= 24)
    return 8 + (csq - 20) / 3; // 8-9
  return 10;
}

bool SIM_getBatteryStatus(int *percent, float *voltageV) {
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  simSerial.println("AT+CBC");
  String r = sim_readResponse(700);

  if (simMutex)
    xSemaphoreGive(simMutex);

  int idx = r.indexOf("+CBC: ");
  if (idx < 0)
    return false;

  int c1 = r.indexOf(',', idx + 6);
  int c2 = (c1 >= 0) ? r.indexOf(',', c1 + 1) : -1;
  if (c1 < 0 || c2 < 0)
    return false;

  const int rawPercent = r.substring(c1 + 1, c2).toInt();
  int end = r.indexOf("\r", c2 + 1);
  if (end < 0)
    end = r.indexOf("\n", c2 + 1);
  if (end < 0)
    end = r.length();
  const int millivolts = r.substring(c2 + 1, end).toInt();
  if (millivolts < 3000 || millivolts > 5000)
    return false;

  const float parsedVoltageV = millivolts / 1000.0f;
  const int inferredPercent = sim_voltageToBatteryPercent(parsedVoltageV);

  if (percent)
    *percent = inferredPercent;
  if (voltageV)
    *voltageV = parsedVoltageV;

  logPrintf("[SIM] Battery raw=%d%% inferred=%d%% %.3fV", rawPercent,
            inferredPercent, parsedVoltageV);
  return true;
}

// ============================================================
// Get Cell Info (MCC, MNC, LAC, CellID, Radio) via AT+CPSI?
// ============================================================
bool SIM_getCellInfo(int *mcc, int *mnc, int *lac, int *cellId, String *radio) {
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);
  simSerial.println("AT+CPSI?");
  String r = sim_readResponse(500);
  if (simMutex)
    xSemaphoreGive(simMutex);

  int idx = r.indexOf("+CPSI: ");
  if (idx < 0)
    return false;
  idx += 7;

  int p1 = r.indexOf(',', idx);
  if (p1 < 0)
    return false;
  String sysMode = r.substring(idx, p1);
  if (sysMode.indexOf("NO SERVICE") >= 0)
    return false;

  int p2 = r.indexOf(',', p1 + 1);
  if (p2 < 0)
    return false;

  int p3 = r.indexOf(',', p2 + 1);
  if (p3 < 0)
    return false;
  String mccMnc = r.substring(p2 + 1, p3);

  int p4 = r.indexOf(',', p3 + 1);
  if (p4 < 0)
    return false;
  String lacStr = r.substring(p3 + 1, p4);

  int p5 = r.indexOf(',', p4 + 1);
  if (p5 < 0)
    p5 = r.length();
  String cellIdStr = r.substring(p4 + 1, p5);

  if (mcc && mnc) {
    int dash = mccMnc.indexOf('-');
    if (dash > 0) {
      *mcc = mccMnc.substring(0, dash).toInt();
      *mnc = mccMnc.substring(dash + 1).toInt();
    }
  }

  if (lac) {
    if (lacStr.startsWith("0x") || lacStr.startsWith("0X"))
      *lac = strtol(lacStr.c_str() + 2, NULL, 16);
    else
      *lac = lacStr.toInt();
  }

  if (cellId) {
    if (cellIdStr.startsWith("0x") || cellIdStr.startsWith("0X"))
      *cellId = strtol(cellIdStr.c_str() + 2, NULL, 16);
    else
      *cellId = cellIdStr.toInt();
  }

  if (radio) {
    if (sysMode.indexOf("LTE") >= 0)
      *radio = "lte";
    else if (sysMode.indexOf("GSM") >= 0)
      *radio = "gsm";
    else if (sysMode.indexOf("WCDMA") >= 0)
      *radio = "umts";
    else
      *radio = "gsm";
  }
  return true;
}

// ============================================================
// Send SMS to a specific number
// ============================================================

bool SMS_DRY_RUN = true; // Đặt là true để chỉ LOG, false để GỬI THẬT
void SIM7680C_sendSMS_to(const char *number, const String &message) {
  if (!number || strlen(number) < 3)
    return;

  // LUÔN LOG RA TRƯỚC ĐỂ KIỂM TRA TỌA ĐỘ
  logPrintf("[SMS-LOG] Dự định gửi tới: %s", number);
  logPrintf("[SMS-LOG] Nội dung: %s", message.c_str());

  if (SMS_DRY_RUN) {
    logLine("[SMS-LOG] >>> CHẾ ĐỘ CHẠY THỬ: Đã chặn lệnh gửi thật để tiết kiệm "
            "chi phí.");
    return;
  }

  if (!SIM_hasCapability(SIM_CAP_VOICE_SMS_OK) && !sim_isRegistered()) {
    logLine("[SIM7680C] SMS skipped, chưa có sóng");
    return;
  }

  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  while (simSerial.available())
    simSerial.read();
  simSerial.printf("AT+CMGS=\"%s\"\r\n", number);

  bool gotPrompt = false;
  unsigned long waitT0 = millis();
  while (millis() - waitT0 < 5000) {
    if (simSerial.available() && simSerial.read() == '>') {
      gotPrompt = true;
      break;
    }
    vTaskDelay(1);
  }

  if (gotPrompt) {
    simSerial.print(message);
    vTaskDelay(pdMS_TO_TICKS(100));
    simSerial.write(26); // Ctrl+Z
    logLine("[SIM7680C] Lệnh gửi SMS đã thực thi.");
  } else {
    simSerial.write(27); // ESC hủy lệnh
    logLine("[SIM7680C] Lỗi: Không nhận được '>'");
  }

  if (simMutex)
    xSemaphoreGive(simMutex);
}
void SIM7680C_sendSMS(const String &mapLink) {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);

  String msg = String(cfg.smsTemplate) + " - Link: " + mapLink;
  msg += "\nWeb: https://thanhvu220809.github.io/gps-dashboard/";
  SIM7680C_sendSMS_to(cfg.call1, msg);
}

// ============================================================
// Call a number. Returns true if answered (detected via CLCC/VOICE CALL).
// ============================================================
bool SIM7680C_callNumber(const char *number, int ringSeconds) {
  if (!number || strlen(number) < 3)
    return false;

  if (SMS_DRY_RUN) {
    logPrintf("[CALL-LOG] >>> CHẾ ĐỘ CHẠY THỬ: Dự định gọi %s trong %ds",
              number, ringSeconds);
    return false;
  }

  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);
  logPrintf("[CALL] Dialing %s...", number);
  simSerial.printf("ATD%s;\r\n", number);

  unsigned long t0 = millis();
  bool answered = false;
  String res = "";

  while (millis() - t0 < (unsigned long)ringSeconds * 1000UL) {
    while (simSerial.available()) {
      char c = simSerial.read();
      res += c;
      if (res.indexOf("VOICE CALL: BEGIN") >= 0) {
        answered = true;
        break;
      }
    }
    if (answered || res.indexOf("NO CARRIER") >= 0)
      break;
    vTaskDelay(pdMS_TO_TICKS(50));
  }

  simSerial.println("ATH");
  if (simMutex)
    xSemaphoreGive(simMutex);
  return answered;
}

// ============================================================
// Call cascade: CALL_1 -> CALL_2 -> CALL_3 -> HOTLINE
// Stops if any call is answered.
// ============================================================
void SIM7680C_callCascade() {
  ConfigSnapshot cfg = {};
  getConfigSnapshot(&cfg);
  const char *numbers[] = {cfg.call1, cfg.call2, cfg.call3, cfg.hotline};
  const char *labels[] = {"CALL_1", "CALL_2", "CALL_3", "HOTLINE"};

  for (int i = 0; i < 4; i++) {
    if (sim_cancelRequested()) {
      logLine("[CALL] Cascade cancelled");
      return;
    }
    if (strlen(numbers[i]) < 3) {
      logPrintf("[CALL] %s empty, skip", labels[i]);
      continue;
    }
    logPrintf("[CALL] Cascade step %d: %s -> %s", i + 1, labels[i], numbers[i]);
    if (SIM7680C_callNumber(numbers[i], cfg.ringSeconds)) {
      logPrintf("[CALL] %s answered, cascade done", labels[i]);
      return;
    }
    if (sim_cancelRequested()) {
      logLine("[CALL] Cascade cancelled after step");
      return;
    }
    delay(2000); // brief pause between attempts
  }
  logLine("[CALL] Cascade exhausted, nobody answered");
}

// ============================================================
// HTTP POST via modem returning the response body
// ============================================================
bool SIM7680C_httpPostWithResponse(const String &url, const String &contentType,
                                   const String &body, String &outResponse) {
  outResponse = "";
  if (!SIM_hasCapability(SIM_CAP_DATA_OK) && !sim_detectDataSession())
    return false;
  if (telemetryIsSosActive())
    return false;
  if (SIM7680C_isTlsHostBlocked(url)) {
    logPrintf("[SIM-SSL] skip blocked host: %s", sim_extractHost(url).c_str());
    telemetrySetTrackSimCode(715);
    return false;
  }

  bool isHttps = url.startsWith("https");

  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  if (isHttps) {
    sim_configureHttpsContext(url);
  }

  simSerial.println("AT+HTTPINIT");
  String initResp = sim_readResponse(1000);
  if (initResp.indexOf("ERROR") >= 0) {
    simSerial.println("AT+HTTPTERM");
    delay(300);
    simSerial.println("AT+HTTPINIT");
    initResp = sim_readResponse(1000);
  }
  simSerial.println("AT+HTTPPARA=\"CID\",1");
  delay(100);
  simSerial.printf("AT+HTTPPARA=\"URL\",\"%s\"\r\n", url.c_str());
  delay(300);
  simSerial.println("AT+HTTPPARA=\"REDIR\",1");
  delay(100);
  simSerial.printf("AT+HTTPPARA=\"CONTENT\",\"%s\"\r\n", contentType.c_str());
  delay(200);

  simSerial.printf("AT+HTTPDATA=%d,5000\r\n", body.length());
  String dataPrompt = sim_readResponse(1500);
  if (dataPrompt.indexOf("DOWNLOAD") < 0) {
    logPrintf("[SIM7680C] HTTPDATA no prompt: %s", dataPrompt.c_str());
  }
  simSerial.print(body);
  delay(400);

  simSerial.println("AT+HTTPACTION=1");

  String actionResp = sim_readResponse(30000);
  bool ok = false;
  int dataLen = 0;
  int statusCode = -1;

  int si = actionResp.indexOf("+HTTPACTION: 1,");
  if (si != -1) {
    int ci = actionResp.indexOf(",", si + 15);
    if (ci != -1) {
      String st = actionResp.substring(si + 15, ci);
      statusCode = st.toInt();
      logPrintf("[SIM7680C] HTTP Status: %s", st.c_str());
      ok = (statusCode >= 200 && statusCode < 300);

      int ci2 = actionResp.indexOf("\r\n", ci + 1);
      if (ci2 == -1)
        ci2 = actionResp.length();
      dataLen = actionResp.substring(ci + 1, ci2).toInt();
    }
  } else {
    logPrintf("[SIM7680C] HTTPACTION missing: %s", actionResp.c_str());
  }

  if (dataLen > 0) {
    simSerial.printf("AT+HTTPREAD=0,%d\r\n", dataLen);
    String readResp = sim_readResponse(2000 + dataLen);

    // Parse:
    // +HTTPREAD: <len>\r\n
    // <payload>\r\n
    // OK
    int hreadIdx = readResp.indexOf("+HTTPREAD: ");
    if (hreadIdx >= 0) {
      int nlIdx = readResp.indexOf("\r\n", hreadIdx);
      if (nlIdx > 0) {
        int endIdx = readResp.lastIndexOf("\r\nOK");
        if (endIdx > nlIdx) {
          outResponse = readResp.substring(nlIdx + 2, endIdx);
        } else {
          outResponse = readResp.substring(nlIdx + 2);
        }
      }
    }
    if (!ok && outResponse.length() > 0) {
      logPrintf("[SIM7680C] HTTP error body: %s", outResponse.c_str());
    }
  } else if (!ok) {
    logPrintf("[SIM7680C] HTTP failure status=%d len=%d", statusCode, dataLen);
  }

  if (sim_isTlsHandshakeFailureCode(statusCode))
    sim_blockHost(sim_extractHost(url));

  simSerial.println("AT+HTTPTERM");
  delay(200);
  while (simSerial.available())
    simSerial.read();

  if (simMutex)
    xSemaphoreGive(simMutex);

  return ok;
}

// ============================================================
// HTTP POST via modem
// ============================================================
bool SIM7680C_httpPost(const String &url, const String &contentType,
                       const String &body) {
  if (!SIM_hasCapability(SIM_CAP_DATA_OK) && !sim_detectDataSession())
    return false;
  if (telemetryIsSosActive())
    return false; // don't use modem during SOS
  if (SIM7680C_isTlsHostBlocked(url)) {
    logPrintf("[SIM-SSL] skip blocked host: %s", sim_extractHost(url).c_str());
    telemetrySetTrackSimCode(715);
    return false;
  }
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  bool isHttps = url.startsWith("https");

  if (isHttps) {
    sim_configureHttpsContext(url);
  }

  simSerial.println("AT+HTTPINIT");
  String initResp = sim_readResponse(1000);
  if (initResp.indexOf("ERROR") >= 0) {
    simSerial.println("AT+HTTPTERM");
    delay(300);
    simSerial.println("AT+HTTPINIT");
    initResp = sim_readResponse(1000);
  }
  simSerial.println("AT+HTTPPARA=\"CID\",1");
  delay(100);
  simSerial.printf("AT+HTTPPARA=\"URL\",\"%s\"\r\n", url.c_str());
  delay(300);
  simSerial.println("AT+HTTPPARA=\"REDIR\",1");
  delay(100);
  simSerial.printf("AT+HTTPPARA=\"CONTENT\",\"%s\"\r\n", contentType.c_str());
  delay(200);

  simSerial.printf("AT+HTTPDATA=%d,5000\r\n", body.length());
  String dataPrompt = sim_readResponse(1500);
  if (dataPrompt.indexOf("DOWNLOAD") < 0) {
    logPrintf("[SIM7680C] HTTPDATA no prompt: %s", dataPrompt.c_str());
  }
  simSerial.print(body);
  delay(400);

  simSerial.println("AT+HTTPACTION=1"); // POST

  String response = sim_readResponse(30000);
  bool ok = false;
  telemetrySetTrackSimCode(-1);

  int si = response.indexOf("+HTTPACTION: 1,");
  int statusCode = -1;
  if (si != -1) {
    int ci = response.indexOf(",", si + 15);
    if (ci != -1) {
      String st = response.substring(si + 15, ci);
      statusCode = st.toInt();
      telemetrySetTrackSimCode(statusCode);
      logPrintf("[SIM7680C] HTTP Status: %s", st.c_str());
      ok = (statusCode >= 200 && statusCode < 300);
    }
  }

  simSerial.println("AT+HTTPTERM");
  delay(200);
  while (simSerial.available())
    simSerial.read();

  if (simMutex)
    xSemaphoreGive(simMutex);

  if (sim_isTlsHandshakeFailureCode(statusCode))
    sim_blockHost(sim_extractHost(url));

  if (ok)
    SIM_setCapability(SIM_CAP_HTTP_OK);
  else if (SIM_hasCapability(SIM_CAP_HTTP_OK))
    SIM_setCapability(SIM_CAP_DATA_OK);

  return ok;
}

// ============================================================
// Read network time from SIM module (AT+CCLK?)
// Response format: +CCLK: "YY/MM/DD,HH:MM:SS+TZ"
// TZ is in quarter-hours offset from UTC
// Returns true if valid time was parsed. Output is UTC.
// ============================================================
bool SIM_getNetworkTime(int *year, int *month, int *day, int *hour, int *minute,
                        int *second) {
  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  simSerial.println("AT+CCLK?");
  String resp = sim_readResponse(1000);

  if (simMutex)
    xSemaphoreGive(simMutex);

  // Parse +CCLK: "YY/MM/DD,HH:MM:SS+TZ" or "YY/MM/DD,HH:MM:SS-TZ"
  int idx = resp.indexOf("+CCLK: \"");
  if (idx < 0) {
    logLine("[SIM] AT+CCLK? no response");
    return false;
  }
  idx += 8; // skip to YY

  // YY/MM/DD,HH:MM:SS+TZ
  int yy, mo, dd, hh, mn, ss, tz = 0;
  char tzSign = '+';

  // Manual parse to handle +/- timezone
  if (sscanf(resp.c_str() + idx, "%d/%d/%d,%d:%d:%d", &yy, &mo, &dd, &hh, &mn,
             &ss) < 6) {
    logPrintf("[SIM] CCLK parse fail: %s", resp.c_str() + idx);
    return false;
  }

  // Find timezone offset
  int tzIdx = resp.indexOf('+', idx + 15);
  if (tzIdx < 0)
    tzIdx = resp.indexOf('-', idx + 15);
  if (tzIdx > 0) {
    tzSign = resp[tzIdx];
    tz = resp.substring(tzIdx + 1).toInt();
  }

  // Convert YY to full year
  int fullYear = (yy < 80) ? (2000 + yy) : (1900 + yy);

  // Convert to UTC: tz is in quarter-hours
  int tzOffsetMinutes = tz * 15;
  if (tzSign == '+')
    tzOffsetMinutes = -tzOffsetMinutes; // subtract to get UTC
  else
    tzOffsetMinutes = tzOffsetMinutes; // add to get UTC

  // Simple adjustment: just adjust hours and minutes
  mn += tzOffsetMinutes % 60;
  hh += tzOffsetMinutes / 60;

  // Normalize
  while (mn < 0) {
    mn += 60;
    hh--;
  }
  while (mn >= 60) {
    mn -= 60;
    hh++;
  }
  while (hh < 0) {
    hh += 24;
    dd--;
  }
  while (hh >= 24) {
    hh -= 24;
    dd++;
  }
  // Note: day rollover across months not handled perfectly,
  // but the time accuracy (2s) makes this acceptable

  // Sanity check
  if (fullYear < 2024 || fullYear > 2035) {
    logPrintf(
        "[SIM] Warning: Implausible year %d, but trying to sync anyway...",
        fullYear);
    return false;
  }

  *year = fullYear;
  *month = mo;
  *day = dd;
  *hour = hh;
  *minute = mn;
  *second = ss;

  logPrintf("[SIM] Network time (UTC): %04d-%02d-%02d %02d:%02d:%02d", fullYear,
            mo, dd, hh, mn, ss);

  return true;
}

// ============================================================
// HTTP GET via SIM modem — downloads binary content to LittleFS
//
// Uses AT+HTTPINIT, AT+HTTPPARA, AT+HTTPACTION=0 (GET),
// AT+HTTPREAD to retrieve binary data.
//
// SSL is configured during init_sim7680c().
// Returns bytes downloaded, or 0 on failure.
// ============================================================
int SIM7680C_httpGetToFile(const String &url, const char *filePath) {
  if (!SIM_hasCapability(SIM_CAP_DATA_OK)) {
    logLine("[SIM-GET] No data capability");
    return 0;
  }
  if (telemetryIsSosActive()) {
    logLine("[SIM-GET] SOS active, skip");
    return 0;
  }
  if (SIM7680C_isTlsHostBlocked(url)) {
    logPrintf("[SIM-SSL] skip blocked host: %s", sim_extractHost(url).c_str());
    return 0;
  }

  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  logPrintf("[SIM-GET] URL: %s", url.c_str());

  // Enable SSL for HTTPS
  bool isHttps = url.startsWith("https");
  if (isHttps) {
    sim_configureHttpsContext(url);
  }

  // Init HTTP service
  simSerial.println("AT+HTTPINIT");
  String r = sim_readResponse(1000);
  if (r.indexOf("ERROR") >= 0) {
    // Might be already initialized, try to terminate and retry
    simSerial.println("AT+HTTPTERM");
    delay(500);
    simSerial.println("AT+HTTPINIT");
    r = sim_readResponse(1000);
  }

  simSerial.println("AT+HTTPPARA=\"CID\",1");
  delay(100);
  simSerial.printf("AT+HTTPPARA=\"URL\",\"%s\"\r\n", url.c_str());
  delay(300);
  simSerial.println("AT+HTTPPARA=\"REDIR\",1"); // follow redirects
  delay(100);

  // Start GET request
  simSerial.println("AT+HTTPACTION=0");

  // Wait for +HTTPACTION response (up to 30s for SSL + download)
  String actionResp = "";
  unsigned long t0 = millis();
  bool gotAction = false;
  while (millis() - t0 < 30000) {
    while (simSerial.available()) {
      char c = simSerial.read();
      actionResp += c;
    }
    if (actionResp.indexOf("+HTTPACTION:") >= 0) {
      gotAction = true;
      break;
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }

  if (!gotAction) {
    logLine("[SIM-GET] HTTPACTION timeout");
    simSerial.println("AT+HTTPTERM");
    delay(200);
    while (simSerial.available())
      simSerial.read();
    if (simMutex)
      xSemaphoreGive(simMutex);
    return 0;
  }

  // Parse +HTTPACTION: 0,<status>,<datalen>
  int statusCode = 0;
  int dataLen = 0;
  int ai = actionResp.indexOf("+HTTPACTION: 0,");
  if (ai >= 0) {
    int c1 = actionResp.indexOf(",", ai + 15);
    if (c1 > 0) {
      statusCode = actionResp.substring(ai + 15, c1).toInt();
      dataLen = actionResp.substring(c1 + 1).toInt();
    }
  }

  logPrintf("[SIM-GET] HTTP %d, %d bytes", statusCode, dataLen);

  if (sim_isTlsHandshakeFailureCode(statusCode))
    sim_blockHost(sim_extractHost(url));

  if (statusCode != 200 || dataLen < 256) {
    logPrintf("[SIM-GET] Bad response: status=%d len=%d", statusCode, dataLen);
    simSerial.println("AT+HTTPTERM");
    delay(200);
    while (simSerial.available())
      simSerial.read();
    if (simMutex)
      xSemaphoreGive(simMutex);
    return 0;
  }

  // Read data in chunks and save to file
  if (!LittleFS.begin(true)) {
    logLine("[SIM-GET] LittleFS mount failed");
    simSerial.println("AT+HTTPTERM");
    delay(200);
    if (simMutex)
      xSemaphoreGive(simMutex);
    return 0;
  }

  File f = LittleFS.open(filePath, "w");
  if (!f) {
    logPrintf("[SIM-GET] Cannot open %s for write", filePath);
    simSerial.println("AT+HTTPTERM");
    delay(200);
    if (simMutex)
      xSemaphoreGive(simMutex);
    return 0;
  }

  int totalRead = 0;
  const int chunkSize = 512;

  while (totalRead < dataLen) {
    int toRead = dataLen - totalRead;
    if (toRead > chunkSize)
      toRead = chunkSize;

    simSerial.printf("AT+HTTPREAD=%d,%d\r\n", totalRead, toRead);

    // Wait for +HTTPREAD: <len>\r\n then binary data follows
    // IMPORTANT: binary payload bytes may arrive mixed with the header.
    // We must extract any spillover bytes from readResp after the \n.
    uint8_t rawBuf[768]; // header + possible spillover
    int rawLen = 0;
    t0 = millis();
    bool gotReadHeader = false;
    int expectedBytes = 0;
    int headerEndIdx = -1; // index in rawBuf where payload starts

    while (millis() - t0 < 5000 && rawLen < (int)sizeof(rawBuf)) {
      while (simSerial.available() && rawLen < (int)sizeof(rawBuf)) {
        rawBuf[rawLen++] = simSerial.read();
      }

      // Scan for "+HTTPREAD: " in what we have so far
      // We work on raw bytes to preserve binary payload
      for (int s = 0; s < rawLen - 12; s++) {
        if (memcmp(rawBuf + s, "+HTTPREAD: ", 11) == 0) {
          // Find \n after the length value
          for (int e = s + 11; e < rawLen; e++) {
            if (rawBuf[e] == '\n') {
              // Parse length from rawBuf[s+11..e-1]
              char numBuf[16] = {0};
              int numLen = e - (s + 11);
              if (numLen > 0 && numLen < 15) {
                memcpy(numBuf, rawBuf + s + 11, numLen);
                expectedBytes = atoi(numBuf);
              }
              headerEndIdx = e + 1; // payload starts here
              gotReadHeader = true;
              break;
            }
          }
          if (gotReadHeader)
            break;
        }
      }
      if (gotReadHeader)
        break;
      vTaskDelay(pdMS_TO_TICKS(10));
    }

    if (!gotReadHeader || expectedBytes <= 0) {
      logPrintf("[SIM-GET] Read chunk failed at offset %d", totalRead);
      break;
    }

    // Write spillover bytes (payload that arrived with header)
    uint8_t buf[512];
    int bytesGot = 0;
    int spillover = rawLen - headerEndIdx;
    if (spillover > 0 && spillover <= expectedBytes) {
      int toCopy =
          (spillover > (int)sizeof(buf)) ? (int)sizeof(buf) : spillover;
      memcpy(buf, rawBuf + headerEndIdx, toCopy);
      bytesGot = toCopy;
    }

    // Read remaining binary bytes from UART
    t0 = millis();
    while (bytesGot < expectedBytes && millis() - t0 < 5000) {
      if (simSerial.available()) {
        buf[bytesGot++] = simSerial.read();
      } else {
        vTaskDelay(1);
      }
    }

    if (bytesGot > 0) {
      f.write(buf, bytesGot);
      totalRead += bytesGot;
    }

    // Drain any trailing OK/newlines
    delay(50);
    while (simSerial.available())
      simSerial.read();
  }

  f.close();

  // Terminate HTTP session
  simSerial.println("AT+HTTPTERM");
  delay(200);
  while (simSerial.available())
    simSerial.read();

  if (simMutex)
    xSemaphoreGive(simMutex);

  logPrintf("[SIM-GET] Downloaded %d/%d bytes to %s", totalRead, dataLen,
            filePath);

  if (totalRead > 0)
    SIM_setCapability(SIM_CAP_HTTP_OK);

  return totalRead;
}

bool SIM7680C_httpGetWithResponse(const String &url, String &outResponse) {
  outResponse = "";
  if (!SIM_hasCapability(SIM_CAP_DATA_OK) && !sim_detectDataSession())
    return false;
  if (telemetryIsSosActive())
    return false;
  if (SIM7680C_isTlsHostBlocked(url)) {
    logPrintf("[SIM-SSL] skip blocked host: %s", sim_extractHost(url).c_str());
    return false;
  }

  if (simMutex)
    xSemaphoreTake(simMutex, portMAX_DELAY);

  logPrintf("[SIM-GET] URL: %s", url.c_str());

  bool isHttps = url.startsWith("https");
  if (isHttps) {
    sim_configureHttpsContext(url);
  }

  simSerial.println("AT+HTTPINIT");
  String r = sim_readResponse(1000);
  if (r.indexOf("ERROR") >= 0) {
    simSerial.println("AT+HTTPTERM");
    delay(500);
    simSerial.println("AT+HTTPINIT");
    r = sim_readResponse(1000);
  }

  simSerial.println("AT+HTTPPARA=\"CID\",1");
  delay(100);
  simSerial.printf("AT+HTTPPARA=\"URL\",\"%s\"\r\n", url.c_str());
  delay(300);
  simSerial.println("AT+HTTPPARA=\"REDIR\",1");
  delay(100);
  simSerial.println("AT+HTTPACTION=0");

  String actionResp = "";
  unsigned long t0 = millis();
  bool gotAction = false;
  while (millis() - t0 < 30000) {
    while (simSerial.available()) {
      char c = simSerial.read();
      actionResp += c;
    }
    if (actionResp.indexOf("+HTTPACTION:") >= 0) {
      gotAction = true;
      break;
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }

  int statusCode = 0;
  int dataLen = 0;
  if (gotAction) {
    int ai = actionResp.indexOf("+HTTPACTION: 0,");
    if (ai >= 0) {
      int c1 = actionResp.indexOf(",", ai + 15);
      if (c1 > 0) {
        statusCode = actionResp.substring(ai + 15, c1).toInt();
        dataLen = actionResp.substring(c1 + 1).toInt();
      }
    }
  } else {
    logPrintf("[SIM-GET] HTTPACTION missing: %s", actionResp.c_str());
  }

  logPrintf("[SIM-GET] HTTP %d, %d bytes", statusCode, dataLen);

  if (sim_isTlsHandshakeFailureCode(statusCode))
    sim_blockHost(sim_extractHost(url));

  bool ok = false;
  if (statusCode == 200 && dataLen > 0) {
    simSerial.printf("AT+HTTPREAD=0,%d\r\n", dataLen);
    String readResp = sim_readResponse(2000 + dataLen);
    int hreadIdx = readResp.indexOf("+HTTPREAD: ");
    if (hreadIdx >= 0) {
      int nlIdx = readResp.indexOf("\r\n", hreadIdx);
      if (nlIdx > 0) {
        int endIdx = readResp.lastIndexOf("\r\nOK");
        if (endIdx > nlIdx) {
          outResponse = readResp.substring(nlIdx + 2, endIdx);
        } else {
          outResponse = readResp.substring(nlIdx + 2);
        }
      }
    }
    ok = outResponse.length() > 0;
  }

  simSerial.println("AT+HTTPTERM");
  delay(200);
  while (simSerial.available())
    simSerial.read();
  if (simMutex)
    xSemaphoreGive(simMutex);

  return ok;
}
