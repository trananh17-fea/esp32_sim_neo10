#include "webserver.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "Storage/Storage.h"
#include "geofencing/geofencing.h"
#include "tracking/tracking.h"
#include <AsyncTCP.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>

static AsyncWebServer server(80);
static DNSServer dnsServer;
static const byte DNS_PORT = 53;
static IPAddress apIP(192, 168, 4, 1);

// ============================================================
// JSON-safe string escape (handles " and \)
// ============================================================
static String jsonEsc(const char *s) {
  String out;
  out.reserve(strlen(s) + 8);
  while (*s) {
    if (*s == '"' || *s == '\\')
      out += '\\';
    out += *s++;
  }
  return out;
}

// ============================================================
// Portal HTML — dark gradient, status chips, clean form
// ~3.5KB embedded, zero external dependencies
// ============================================================
static const char PORTAL_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head>
<meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>SOS GPS Tracker</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0b1222;color:#f1f5f9;min-height:100vh}
.hd{background:linear-gradient(135deg,#0ea5e9,#7c3aed);padding:24px 16px 18px;text-align:center}
.hd h1{font-size:20px;font-weight:800;letter-spacing:.2px}
.st{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:14px}
.ch{background:rgba(0,0,0,.22);padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;border:1.5px solid rgba(148,163,184,.35);transition:all .25s}
.ch.g{border-color:#22c55e;color:#4ade80}
.ch.y{border-color:#f59e0b;color:#fbbf24}
.ch.r{border-color:#ef4444;color:#f87171}
.mn{max-width:430px;margin:0 auto;padding:16px}
.cd{background:#111b32;border-radius:18px;padding:20px;box-shadow:0 6px 28px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.06)}
label{display:block;font-size:11px;color:#94a3b8;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.8px;font-weight:700}
label:first-child{margin-top:0}
input,textarea{width:100%;padding:12px 14px;background:#0b1222;border:1px solid rgba(148,163,184,.25);border-radius:12px;color:#f1f5f9;font-size:15px;transition:border .2s,box-shadow .2s}
input:focus,textarea:focus{outline:none;border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.15)}
input::placeholder,textarea::placeholder{color:#64748b}
textarea{resize:vertical;font-family:inherit;min-height:66px}
.bt{display:block;width:100%;padding:14px;border:none;border-radius:14px;font-weight:900;font-size:15px;cursor:pointer;transition:transform .15s,opacity .15s;letter-spacing:.2px}
.bt:active{transform:scale(.98)}
.bt:disabled{opacity:.35;cursor:not-allowed;transform:none}
.row{display:flex;gap:10px;margin-top:14px}
.row .bt{flex:1}
.bp{background:linear-gradient(135deg,#22c55e,#16a34a);color:#05140c;box-shadow:0 2px 14px rgba(34,197,94,.18)}
.bh{background:linear-gradient(135deg,#60a5fa,#38bdf8);color:#061220;box-shadow:0 2px 14px rgba(56,189,248,.18)}
.card2{margin-top:14px;padding:14px;border-radius:16px;background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.12)}
.kv{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#cbd5e1;margin-top:8px}
.kv:first-child{margin-top:0}
.kv b{color:#f1f5f9}
.sub{font-size:12px;color:#94a3b8;margin-top:10px;line-height:1.35}
.hn{font-size:12px;color:#94a3b8;margin-top:12px;text-align:center}
.tt{position:fixed;top:18px;left:50%;transform:translateX(-50%) translateY(-110px);padding:12px 26px;border-radius:14px;font-size:14px;font-weight:900;z-index:99;transition:transform .35s cubic-bezier(.34,1.56,.64,1);pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.tt.s{transform:translateX(-50%) translateY(0);background:#22c55e;color:#fff}
.tt.e{transform:translateX(-50%) translateY(0);background:#ef4444;color:#fff}
</style></head><body>
<div class=hd>
  <h1>📡 SOS GPS Tracker</h1>
  <div class=st>
    <span class=ch id=sg>GPS: --</span>
    <span class=ch id=sd>Khoảng cách: --</span>
    <span class=ch id=gf>Vùng: --</span>
    <span class=ch id=s4>4G: --</span>
    <span class=ch id=sw>WiFi: --</span>
  </div>
</div>

<div class=mn><div class=cd>
  <label>Số điện thoại 1</label>
  <input id=p1 type=tel placeholder="Ví dụ: 077xxxxxxx hoặc +84...">
  <label>Số điện thoại 2</label>
  <input id=p2 type=tel placeholder="(tuỳ chọn)">
  <label>Số điện thoại 3</label>
  <input id=p3 type=tel placeholder="(tuỳ chọn)">
  <label>Lời nhắn SMS</label>
  <textarea id=ms placeholder="Ví dụ: Tôi cần hỗ trợ khẩn cấp..."></textarea>

  <div class=card2>
    <div class=kv><span>HOME</span><b id=home>Chưa có</b></div>
    <div class=kv><span>Khoảng cách tới HOME</span><b id=dist>--</b></div>
    <div class=kv><span>Geofence</span><b id=geo>--</b></div>
    <div class=sub>• <b>Lưu HOME</b> sẽ lấy vị trí GPS hiện tại làm “nhà”.</div>
    <div class=sub>• Trạng thái chi tiết (GPS/sóng/cảnh báo) xem ở Serial log.</div>
  </div>

  <div class=row>
    <button class="bt bp" id=bs onclick=sv()>Lưu cấu hình</button>
    <button class="bt bh" id=bh onclick=sh() disabled>Lưu HOME</button>
  </div>

  <div class=hn>HOTLINE: <b>0982690587</b></div>
</div></div>

<div class=tt id=tt></div>
<script>
var $=function(i){return document.getElementById(i)};
function toast(m,ok){var t=$('tt');t.textContent=m;t.className='tt '+(ok?'s':'e');setTimeout(function(){t.className='tt'},2500)}
function N(p){p=(p||'').trim();if(p.charAt(0)==='0'&&p.length>8)return'+84'+p.substring(1);return p}
function init(){fetch('/config').then(function(r){return r.json()}).then(function(c){
  $('p1').value=c.c1||'';$('p2').value=c.c2||'';$('p3').value=c.c3||'';$('ms').value=c.sms||''
}).catch(function(){})}
function sv(){var b=$('bs');b.disabled=true;b.textContent='Đang lưu...';
  var d='c1='+encodeURIComponent(N($('p1').value))+'&c2='+encodeURIComponent(N($('p2').value))+'&c3='+encodeURIComponent(N($('p3').value))+'&sms='+encodeURIComponent($('ms').value);
  fetch('/save_config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:d})
    .then(function(r){toast(r.ok?'Đã lưu cấu hình!':'Lỗi lưu cấu hình',r.ok)})
    .catch(function(){toast('Không thể lưu',false)})
    .finally(function(){b.disabled=false;b.textContent='Lưu cấu hình'})}
function sh(){var b=$('bh');b.disabled=true;b.textContent='Đang lưu...';
  fetch('/save_home',{method:'POST'}).then(function(r){return r.json()}).then(function(j){
    toast(j.ok?'Đã lưu HOME!':(j.msg||'GPS chưa có fix'),('ok' in j&&j.ok))
  }).catch(function(){toast('Không thể lưu',false)})
    .finally(function(){b.disabled=false;b.textContent='Lưu HOME'})}
function cl(v){return v>6?'g':v>3?'y':'r'}
function poll(){fetch('/status').then(function(r){return r.json()}).then(function(s){
  $('sg').textContent='GPS: '+(s.fix?('FIX • '+s.sats+' vệ tinh'):'NO FIX');$('sg').className='ch '+(s.fix?'g':'r');
  var dOk=(s.dist>=0);
  $('sd').textContent='Khoảng cách: '+(dOk?Math.round(s.dist)+'m':'--');$('sd').className='ch '+(dOk?'g':'');
  $('gf').textContent='Vùng: '+(s.geo_en?('ON • '+s.geo_rad+'m'):'OFF');$('gf').className='ch '+(s.geo_en?'y':'');
  $('s4').textContent='4G: '+s.c4+'/10';$('s4').className='ch '+cl(s.c4);
  $('sw').textContent='WiFi: '+s.wf+'/10';$('sw').className='ch '+cl(s.wf);
  $('home').textContent=s.has_home?'Đã có':'Chưa có';
  $('dist').textContent=dOk?(Math.round(s.dist)+' m'):'--';
  $('geo').textContent=s.geo_en?('Bật • bán kính '+s.geo_rad+'m'):'Tắt';
  $('bh').disabled=!s.fix;
}).catch(function(){})}
init();poll();setInterval(poll,2000);
</script></body></html>
)HTML";

// ============================================================
void initFriendlyNamePortal() {
  dnsServer.start(DNS_PORT, "*", apIP);

  // --- Main page ---
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "text/html", PORTAL_HTML);
  });

  // --- GET /config → JSON for form prefill ---
  server.on("/config", HTTP_GET, [](AsyncWebServerRequest *r) {
    String j = "{\"c1\":\"" + jsonEsc(CALL_1) +
               "\","
               "\"c2\":\"" +
               jsonEsc(CALL_2) +
               "\","
               "\"c3\":\"" +
               jsonEsc(CALL_3) +
               "\","
               "\"sms\":\"" +
               jsonEsc(SMS_TEMPLATE) +
               "\","
               "\"home\":" +
               String((HOME_LAT != 0 || HOME_LNG != 0) ? "true" : "false") +
               ",\"geo_en\":" + String(GEOFENCE_ENABLE ? "true" : "false") +
               ",\"geo_rad\":" + String(GEOFENCE_RADIUS_M) +
               "}";
    r->send(200, "application/json", j);
  });

  // --- POST /save_config → phones + SMS only, other settings untouched ---
  server.on("/save_config", HTTP_POST, [](AsyncWebServerRequest *r) {
    auto val = [&](const char *n) -> String {
      return r->hasParam(n, true) ? r->getParam(n, true)->value() : String("");
    };

    strncpy(CALL_1, val("c1").c_str(), sizeof(CALL_1) - 1);
    CALL_1[sizeof(CALL_1) - 1] = '\0';
    strncpy(CALL_2, val("c2").c_str(), sizeof(CALL_2) - 1);
    CALL_2[sizeof(CALL_2) - 1] = '\0';
    strncpy(CALL_3, val("c3").c_str(), sizeof(CALL_3) - 1);
    CALL_3[sizeof(CALL_3) - 1] = '\0';
    strncpy(SMS_TEMPLATE, val("sms").c_str(), sizeof(SMS_TEMPLATE) - 1);
    SMS_TEMPLATE[sizeof(SMS_TEMPLATE) - 1] = '\0';

    // Update legacy copies
    strncpy(PHONE, CALL_1, sizeof(PHONE) - 1);
    strncpy(SMS, SMS_TEMPLATE, sizeof(SMS) - 1);

    // Save ONLY these 4 fields to NVS (nothing else disturbed)
    nvs_set_str(nvsHandle, "CALL_1", CALL_1);
    nvs_set_str(nvsHandle, "CALL_2", CALL_2);
    nvs_set_str(nvsHandle, "CALL_3", CALL_3);
    nvs_set_str(nvsHandle, "SMS_TPL", SMS_TEMPLATE);
    nvs_commit(nvsHandle);

    Serial.printf("[PORTAL] Saved: C1=%s C2=%s C3=%s\n", CALL_1, CALL_2,
                  CALL_3);
    r->send(200, "text/plain", "OK");
  });

  // --- POST /save_home → save current GPS as HOME ---
  server.on("/save_home", HTTP_POST, [](AsyncWebServerRequest *r) {
    if (!GPS_READY) {
      r->send(200, "application/json", "{\"ok\":false,\"msg\":\"No GPS fix\"}");
      return;
    }
    double lat = GPS_getLatitude();
    double lng = GPS_getLongitude();
    if (lat == 0 && lng == 0) {
      r->send(200, "application/json",
              "{\"ok\":false,\"msg\":\"GPS position is 0,0\"}");
      return;
    }
    saveHomeLocation(lat, lng);
    r->send(200, "application/json", "{\"ok\":true}");
  });

  // --- GET /status → combined GPS + signal + distance (one request) ---
  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *r) {
    bool fix = GPS_READY;
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    double lat = GPS_getLatitude();
    double lng = GPS_getLongitude();
    bool hasHome = (HOME_LAT != 0 || HOME_LNG != 0);
    double dist = -1;
    if (hasHome && fix && (lat != 0 || lng != 0))
      dist = calculateDistance(lat, lng, HOME_LAT, HOME_LNG);

    char buf[192];
    snprintf(buf, sizeof(buf),
             "{\"fix\":%s,\"sats\":%d,\"dist\":%.1f,"
             "\"c4\":%d,\"wf\":%d,\"has_home\":%s,"
             "\"geo_en\":%s,\"geo_rad\":%d}",
             fix ? "true" : "false", sats, dist, (int)SIGNAL_4G,
             (int)SIGNAL_WIFI, hasHome ? "true" : "false",
             GEOFENCE_ENABLE ? "true" : "false", (int)GEOFENCE_RADIUS_M);
    r->send(200, "application/json", buf);
  });

  // --- Hidden debug endpoints (accessible by URL only) ---
  server.on("/track_test", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "application/json", trackingTestRequest());
  });

  server.on("/assist_status", HTTP_GET, [](AsyncWebServerRequest *r) {
    char buf[80];
    snprintf(buf, sizeof(buf), "{\"status\":\"%s\",\"ready\":%s}",
             ASSIST_STATUS, ASSIST_READY ? "true" : "false");
    r->send(200, "application/json", buf);
  });

  // --- Captive portal: redirect any URL to "/" ---
  server.onNotFound(
      [](AsyncWebServerRequest *r) { r->redirect("http://192.168.4.1/"); });

  server.begin();
  Serial.println("[PORTAL] http://192.168.4.1 (or any URL on AP)");
}

void loopFriendlyNamePortal() { dnsServer.processNextRequest(); }
