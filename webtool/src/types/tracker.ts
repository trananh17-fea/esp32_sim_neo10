export type HistoryRange =  "24h" | "3d" | "7d";

export type TrackerDeviceSummary = {
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
};

export type TrackerHistoryPoint = {
  deviceId: string;
  deviceName: string;
  lat: number;
  lng: number;
  timestamp: number;
  satellites?: number;
  speedKmph?: number;
  locSource?: string;
  locAccuracyM?: number;
};
