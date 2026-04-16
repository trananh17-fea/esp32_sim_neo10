const isDev: boolean = process.env.NODE_ENV !== "production";

/** Tracker GPS API base URL - set via VITE_TRACKER_API_BASE env var */
export const TRACKER_API_BASE: string = (
  process.env.VITE_TRACKER_API_BASE || ""
).replace(/\/+$/, "");

/** Lead form: Google Sheet webhook is preferred; local endpoint is fallback. */
export const GOOGLE_SHEET_WEBHOOK_URL: string =
  process.env.VITE_GOOGLE_SHEET_WEBHOOK_URL || "";
export const LOCAL_LEAD_ENDPOINT: string =
  process.env.VITE_LOCAL_LEAD_ENDPOINT || "/api/leads";
export const DEMO_VIDEO_EMBED_URL: string =
  process.env.VITE_DEMO_VIDEO_EMBED_URL || "videos/basew-demo.mp4";
export const TRACKING_WEB_URL: string =
  process.env.VITE_TRACKING_WEB_URL ||
  (isDev ? "http://localhost:3000/" : "https://thanhvu220809.github.io/esp32_sim_neo10/");
export const LEAD_FORM_DEMO_MODE: boolean =
  process.env.VITE_LEAD_FORM_DEMO_MODE === "true";

/** Analytics */
export const GA_MEASUREMENT_ID: string = process.env.VITE_GA_MEASUREMENT_ID || "";
export const META_PIXEL_ID: string = process.env.VITE_META_PIXEL_ID || "";
export const ENABLE_ANALYTICS: boolean = process.env.VITE_ENABLE_ANALYTICS === "true";

/** Polling interval for device list (ms) */
export const DEVICE_POLL_INTERVAL: number = 60_000;
