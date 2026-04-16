// ─────────────────────────────────────────────
// Global type declarations for Webpack build
// ─────────────────────────────────────────────

// Image imports
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.ico" {
  const src: string;
  export default src;
}

// Video imports
declare module "*.mp4" {
  const src: string;
  export default src;
}
declare module "*.webm" {
  const src: string;
  export default src;
}
declare module "*.ogg" {
  const src: string;
  export default src;
}

// Font imports
declare module "*.woff" {
  const src: string;
  export default src;
}
declare module "*.woff2" {
  const src: string;
  export default src;
}
declare module "*.eot" {
  const src: string;
  export default src;
}
declare module "*.ttf" {
  const src: string;
  export default src;
}
declare module "*.otf" {
  const src: string;
  export default src;
}

// Environment variables (via dotenv-webpack)
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    VITE_TRACKER_API_BASE?: string;
    VITE_GOOGLE_SHEET_WEBHOOK_URL?: string;
    VITE_LOCAL_LEAD_ENDPOINT?: string;
    VITE_DEMO_VIDEO_EMBED_URL?: string;
    VITE_TRACKING_WEB_URL?: string;
    VITE_LEAD_FORM_DEMO_MODE?: string;
    VITE_GA_MEASUREMENT_ID?: string;
    VITE_META_PIXEL_ID?: string;
    VITE_ENABLE_ANALYTICS?: string;
  }
}