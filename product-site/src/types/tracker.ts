// ─────────────────────────────────────────────
// Tracker / GPS types
// ─────────────────────────────────────────────

export type HistoryRange = "24h" | "3d" | "7d";
export type RouteMode = "off" | "selected" | "all";
export type MapLayer = "roadmap" | "satellite";

export interface TrackerDeviceSummary {
  deviceId: string;
  deviceName: string;
  lat: number;
  lng: number;
  timestamp: number;
  ageSeconds: number;
  online: boolean;
  satellites?: number;
  speedKmph?: number;
  locSource?: string;
  locAccuracyM?: number;
  homeSet?: boolean;
  geoEnabled?: boolean;
  geoRadiusM?: number;
  distanceToHomeM?: number;
  insideGeofence?: boolean;
  homeLat?: number;
  homeLng?: number;
  lastSeenAt?: number;
}

export interface TrackerHistoryPoint {
  deviceId: string;
  deviceName: string;
  lat: number;
  lng: number;
  timestamp: number;
  satellites?: number;
  speedKmph?: number;
  locSource?: string;
  locAccuracyM?: number;
}

// ─────────────────────────────────────────────
// Lead / Order Form types
// ─────────────────────────────────────────────

export interface LeadFormData {
  name: string;
  phone: string;
  email: string;
  interest: string;
  quantity: number;
  product: string;
  message: string;
}

export interface LeadPayload extends LeadFormData {
  source: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// UI / Component prop types
// ─────────────────────────────────────────────

export type OrderFormStatus = "idle" | "sending" | "success" | "error";

export interface BrandLogoProps {
  className?: string;
  compact?: boolean;
  showSubtitle?: boolean;
}

export interface OrderFormProps {
  className?: string;
}
