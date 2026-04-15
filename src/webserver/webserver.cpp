#include "webserver.h"
#include "Config.h"
#include "DATAEG/SIM7680C.h"
#include "GPS/gps.h"
#include "Storage/Storage.h"
#include "WiFiManager/WiFiManager.h"
#include "geofencing/geofencing.h"
#include "network_location/location.h"
#include "tracking/tracking.h"
#include <AsyncTCP.h>
#include <DNSServer.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <math.h>

static AsyncWebServer server(80);
static DNSServer dnsServer;
static const byte DNS_PORT = 53;
static IPAddress apIP(192, 168, 4, 1);
static bool dnsServerStarted = false;

static bool portalApActive() {
  return (WiFi.getMode() & WIFI_MODE_AP) != 0 && WiFi.softAPIP() != IPAddress();
}

static void syncPortalDnsState() {
  const bool apActive = portalApActive();

  if (apActive && !dnsServerStarted) {
    dnsServer.start(DNS_PORT, "*", apIP);
    dnsServerStarted = true;
    logLine("[PORTAL] Captive DNS started");
    return;
  }

  if (!apActive && dnsServerStarted) {
    dnsServer.stop();
    dnsServerStarted = false;
    logLine("[PORTAL] Captive DNS stopped");
  }
}

// ============================================================
// JSON-safe string escape for small config strings.
// ============================================================
static String jsonEsc(const char *s) {
  if (!s)
    return String("");

  String out;
  out.reserve(strlen(s) + 8);
  while (*s) {
    const char c = *s++;
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if (c == '\n') {
      out += "\\n";
    } else if (c == '\r') {
      out += "\\r";
    } else if (c == '\t') {
      out += "\\t";
    } else if (static_cast<uint8_t>(c) >= 0x20) {
      out += c;
    }
  }
  return out;
}

// ============================================================
// Portal HTML - WiFi AP customer-facing UI, zero external dependencies.
// ============================================================
static const char PORTAL_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SOS GPS Tracker</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f6efe7;color:#4e3425;min-height:100vh}
.wrap{max-width:480px;margin:0 auto;padding:18px 14px 24px}
.hd{background:linear-gradient(135deg,#b67c52,#8d5e3c);color:#fff;border-radius:18px;padding:20px 16px;text-align:center;box-shadow:0 10px 24px rgba(86,53,32,.25)}
.hd h1{font-size:20px;font-weight:800;letter-spacing:.2px}
.st{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.ch{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4)}
.ch.g{background:#f0f9eb;color:#3f6f2a;border-color:#d2e8bf}
.ch.y{background:#fff8e8;color:#8a651e;border-color:#f0ddaa}
.ch.r{background:#fff0ee;color:#8f3b34;border-color:#efc3bd}
.card{margin-top:14px;background:#fff;border-radius:18px;padding:18px;border:1px solid #e3d2c3;box-shadow:0 8px 22px rgba(111,74,47,.12)}
label{display:block;font-size:12px;font-weight:700;color:#7a5133;margin:12px 0 6px}
label:first-child{margin-top:0}
input,textarea,select{width:100%;padding:12px;border:1px solid #d8c0ad;border-radius:12px;background:#fffdfa;color:#4e3425;font-size:15px}
textarea{resize:vertical;min-height:78px;font-family:inherit}
input:focus,textarea:focus,select:focus{outline:none;border-color:#a56a43;box-shadow:0 0 0 3px rgba(165,106,67,.16)}
.ib{display:flex;gap:8px}
.ib input{flex:1}
.ib select{width:95px}
.stat{margin-top:12px;padding:12px;border-radius:14px;background:#fff7ef;border:1px solid #ecd9c7}
.kv{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin-top:8px}
.kv:first-child{margin-top:0}
.kv b{color:#6b442b;text-align:right}
.row{display:flex;gap:10px;margin-top:14px}
.btn{flex:1;padding:13px;border:0;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer}
.btn:disabled{opacity:.45;cursor:not-allowed}
.save{background:#8b5e3c;color:#fff}
.home{background:#d6b08f;color:#4e3425}
.tt{position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-120px);transition:transform .3s ease;padding:11px 18px;border-radius:12px;font-size:14px;font-weight:700;z-index:20}
.tt.s{background:#7b4e2f;color:#fff;transform:translateX(-50%) translateY(0)}
.tt.e{background:#b5473f;color:#fff;transform:translateX(-50%) translateY(0)}
.mdl{position:fixed;inset:0;background:rgba(80,50,30,.4);z-index:50;display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)}
.mc{background:#fff;width:100%;max-width:360px;padding:22px;border-radius:18px;box-shadow:0 12px 32px rgba(111,74,47,.25);border:1px solid #e3d2c3}
@media(max-width:420px){.row{flex-direction:column}}
</style></head><body>
<div class=wrap>
  <div class=hd>
    <h1 id=htit style="cursor:pointer;user-select:none">SOS GPS Tracker</h1>
    <div class=st>
      <span class=ch id=sg>GPS: --</span>
      <span class=ch id=sh>HOME: --</span>
      <span class=ch id=sd>Kho&#7843;ng c&#225;ch: --</span>
      <span class=ch id=s4>4G: --</span>
      <span class=ch id=sw>WiFi: --</span>
    </div>
  </div>

  <div class=card>
    <label>S&#7889; &#273;i&#7879;n tho&#7841;i 1</label>
    <input id=p1 type=tel placeholder="V&#237; d&#7909;: 077xxxxxxx ho&#7863;c +84...">
    <label>S&#7889; &#273;i&#7879;n tho&#7841;i 2</label>
    <input id=p2 type=tel placeholder="(tu&#7923; ch&#7885;n)">
    <label>S&#7889; &#273;i&#7879;n tho&#7841;i 3</label>
    <input id=p3 type=tel placeholder="(tu&#7923; ch&#7885;n)">

    <label>T&#234;n thi&#7871;t b&#7883;</label>
    <input id=dn type=text maxlength=63 placeholder="V&#237; d&#7909;: Tracker NEO10">
    <label>L&#7901;i nh&#7855;n SMS</label>
    <textarea id=ms placeholder="V&#237; d&#7909;: T&#244;i c&#7847;n h&#7895; tr&#7907; kh&#7849;n c&#7845;p..."></textarea>

    <div class=stat>
      <div class=kv><span>HOME</span><b id=home>Ch&#432;a c&#243;</b></div>
      <div class=kv><span>Kho&#7843;ng c&#225;ch t&#7899;i HOME</span><b id=dist>--</b></div>
    </div>

    <div class=row>
      <button class="btn save" id=bs onclick=sv()>L&#432;u c&#7845;u h&#236;nh</button>
      <button class="btn home" id=bh onclick=sh() disabled>L&#432;u HOME</button>
    </div>
  </div>
</div>

<div id=adv class="mdl">
  <div class="mc">
    <h3 style="font-size:16px;color:#a56a43;margin-bottom:8px;text-align:center">&#9881; C&#224;i &#273;&#7863;t Admin</h3>
    <label>Khi THI&#7870;T B&#7882; DI CHUY&#7874;N</label>
    <div class=ib>
      <input id=t_mov type=number min=5 placeholder="30"><select id=u_mov><option value=1>Gi&#226;y</option><option value=60>Ph&#250;t</option></select>
    </div>
    <label>Khi THI&#7870;T B&#7882; &#272;&#7912;NG Y&#202;N</label>
    <div class=ib>
      <input id=t_sta type=number min=1 placeholder="10"><select id=u_sta><option value=1>Gi&#226;y</option><option value=60 selected>Ph&#250;t</option></select>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn home" onclick="ccl()">H&#7911;y b&#7887;</button>
      <button class="btn save" onclick="$('adv').style.display='none';sv()">L&#432;u ngay</button>
    </div>
  </div>
</div>

<div class=tt id=tt></div>
<script>
var $=function(i){return document.getElementById(i)};
var keep={wtrk_url:'',strk_url:'',nloc_url:'',snloc_url:''};
function toast(m,ok){var t=$('tt');t.textContent=m;t.className='tt '+(ok?'s':'e');setTimeout(function(){t.className='tt'},2200)}
function N(p){p=(p||'').trim();if(p.charAt(0)==='0'&&p.length>8)return'+84'+p.substring(1);return p}
function hb(locValid){$('bh').disabled=!locValid}
function cl(v){return v>6?'g':v>3?'y':'r'}
function srcLabel(src){
  if(src==='gps') return 'GPS';
  if(src==='wifi_geo') return 'WiFi geo';
  if(src==='cell_geo') return 'Cell geo';
  if(src==='home') return 'HOME';
  return src||'Unknown';
}
function _us(v,i){if(!v)return;var d=v>=60&&v%60==0;$('t_'+i).value=d?v/60:v;$('u_'+i).value=d?60:1}
function init(){fetch('/config').then(function(r){return r.json()}).then(function(c){
    keep.wtrk_url=c.wtrk_url||'';keep.strk_url=c.strk_url||'';keep.nloc_url=c.nloc_url||'';keep.snloc_url=c.snloc_url||'';
    $('p1').value=c.c1||'';$('p2').value=c.c2||'';$('p3').value=c.c3||'';$('ms').value=c.sms||'';$('dn').value=c.dn||c.device_name||'';
    _us(c.trk_c_mov,'mov');_us(c.trk_c_sta,'sta');
    hb(false)
  }).catch(function(){})}
function sv(){var b=$('bs');b.disabled=true;b.textContent='\u0110ang l\u01b0u...';
  var name=($('dn').value||'').trim();
  var tm=parseFloat($('t_mov').value||0)*parseFloat($('u_mov').value||1);
  var ts=parseFloat($('t_sta').value||0)*parseFloat($('u_sta').value||1);
  var d='c1='+encodeURIComponent(N($('p1').value))+'&c2='+encodeURIComponent(N($('p2').value))+'&c3='+encodeURIComponent(N($('p3').value))+'&dn='+encodeURIComponent(name)+'&device_name='+encodeURIComponent(name)+'&sms='+encodeURIComponent($('ms').value||'')+'&wtrk_url='+encodeURIComponent(keep.wtrk_url)+'&strk_url='+encodeURIComponent(keep.strk_url)+'&nloc_url='+encodeURIComponent(keep.nloc_url)+'&snloc_url='+encodeURIComponent(keep.snloc_url)+'&t_m='+encodeURIComponent(tm)+'&t_s='+encodeURIComponent(ts);
  fetch('/save_config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:d})
    .then(function(r){toast(r.ok?'\u0110\u00e3 l\u01b0u c\u1ea5u h\u00ecnh':'L\u1ed7i l\u01b0u c\u1ea5u h\u00ecnh',r.ok)})
    .catch(function(){toast('Kh\u00f4ng th\u1ec3 l\u01b0u',false)})
    .finally(function(){b.disabled=false;b.textContent='L\u01b0u c\u1ea5u h\u00ecnh'})}
function sh(){var b=$('bh');b.disabled=true;b.textContent='\u0110ang l\u01b0u...';
  fetch('/save_home',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:''})
    .then(function(r){return r.json()})
    .then(function(j){toast(j.ok?'\u0110\u00e3 l\u01b0u HOME':(j.msg||'Ch\u01b0a c\u00f3 v\u1ecb tr\u00ed h\u1ee3p l\u1ec7'),!!j.ok)})
    .catch(function(){toast('Kh\u00f4ng th\u1ec3 l\u01b0u',false)})
    .finally(function(){b.disabled=false;b.textContent='L\u01b0u HOME'})}
function poll(){fetch('/status').then(function(r){return r.json()}).then(function(s){
    var ls='Ch\u01b0a c\u00f3 fix';
    if(s.loc_valid){
      ls=srcLabel(s.loc_src);
      if(s.loc_src==='gps') ls+=' - '+s.sats+' sats';
      else ls+=' - +/-'+Math.round(s.loc_acc)+'m';
    }
    $('sg').textContent='GPS: '+ls;
    $('sg').className='ch '+(s.loc_valid?(s.loc_src==='gps'?'g':'y'):'r');
    $('sh').textContent='HOME: '+(s.has_home?'\u0110\u00e3 c\u00f3':'Ch\u01b0a c\u00f3');
    $('sh').className='ch '+(s.has_home?'g':'r');
    var dOk=(s.dist>=0);
    $('sd').textContent='Kho\u1ea3ng c\u00e1ch: '+(dOk?Math.round(s.dist)+'m':'--');
    $('sd').className='ch '+(dOk?'g':'');
    $('s4').textContent='4G: '+(s.c4||0)+'/10';
    $('s4').className='ch '+cl(s.c4||0);
    $('sw').textContent='WiFi: '+(s.wf||0)+'/10';
    $('sw').className='ch '+cl(s.wf||0);
    $('home').textContent=s.has_home?'\u0110\u00e3 c\u00f3':'Ch\u01b0a c\u00f3';
    $('dist').textContent=dOk?(Math.round(s.dist)+' m'):'--';
    hb(s.loc_valid);
  }).catch(function(){})}
var pt=0,ht=$('htit');
function shw(){pt=setTimeout(function(){$('adv').setAttribute('dm',$('t_mov').value);$('adv').setAttribute('um',$('u_mov').value);$('adv').setAttribute('ds',$('t_sta').value);$('adv').setAttribute('us',$('u_sta').value);$('adv').style.display='flex';toast('M\u1edf kh\u00f3a Admin',true)},1200)}
function clr(){clearTimeout(pt)}
function ccl(){$('t_mov').value=$('adv').getAttribute('dm');$('u_mov').value=$('adv').getAttribute('um');$('t_sta').value=$('adv').getAttribute('ds');$('u_sta').value=$('adv').getAttribute('us');$('adv').style.display='none'}
ht.addEventListener('touchstart',shw,{passive:true});ht.addEventListener('touchend',clr);
ht.addEventListener('mousedown',shw);ht.addEventListener('mouseup',clr);ht.addEventListener('mouseleave',clr);
init();poll();setInterval(poll,2000);
</script></body></html>
)HTML";

// ============================================================
void initFriendlyNamePortal() {
  syncPortalDnsState();

  // --- Main page ---
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "text/html", PORTAL_HTML);
  });

  // --- GET /config -> JSON for form prefill ---
  server.on("/config", HTTP_GET, [](AsyncWebServerRequest *r) {
    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);

    String j =
        "{\"dn\":\"" + jsonEsc(cfg.deviceName) + "\",\"device_name\":\"" +
        jsonEsc(cfg.deviceName) + "\",\"c1\":\"" + jsonEsc(cfg.call1) +
        "\",\"c2\":\"" + jsonEsc(cfg.call2) + "\",\"c3\":\"" +
        jsonEsc(cfg.call3) + "\",\"sms\":\"" + jsonEsc(cfg.smsTemplate) +
        "\",\"wtrk_url\":\"" + jsonEsc(cfg.wifiTrackingUrl) +
        "\",\"strk_url\":\"" + jsonEsc(cfg.simTrackingUrl) +
        "\",\"nloc_url\":\"" + jsonEsc(cfg.netlocRelayUrl) +
        "\",\"snloc_url\":\"" + jsonEsc(cfg.simNetlocRelayUrl) +
        "\",\"home\":" +
        String((cfg.homeLat != 0 || cfg.homeLng != 0) ? "true" : "false") +
        ",\"home_lat\":" + String(cfg.homeLat, 6) +
        ",\"home_lng\":" + String(cfg.homeLng, 6) +
        ",\"geo_en\":" + String(cfg.geofenceEnable ? "true" : "false") +
        ",\"geo_rad\":" + String(cfg.geofenceRadiusM) +
        ",\"trk_c_mov\":" + String(cfg.trackingCurrentMovingIntervalMs / 1000UL) +
        ",\"trk_c_sta\":" + String(cfg.trackingCurrentStationaryIntervalMs / 1000UL) +
        "}";
    r->send(200, "application/json", j);
  });

  // --- POST /save_config -> device name + phones + SMS ---
  server.on("/save_config", HTTP_POST, [](AsyncWebServerRequest *r) {
    auto has = [&](const char *n) -> bool { return r->hasParam(n, true); };
    auto val = [&](const char *n) -> String {
      return r->hasParam(n, true) ? r->getParam(n, true)->value() : String("");
    };
    auto copyParam = [&](char *dst, size_t dstLen, const char *paramName) {
      if (!has(paramName) || dstLen == 0)
        return false;
      strncpy(dst, val(paramName).c_str(), dstLen - 1);
      dst[dstLen - 1] = '\0';
      return true;
    };

    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);
    bool commitNeeded = false;

    if (has("dn") || has("device_name")) {
      String devName = has("dn") ? val("dn") : val("device_name");
      devName.trim();
      if (devName.length() == 0)
        devName = "SOS GPS Tracker";
      strncpy(cfg.deviceName, devName.c_str(), sizeof(cfg.deviceName) - 1);
      cfg.deviceName[sizeof(cfg.deviceName) - 1] = '\0';
      nvs_set_str(nvsHandle, "DEV_NAME", cfg.deviceName);
      commitNeeded = true;
    }

    if (copyParam(cfg.call1, sizeof(cfg.call1), "c1")) {
      nvs_set_str(nvsHandle, "CALL_1", cfg.call1);
      commitNeeded = true;
    }
    if (copyParam(cfg.call2, sizeof(cfg.call2), "c2")) {
      nvs_set_str(nvsHandle, "CALL_2", cfg.call2);
      commitNeeded = true;
    }
    if (copyParam(cfg.call3, sizeof(cfg.call3), "c3")) {
      nvs_set_str(nvsHandle, "CALL_3", cfg.call3);
      commitNeeded = true;
    }
    if (copyParam(cfg.smsTemplate, sizeof(cfg.smsTemplate), "sms")) {
      nvs_set_str(nvsHandle, "SMS_TPL", cfg.smsTemplate);
      commitNeeded = true;
    }
    if (copyParam(cfg.wifiTrackingUrl, sizeof(cfg.wifiTrackingUrl),
                  "wtrk_url")) {
      nvs_set_str(nvsHandle, "WTRK_URL", cfg.wifiTrackingUrl);
      commitNeeded = true;
    }
    if (copyParam(cfg.simTrackingUrl, sizeof(cfg.simTrackingUrl), "strk_url")) {
      nvs_set_str(nvsHandle, "STRK_URL", cfg.simTrackingUrl);
      commitNeeded = true;
    }
    if (copyParam(cfg.netlocRelayUrl, sizeof(cfg.netlocRelayUrl), "nloc_url")) {
      nvs_set_str(nvsHandle, "NLOC_URL", cfg.netlocRelayUrl);
      commitNeeded = true;
    }
    if (copyParam(cfg.simNetlocRelayUrl, sizeof(cfg.simNetlocRelayUrl),
                  "snloc_url")) {
      nvs_set_str(nvsHandle, "SNLOC_URL", cfg.simNetlocRelayUrl);
      commitNeeded = true;
    }

    auto parseIntervalSec = [&](const char *name, unsigned long minSec,
                                unsigned long maxSec) -> unsigned long {
      if (!has(name)) return 0;
      long v = val(name).toInt();
      if (v <= 0) return 0;
      unsigned long cl = static_cast<unsigned long>(v);
      return (cl < minSec) ? minSec : ((cl > maxSec) ? maxSec : cl);
    };

    unsigned long cMovSec = parseIntervalSec("t_m", 5, 86400);
    unsigned long cStaSec = parseIntervalSec("t_s", 30, 86400);
    if (cMovSec > 0) {
      cfg.trackingCurrentMovingIntervalMs = cMovSec * 1000UL;
      nvs_set_i32(nvsHandle, "TRK_C_MOV", static_cast<int32_t>(cfg.trackingCurrentMovingIntervalMs));
      commitNeeded = true;
    }
    if (cStaSec > 0) {
      cfg.trackingCurrentStationaryIntervalMs = cStaSec * 1000UL;
      nvs_set_i32(nvsHandle, "TRK_C_STA", static_cast<int32_t>(cfg.trackingCurrentStationaryIntervalMs));
      commitNeeded = true;
    }

    if (commitNeeded)
      nvs_commit(nvsHandle);

    applyConfigSnapshot(&cfg);

    logPrintf("[PORTAL] Saved: NAME=%s C1=%s C2=%s C3=%s", cfg.deviceName,
              cfg.call1, cfg.call2, cfg.call3);
    r->send(200, "text/plain", "OK");
  });
  // --- POST /save_home -> save current location as HOME ---
  server.on("/save_home", HTTP_POST, [](AsyncWebServerRequest *r) {
    const bool hasLat = r->hasParam("lat", true);
    const bool hasLng = r->hasParam("lng", true);
    if (hasLat || hasLng) {
      if (!(hasLat && hasLng)) {
        r->send(200, "application/json",
                "{\"ok\":false,\"msg\":\"C\u1ea7n nh\u1eadp \u0111\u1ee7 lat "
                "v\u00e0 lng\"}");
        return;
      }
      const String latStr = r->getParam("lat", true)->value();
      const String lngStr = r->getParam("lng", true)->value();
      const double lat = atof(latStr.c_str());
      const double lng = atof(lngStr.c_str());
      const bool valid = isfinite(lat) && isfinite(lng) && lat >= -90.0 &&
                         lat <= 90.0 && lng >= -180.0 && lng <= 180.0 &&
                         !(lat == 0.0 && lng == 0.0);
      if (!valid) {
        r->send(200, "application/json",
                "{\"ok\":false,\"msg\":\"T\u1ecda \u0111\u1ed9 HOME kh\u00f4ng "
                "h\u1ee3p l\u1ec7\"}");
        return;
      }
      saveHomeLocation(lat, lng);
      r->send(200, "application/json", "{\"ok\":true}");
      return;
    }

    BestLocationResult loc = getBestAvailableLocation();
    if (!loc.valid) {
      r->send(200, "application/json",
              "{\"ok\":false,\"msg\":\"Kh\u00f4ng c\u00f3 v\u1ecb tr\u00ed "
              "h\u1ee3p l\u1ec7\"}");
      return;
    }
    if (loc.lat == 0 && loc.lng == 0) {
      r->send(200, "application/json",
              "{\"ok\":false,\"msg\":\"V\u1ecb tr\u00ed l\u1ed7i (0,0)\"}");
      return;
    }
    saveHomeLocation(loc.lat, loc.lng);
    r->send(200, "application/json", "{\"ok\":true}");
  });

  // --- GET /status -> combined GPS + signal + distance (one request) ---
  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *r) {
    ConfigSnapshot cfg = {};
    TelemetrySnapshot telem = {};
    getConfigSnapshot(&cfg);
    getTelemetrySnapshot(&telem);

    BestLocationResult loc = getBestAvailableLocation();
    bool locValid = loc.valid && (loc.lat != 0.0 || loc.lng != 0.0);
    bool fix = telem.gpsReady && locValid && loc.source == LOC_GPS;
    int sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
    double lat = locValid ? loc.lat : 0.0;
    double lng = locValid ? loc.lng : 0.0;
    bool hasHome = (cfg.homeLat != 0 || cfg.homeLng != 0);
    double dist = -1;
    if (hasHome && locValid && (lat != 0 || lng != 0))
      dist = calculateDistance(lat, lng, cfg.homeLat, cfg.homeLng);
    const bool apOn = portalApActive();
    const bool staOk = WiFi.status() == WL_CONNECTED;
    const String staHost = wifiStaHostnameFqdn();
    const String staUrl = wifiStaHostnameUrl();
    const String staIp = wifiStaIpString();

    char buf[768];
    snprintf(buf, sizeof(buf),
             "{\"fix\":%s,\"sats\":%d,\"dist\":%.1f,"
             "\"c4\":%d,\"wf\":%d,\"has_home\":%s,"
             "\"geo_en\":%s,\"geo_rad\":%d,"
             "\"loc_valid\":%s,\"loc_src\":\"%s\","
             "\"loc_acc\":%.1f,\"loc_age\":%lu,"
             "\"lat\":%.6f,\"lng\":%.6f,"
             "\"ap_on\":%s,\"ap_url\":\"%s\","
             "\"sta_ok\":%s,\"sta_host\":\"%s\","
             "\"sta_url\":\"%s\",\"sta_ip\":\"%s\"}",
             fix ? "true" : "false", sats, dist, telem.signal4G,
             telem.signalWiFi, hasHome ? "true" : "false",
             cfg.geofenceEnable ? "true" : "false", cfg.geofenceRadiusM,
             locValid ? "true" : "false",
             locValid ? locationSourceName(loc.source) : "none",
             locValid ? loc.accuracyM : 0.0f, locValid ? loc.ageMs : 0UL, lat,
             lng, apOn ? "true" : "false", apOn ? "http://192.168.4.1/" : "",
             staOk ? "true" : "false", staHost.c_str(), staUrl.c_str(),
             staIp.c_str());
    r->send(200, "application/json", buf);
  });

  // --- Hidden debug endpoints (accessible by URL only) ---
  server.on("/track_test", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "application/json", trackingTestRequest());
  });

  server.on("/assist_status", HTTP_GET, [](AsyncWebServerRequest *r) {
    TelemetrySnapshot telem = {};
    getTelemetrySnapshot(&telem);
    char buf[80];
    snprintf(buf, sizeof(buf), "{\"status\":\"%s\",\"ready\":%s}",
             telem.assistStatus, telem.assistReady ? "true" : "false");
    r->send(200, "application/json", buf);
  });

  server.on("/wifi_scan", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "application/json", getLastWiFiScanDebugJson());
  });

  // --- Captive portal: redirect any URL to "/" ---
  server.onNotFound([](AsyncWebServerRequest *r) {
    if (portalApActive()) {
      r->redirect("http://192.168.4.1/");
      return;
    }
    r->send(404, "text/plain", "Not found");
  });

  server.begin();
  if (portalApActive()) {
    logLine("[PORTAL] AP provisioning mode: http://192.168.4.1");
  } else if (WiFi.status() == WL_CONNECTED) {
    logPrintf("[PORTAL] STA mode: %s  (IP %s)", wifiStaHostnameUrl().c_str(),
              WiFi.localIP().toString().c_str());
  } else {
    logLine("[PORTAL] Started without AP; waiting for STA connectivity");
  }
}

void loopFriendlyNamePortal() {
  syncPortalDnsState();
  if (dnsServerStarted)
    dnsServer.processNextRequest();
}