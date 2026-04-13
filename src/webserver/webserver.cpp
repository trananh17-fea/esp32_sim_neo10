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
fieldset{margin-top:16px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(2,6,23,.25)}
legend{padding:0 8px;font-size:12px;font-weight:800;letter-spacing:.3px;color:#cbd5e1}
fieldset label{margin:0 0 10px;font-size:13px;color:#cbd5e1;text-transform:none;letter-spacing:0}
fieldset label:last-child{margin-bottom:0}
fieldset input{margin-top:6px}
.tb{display:flex;gap:10px;margin-bottom:16px}
.tbi{flex:1;padding:10px 14px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:#0b1222;color:#cbd5e1;font-size:13px;font-weight:800;cursor:pointer}
.tbi.a{background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#061220;border-color:transparent}
.pn{display:none}
.pn.a{display:block}
.sw{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(2,6,23,.25)}
.sw b{display:block;font-size:14px;color:#f1f5f9;margin-bottom:4px}
.sw span{display:block;font-size:12px;color:#94a3b8;line-height:1.35}
.sw input[type=checkbox]{width:20px;height:20px;padding:0;border:none;border-radius:6px;accent-color:#38bdf8;box-shadow:none}
.coords{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.bt{display:block;width:100%;padding:14px;border:none;border-radius:14px;font-weight:900;font-size:15px;cursor:pointer;transition:transform .15s,opacity .15s;letter-spacing:.2px}
.bt:active{transform:scale(.98)}
.bt:disabled{opacity:.35;cursor:not-allowed;transform:none}
.row{display:flex;gap:10px;margin-top:14px}
.row .bt{flex:1}
.bp{background:linear-gradient(135deg,#22c55e,#16a34a);color:#05140c;box-shadow:0 2px 14px rgba(34,197,94,.18)}
.bh{background:linear-gradient(135deg,#60a5fa,#38bdf8);color:#061220;box-shadow:0 2px 14px rgba(56,189,248,.18)}
.card2{margin-top:14px;padding:14px;border-radius:16px;background:rgba(2,6,23,.35);border:1px solid rgba(148,163,184,.12)}
.kv{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#cbd5e1;margin-top:8px}
.kv span{min-width:92px}
.kv:first-child{margin-top:0}
.kv b{color:#f1f5f9}
.kv b.addr{font-size:12px;text-align:right;word-break:break-word}
.sub{font-size:12px;color:#94a3b8;margin-top:10px;line-height:1.35}
.hn{font-size:12px;color:#94a3b8;margin-top:12px;text-align:center}
.tt{position:fixed;top:18px;left:50%;transform:translateX(-50%) translateY(-110px);padding:12px 26px;border-radius:14px;font-size:14px;font-weight:900;z-index:99;transition:transform .35s cubic-bezier(.34,1.56,.64,1);pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.tt.s{transform:translateX(-50%) translateY(0);background:#22c55e;color:#fff}
.tt.e{transform:translateX(-50%) translateY(0);background:#ef4444;color:#fff}
</style></head><body>
<div class=hd>
  <h1>📡 SOS GPS Tracker</h1>
  <div class=st>
    <span class=ch id=sg>Vị trí: --</span>
    <span class=ch id=sd>Khoảng cách: --</span>
    <span class=ch id=gf>Vùng: --</span>
    <span class=ch id=s4>4G: --</span>
    <span class=ch id=sw>WiFi: --</span>
  </div>
</div>

<div class=mn><div class=cd>
  <div class=card2>
    <div class=kv><span>Portal AP</span><b class="addr" id=apurl>http://192.168.4.1/</b></div>
    <div class=kv><span>Portal LAN</span><b class="addr" id=staurl>http://neo10.local/</b></div>
    <div class=kv><span>IP LAN</span><b class="addr" id=staip>Dang doi WiFi...</b></div>
    <div class=sub id=netnote>Neu da tat host TV_DEVICE, hay vao cung WiFi voi router va thu mo neo10.local. Luu y: hotspot dien thoai thuong khong chay mDNS/.local giua cac client, luc do phai dung IP LAN o dong tren.</div>
  </div>
  <div class=tb>
    <button class="tbi a" id=tab_main type=button onclick="st('main')">Cấu hình chung</button>
    <button class=tbi id=tab_track type=button onclick="st('track')">Tracking & Mạng</button>
  </div>
  <div class="pn a" data-tab=main>
  <label>Số điện thoại 1</label>
  <input id=p1 type=tel placeholder="Ví dụ: 077xxxxxxx hoặc +84...">
  <label>Số điện thoại 2</label>
  <input id=p2 type=tel placeholder="(tuỳ chọn)">
  <label>Số điện thoại 3</label>
  <input id=p3 type=tel placeholder="(tuỳ chọn)">
  <label>Lời nhắn SMS</label>
  <textarea id=ms placeholder="Ví dụ: Tôi cần hỗ trợ khẩn cấp..."></textarea>
  </div>
  <div class=pn data-tab=track>
    <div class=sw>
      <div>
        <b>Bật host TV_DEVICE</b>
        <span>Bật để thiết bị thử kết nối Wifi; Tắt để chỉ giữ AP cục bộ</span>
      </div>
      <input id=ap_en type=checkbox>
    </div>
  <label>WiFi Tracking URL</label>
  <input id=wtrk type=text placeholder="https://your-wifi-host/update">
  <label>SIM Tracking URL</label>
  <input id=strk type=text placeholder="https://your-sim-host/update">
  <label>WiFi Netloc Relay URL</label>
  <input id=relay type=text placeholder="https://your-host/api/geolocate">
  <label>SIM Netloc Relay URL</label>
  <input id=srelay type=text placeholder="https://your-sim-host/api/geolocate">
    <fieldset>
      <style>
    .setup-container {
      font-family: sans-serif;
      max-width: 400px;
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .setting-item {
      margin-bottom: 20px;
    }
    .setting-item label {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
      color: #333;
    }
    .setting-item small {
      color: #666;
      display: block;
      margin-bottom: 8px;
    }
    input[type="number"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-sizing: border-box; /* Giúp input không bị tràn */
    }
    .divider {
      border-top: 1px solid #eee;
      margin: 15px 0;
    }
  </style>

  <div class="setup-container">
    <h3 style="margin-top:0">⚙️ Cài đặt định vị</h3>
    
    <div class="setting-item">
      <label>🚗 Khi xe đang chạy</label>
      <small>Cập nhật vị trí sau mỗi (giây):</small>
      <input type="number" placeholder="Ví dụ: 30" min="30">
      <small><i>(Càng nhỏ thì xem lại lộ trình càng chi tiết)</i></small>
    </div>

    <div class="divider"></div>

    <div class="setting-item">
      <label>🅿️ Khi xe đứng yên</label>
      <small>Cập nhật trạng thái sau mỗi (giây):</small>
      <input type="number" placeholder="Ví dụ: 600" min="60">
      <small><i>(Nên để số lớn để tiết kiệm Pin cho thiết bị)</i></small>
    </div>
  </div>
  </fieldset>

  </div>
  <div class="pn a" data-tab=main>
  <div class=card2>
    <div class=kv><span>HOME</span><b id=home>Chưa có</b></div>
    <div class=kv><span>Khoảng cách tới HOME</span><b id=dist>--</b></div>
    <div class=kv><span>Geofence</span><b id=geo>--</b></div>
    <div class=coords>
      <input id=hlat type=number step=any placeholder="Home lat">
      <input id=hlng type=number step=any placeholder="Home lng">
    </div>
    <div class=sub>• <b>Lưu HOME</b> sẽ lấy vị trí hiện tại làm “nhà” (ưu tiên GPS > WiFi > Cell).</div>
    <div class=sub>• Trạng thái chi tiết (GPS/sóng/cảnh báo) xem ở Serial log.</div>
  </div>

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
function H(){var lat=($('hlat').value||'').trim(),lng=($('hlng').value||'').trim();return lat!==''&&lng!==''}
function hb(locValid){$('bh').disabled=!(locValid||H())}
function st(tab){document.querySelectorAll('.pn').forEach(function(el){el.classList.toggle('a',el.getAttribute('data-tab')===tab)});$('tab_main').classList.toggle('a',tab==='main');$('tab_track').classList.toggle('a',tab==='track')}
function init(){fetch('/config').then(function(r){return r.json()}).then(function(c){
  $('p1').value=c.c1||'';$('p2').value=c.c2||'';$('p3').value=c.c3||'';$('ms').value=c.sms||'';$('ap_en').checked=!!c.ap_en;$('wtrk').value=c.wtrk_url||'';$('strk').value=c.strk_url||'';$('relay').value=c.nloc_url||'';$('srelay').value=c.snloc_url||'';$('trk_c_mov').value=c.trk_c_mov||'';$('trk_c_sta').value=c.trk_c_sta||'';$('trk_h_mov').value=c.trk_h_mov||'';$('trk_h_sta').value=c.trk_h_sta||'';$('hlat').value=(typeof c.home_lat==='number'&&c.home_lat)?c.home_lat:'';$('hlng').value=(typeof c.home_lng==='number'&&c.home_lng)?c.home_lng:'';hb(false)
}).catch(function(){})}
function sv(){var b=$('bs');b.disabled=true;b.textContent='Đang lưu...';
  var d='c1='+encodeURIComponent(N($('p1').value))+'&c2='+encodeURIComponent(N($('p2').value))+'&c3='+encodeURIComponent(N($('p3').value))+'&sms='+encodeURIComponent($('ms').value)+'&ap_en='+encodeURIComponent($('ap_en').checked?'1':'0')+'&wtrk_url='+encodeURIComponent($('wtrk').value)+'&strk_url='+encodeURIComponent($('strk').value)+'&nloc_url='+encodeURIComponent($('relay').value)+'&snloc_url='+encodeURIComponent($('srelay').value)+'&trk_c_mov='+encodeURIComponent($('trk_c_mov').value)+'&trk_c_sta='+encodeURIComponent($('trk_c_sta').value)+'&trk_h_mov='+encodeURIComponent($('trk_h_mov').value)+'&trk_h_sta='+encodeURIComponent($('trk_h_sta').value);
  fetch('/save_config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:d})
    .then(function(r){toast(r.ok?'Đã lưu cấu hình!':'Lỗi lưu cấu hình',r.ok)})
    .catch(function(){toast('Không thể lưu',false)})
    .finally(function(){b.disabled=false;b.textContent='Lưu cấu hình'})}
function sh(){var b=$('bh');b.disabled=true;b.textContent='Đang lưu...';
  var lat=($('hlat').value||'').trim(),lng=($('hlng').value||'').trim(),body=(lat&&lng)?('lat='+encodeURIComponent(lat)+'&lng='+encodeURIComponent(lng)):'';fetch('/save_home',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body}).then(function(r){return r.json()}).then(function(j){
    toast(j.ok?'Đã lưu HOME!':(j.msg||'Chưa có vị trí hợp lệ'),('ok' in j&&j.ok))
  }).catch(function(){toast('Không thể lưu',false)})
    .finally(function(){b.disabled=false;b.textContent='Lưu HOME'})}
function cl(v){return v>6?'g':v>3?'y':'r'}
function srcLabel(src){
  if(src==='gps') return 'GPS';
  if(src==='wifi_geo') return 'WiFi geo';
  if(src==='cell_geo') return 'Cell geo';
  if(src==='home') return 'HOME';
  return src||'Unknown';
}
function poll(){fetch('/status').then(function(r){return r.json()}).then(function(s){
  var ls='NO FIX';
  if(s.loc_valid){
    ls=srcLabel(s.loc_src);
    if(s.loc_src==='gps') ls+=' • '+s.sats+' sats';
    else ls+=' • ±'+Math.round(s.loc_acc)+'m';
  }
  $('sg').textContent='Vị trí: '+ls;$('sg').className='ch '+(s.loc_valid?(s.loc_src==='gps'?'g':'y'):'r');
  var dOk=(s.dist>=0);
  $('sd').textContent='Khoảng cách: '+(dOk?Math.round(s.dist)+'m':'--');$('sd').className='ch '+(dOk?'g':'');
  $('gf').textContent='Vùng: '+(s.geo_en?('ON • '+s.geo_rad+'m'):'OFF');$('gf').className='ch '+(s.geo_en?'y':'');
  $('s4').textContent='4G: '+s.c4+'/10';$('s4').className='ch '+cl(s.c4);
  $('sw').textContent='WiFi: '+s.wf+'/10';$('sw').className='ch '+cl(s.wf);
  $('home').textContent=s.has_home?'Đã có':'Chưa có';
  $('dist').textContent=dOk?(Math.round(s.dist)+' m'):'--';
  $('geo').textContent=s.geo_en?('Bật • bán kính '+s.geo_rad+'m'):'Tắt';
  $('apurl').textContent=s.ap_on?s.ap_url:'AP đang tắt';
  $('staurl').textContent=s.sta_url||('http://'+s.sta_host+'/');
  $('staip').textContent=s.sta_ip||'Chưa có IP STA';
  $('netnote').textContent=s.sta_ok?('Truy cập nhanh bằng '+s.sta_host+' trên cùng mạng LAN. Nếu đang qua hotspot điện thoại hoặc máy không hỗ trợ mDNS/.local, dùng IP '+s.sta_ip):'STA chưa kết nối router. Nếu AP đang bật thì vào http://192.168.4.1/';
  hb(s.loc_valid);
}).catch(function(){})}
['hlat','hlng'].forEach(function(id){$(id).addEventListener('input',function(){hb(false)})});
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

  // --- GET /config → JSON for form prefill ---
  server.on("/config", HTTP_GET, [](AsyncWebServerRequest *r) {
    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);

    String j =
        "{\"c1\":\"" + jsonEsc(cfg.call1) +
        "\","
        "\"c2\":\"" +
        jsonEsc(cfg.call2) +
        "\","
        "\"c3\":\"" +
        jsonEsc(cfg.call3) +
        "\","
        "\"sms\":\"" +
        jsonEsc(cfg.smsTemplate) +
        "\","
        "\"wtrk_url\":\"" +
        jsonEsc(cfg.wifiTrackingUrl) +
        "\","
        "\"strk_url\":\"" +
        jsonEsc(cfg.simTrackingUrl) +
        "\","
        "\"nloc_url\":\"" +
        jsonEsc(cfg.netlocRelayUrl) +
        "\","
        "\"snloc_url\":\"" +
        jsonEsc(cfg.simNetlocRelayUrl) +
        "\","
        "\"ap_en\":" +
        String(cfg.wifiApEnable ? "true" : "false") +
        ","
        "\"trk_c_mov\":" +
        String(cfg.trackingCurrentMovingIntervalMs / 1000UL) +
        ",\"trk_c_sta\":" +
        String(cfg.trackingCurrentStationaryIntervalMs / 1000UL) +
        ",\"trk_h_mov\":" +
        String(cfg.trackingHistoryMovingIntervalMs / 1000UL) +
        ",\"trk_h_sta\":" +
        String(cfg.trackingHistoryStationaryIntervalMs / 1000UL) +
        ","
        "\"home\":" +
        String((cfg.homeLat != 0 || cfg.homeLng != 0) ? "true" : "false") +
        ",\"home_lat\":" + String(cfg.homeLat, 6) +
        ",\"home_lng\":" + String(cfg.homeLng, 6) +
        ",\"geo_en\":" + String(cfg.geofenceEnable ? "true" : "false") +
        ",\"geo_rad\":" + String(cfg.geofenceRadiusM) + "}";
    r->send(200, "application/json", j);
  });

  // --- POST /save_config → phones + SMS only, other settings untouched ---
  server.on("/save_config", HTTP_POST, [](AsyncWebServerRequest *r) {
    auto val = [&](const char *n) -> String {
      return r->hasParam(n, true) ? r->getParam(n, true)->value() : String("");
    };
    auto parseIntervalSec = [&](const char *name, unsigned long minSec,
                                unsigned long maxSec) -> unsigned long {
      if (!r->hasParam(name, true))
        return 0;
      long v = val(name).toInt();
      if (v <= 0)
        return 0;
      unsigned long clamped = static_cast<unsigned long>(v);
      if (clamped < minSec)
        clamped = minSec;
      if (clamped > maxSec)
        clamped = maxSec;
      return clamped;
    };

    ConfigSnapshot cfg = {};
    getConfigSnapshot(&cfg);
    strncpy(cfg.call1, val("c1").c_str(), sizeof(cfg.call1) - 1);
    cfg.call1[sizeof(cfg.call1) - 1] = '\0';
    strncpy(cfg.call2, val("c2").c_str(), sizeof(cfg.call2) - 1);
    cfg.call2[sizeof(cfg.call2) - 1] = '\0';
    strncpy(cfg.call3, val("c3").c_str(), sizeof(cfg.call3) - 1);
    cfg.call3[sizeof(cfg.call3) - 1] = '\0';
    strncpy(cfg.smsTemplate, val("sms").c_str(), sizeof(cfg.smsTemplate) - 1);
    cfg.smsTemplate[sizeof(cfg.smsTemplate) - 1] = '\0';
    cfg.wifiApEnable = val("ap_en") != "0";
    strncpy(cfg.wifiTrackingUrl, val("wtrk_url").c_str(),
            sizeof(cfg.wifiTrackingUrl) - 1);
    cfg.wifiTrackingUrl[sizeof(cfg.wifiTrackingUrl) - 1] = '\0';
    strncpy(cfg.simTrackingUrl, val("strk_url").c_str(),
            sizeof(cfg.simTrackingUrl) - 1);
    cfg.simTrackingUrl[sizeof(cfg.simTrackingUrl) - 1] = '\0';
    strncpy(cfg.netlocRelayUrl, val("nloc_url").c_str(),
            sizeof(cfg.netlocRelayUrl) - 1);
    cfg.netlocRelayUrl[sizeof(cfg.netlocRelayUrl) - 1] = '\0';
    strncpy(cfg.simNetlocRelayUrl, val("snloc_url").c_str(),
            sizeof(cfg.simNetlocRelayUrl) - 1);
    cfg.simNetlocRelayUrl[sizeof(cfg.simNetlocRelayUrl) - 1] = '\0';

    unsigned long cMovSec = parseIntervalSec("trk_c_mov", 30, 86400);
    unsigned long cStaSec = parseIntervalSec("trk_c_sta", 60, 86400);
    unsigned long hMovSec = parseIntervalSec("trk_h_mov", 60, 86400);
    unsigned long hStaSec = parseIntervalSec("trk_h_sta", 300, 86400);

    if (cMovSec > 0) {
      cfg.trackingCurrentMovingIntervalMs = cMovSec * 1000UL;
    }
    if (cStaSec > 0) {
      cfg.trackingCurrentStationaryIntervalMs = cStaSec * 1000UL;
    }
    if (hMovSec > 0) {
      cfg.trackingHistoryMovingIntervalMs = hMovSec * 1000UL;
    }
    if (hStaSec > 0) {
      cfg.trackingHistoryStationaryIntervalMs = hStaSec * 1000UL;
    }

    // Save only edited fields to NVS
    nvs_set_str(nvsHandle, "CALL_1", cfg.call1);
    nvs_set_str(nvsHandle, "CALL_2", cfg.call2);
    nvs_set_str(nvsHandle, "CALL_3", cfg.call3);
    nvs_set_str(nvsHandle, "SMS_TPL", cfg.smsTemplate);
    nvs_set_u8(nvsHandle, "WIFI_AP_EN", cfg.wifiApEnable ? 1 : 0);
    nvs_set_str(nvsHandle, "WTRK_URL", cfg.wifiTrackingUrl);
    nvs_set_str(nvsHandle, "STRK_URL", cfg.simTrackingUrl);
    nvs_set_str(nvsHandle, "NLOC_URL", cfg.netlocRelayUrl);
    nvs_set_str(nvsHandle, "SNLOC_URL", cfg.simNetlocRelayUrl);
    if (cMovSec > 0) {
      nvs_set_i32(nvsHandle, "TRK_C_MOV",
                  static_cast<int32_t>(cfg.trackingCurrentMovingIntervalMs));
    }
    if (cStaSec > 0) {
      nvs_set_i32(
          nvsHandle, "TRK_C_STA",
          static_cast<int32_t>(cfg.trackingCurrentStationaryIntervalMs));
    }
    if (hMovSec > 0) {
      nvs_set_i32(nvsHandle, "TRK_H_MOV",
                  static_cast<int32_t>(cfg.trackingHistoryMovingIntervalMs));
    }
    if (hStaSec > 0) {
      nvs_set_i32(
          nvsHandle, "TRK_H_STA",
          static_cast<int32_t>(cfg.trackingHistoryStationaryIntervalMs));
    }
    nvs_commit(nvsHandle);
    applyConfigSnapshot(&cfg);
    wifiRestoreApStaMode();

    logPrintf("[PORTAL] Saved: C1=%s C2=%s C3=%s AP_HOST=%s", cfg.call1,
              cfg.call2, cfg.call3, cfg.wifiApEnable ? "ON" : "OFF");
    r->send(200, "text/plain", "OK");
  });

  // --- POST /save_home → save current location as HOME ---
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

  // --- GET /status → combined GPS + signal + distance (one request) ---
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
