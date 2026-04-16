/**
 * BA.SEW Web Analytics - Production-ready tracking module
 * 
 * Supports: GA4, Meta Pixel, dataLayer, console fallback
 * 
 * ENV:
 *   VITE_ENABLE_ANALYTICS=true
 *   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
 *   VITE_META_PIXEL_ID=123456789
 */

import { ENABLE_ANALYTICS, GA_MEASUREMENT_ID, META_PIXEL_ID } from "@/config/env";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

/* Internals */

const isDev: boolean = process.env.NODE_ENV !== "production";
let initialized = false;

/** Console log in dev mode with structured output */
function devLog(category: string, action: string, data?: Record<string, any>) {
  if (isDev) {
    console.log(
      `%c[Analytics] %c${category} â†’ ${action}`,
      "color:#1a73e8;font-weight:bold",
      "color:#5f6368",
      data || ""
    );
  }
}

/** Push to dataLayer (always, regardless of GA4 load status) */
function pushDataLayer(event: string, params: Record<string, any> = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
    _timestamp: Date.now(),
    _source: "ba-sew-web",
  });
}

/** Send GA4 event */
function ga(event: string, params?: Record<string, any>) {
  devLog("GA4", event, params);
  pushDataLayer(event, params || {});
  if (window.gtag) {
    window.gtag("event", event, params);
  }
}

/** Send Meta Pixel event */
function pixel(event: string, params?: Record<string, any>) {
  devLog("Pixel", event, params);
  if (window.fbq) {
    window.fbq("track", event, params);
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Initialization â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  // Always init dataLayer
  window.dataLayer = window.dataLayer || [];

  if (!ENABLE_ANALYTICS) {
    devLog("Init", "Analytics disabled (VITE_ENABLE_ANALYTICS != true)");
    return;
  }

  // GA4
  if (GA_MEASUREMENT_ID) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.onerror = () => devLog("Init", "GA4 script failed to load");
    document.head.appendChild(script);

    window.gtag = function (...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: true,
      cookie_flags: "SameSite=None;Secure",
    });
    devLog("Init", `GA4 initialized: ${GA_MEASUREMENT_ID}`);
  } else {
    devLog("Init", "GA4 skipped (no VITE_GA_MEASUREMENT_ID)");
  }

  // Meta Pixel
  if (META_PIXEL_ID) {
    if (!window.fbq) {
      const n = (window.fbq = function () {
        (n as any).callMethod
          ? (n as any).callMethod.apply(n, arguments)
          : (n as any).queue.push(arguments);
      } as any);
      (n as any).push = n;
      (n as any).loaded = true;
      (n as any).version = "2.0";
      (n as any).queue = [];
      window._fbq = n;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.onerror = () => devLog("Init", "Meta Pixel script failed to load");
      document.head.appendChild(script);
    }
    window.fbq!("init", META_PIXEL_ID);
    window.fbq!("track", "PageView");
    devLog("Init", `Meta Pixel initialized: ${META_PIXEL_ID}`);
  } else {
    devLog("Init", "Meta Pixel skipped (no VITE_META_PIXEL_ID)");
  }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Page & Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function trackPageView(pageName: string) {
  ga("page_view", { page_title: pageName, page_location: window.location.href });
  pixel("PageView");
}

export function trackSectionView(sectionName: string) {
  ga("section_view", { section_name: sectionName });
}

export function trackNavbarClick(item: string) {
  ga("navbar_click", { nav_item: item, click_target: `#${item}` });
}

export function trackCTA(name: string, location: string) {
  ga("cta_click", { cta_name: name, cta_location: location });
  pixel("Lead", { content_name: name, content_category: location });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Tracking Module â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function trackDeviceSelected(deviceId: string) {
  ga("device_selected", { device_id: deviceId });
}

export function trackSearch(query: string) {
  ga("search", { search_term: query });
}

export function trackSearchResultClick(query: string, lat: number, lng: number) {
  ga("search_result_click", { search_term: query, result_lat: lat, result_lng: lng });
}

export function trackHistoryRangeChange(range: string) {
  ga("history_range_change", { history_range: range });
}

export function trackRouteModeChange(mode: string) {
  ga("route_mode_change", { route_mode: mode });
}

export function trackMapLayerChange(layer: string) {
  ga("map_layer_change", { map_layer: layer });
}

export function trackFetchCurrentLocation(deviceId: string) {
  ga("fetch_current_location", { device_id: deviceId });
}

export function trackRenameDevice(deviceId: string) {
  ga("rename_device", { device_id: deviceId });
}

export function trackHomePickStart(deviceId: string) {
  ga("home_pick_start", { device_id: deviceId });
}

export function trackHomeSaved(deviceId: string) {
  ga("home_saved", { device_id: deviceId });
  pixel("CustomizeProduct", { content_name: "home_saved", content_ids: [deviceId] });
}

export function trackHomeCleared(deviceId: string) {
  ga("home_cleared", { device_id: deviceId });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ UI / Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function trackSidebarToggle(collapsed: boolean) {
  ga("sidebar_toggle", { sidebar_collapsed: collapsed });
}

export function trackThemeChange(theme: string) {
  ga("theme_change", { theme_mode: theme });
}

export function trackLanguageChange(locale: string) {
  ga("language_change", { locale });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Order Form Funnel â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function trackOrderFormStart(formName: string) {
  ga("form_start", { form_name: formName });
  pixel("InitiateCheckout", { content_name: formName });
}

export function trackOrderFormSubmit(formName: string) {
  ga("form_submit", { form_name: formName });
  pixel("SubmitApplication", { content_name: formName });
}

export function trackOrderFormSuccess(formName: string) {
  ga("form_success", { form_name: formName });
  pixel("CompleteRegistration", { content_name: formName });
}

export function trackOrderFormError(formName: string) {
  ga("form_error", { form_name: formName });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ Contact â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function trackContactClick(contactType: string) {
  ga("contact_click", { contact_type: contactType });
  pixel("Contact", { content_name: contactType });
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ API / Request Telemetry â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function trackApiError(endpoint: string, message: string) {
  ga("api_error", { api_endpoint: endpoint, error_message: message });
}

/** Track API request performance (call on success) */
export function trackApiRequest(
  endpoint: string,
  method: string,
  durationMs: number,
  status: "success" | "error",
  httpStatus?: number
) {
  pushDataLayer("api_request", {
    api_endpoint: endpoint,
    api_method: method,
    api_duration_ms: durationMs,
    api_status: status,
    api_http_status: httpStatus,
  });
  devLog("API", `${method} ${endpoint}`, { durationMs, status, httpStatus });
}

