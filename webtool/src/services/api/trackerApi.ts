import type {
  HistoryRange,
  TrackerDeviceSummary,
  TrackerHistoryPoint,
} from "../../types/tracker";

const API_BASE = (
  process.env.TRACKER_API_BASE || "https://gps-tracker.ahcntab.workers.dev"
).replace(/\/$/, "");

function rangeToFromTimestamp(range: HistoryRange) {
  const now = Date.now();

  switch (range) {
    case "30m":
      return now - 30 * 60 * 1000;
    case "6h":
      return now - 6 * 60 * 60 * 1000;
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const rawBody = await response.text();
  const trimmedBody = rawBody.trim();
  let parsedBody: unknown = null;

  if (trimmedBody) {
    try {
      parsedBody = JSON.parse(trimmedBody) as unknown;
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "error" in parsedBody &&
      typeof parsedBody.error === "string"
    ) {
      throw new Error(parsedBody.error);
    }

    throw new Error(trimmedBody || `Request failed with ${response.status}`);
  }

  if (parsedBody !== null) {
    return parsedBody as T;
  }

  const sample = trimmedBody.slice(0, 160);
  if (/tracker worker/i.test(sample)) {
    throw new Error(
      "API returned text instead of JSON. Redeploy the Cloudflare Worker in /cloudflare so /api/* serves JSON."
    );
  }

  throw new Error(
    sample
      ? `API returned non-JSON for ${path}: ${sample}`
      : `API returned an empty response for ${path}.`
  );
}

type DevicesResponse = {
  devices: TrackerDeviceSummary[];
};

type HistoryResponse = {
  points: TrackerHistoryPoint[];
};

type LocationResponse = TrackerDeviceSummary;

type RenameResponse = {
  deviceName: string;
};

export async function fetchDevices() {
  const response = await requestJson<DevicesResponse>("/api/devices");
  return response.devices;
}

export async function fetchDeviceLocation(deviceId: string) {
  return requestJson<LocationResponse>(
    `/api/location?deviceId=${encodeURIComponent(deviceId)}`
  );
}

export async function fetchHistory(deviceId: string, range: HistoryRange) {
  const from = rangeToFromTimestamp(range);
  const response = await requestJson<HistoryResponse>(
    `/api/history?deviceId=${encodeURIComponent(deviceId)}&from=${from}&to=${Date.now()}&limit=300`
  );
  return response.points;
}

export async function renameDevice(deviceId: string, deviceName: string) {
  const response = await requestJson<RenameResponse>("/api/device/rename", {
    method: "POST",
    body: JSON.stringify({ deviceId, deviceName }),
  });
  return response.deviceName;
}

type HomeResponse = {
  ok: boolean;
  deviceId: string;
  homeSet: boolean;
  homeLat: number | null;
  homeLng: number | null;
  distanceToHomeM: number;
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function saveHomeViaLegacyUpdate(
  device: TrackerDeviceSummary,
  homeLat: number,
  homeLng: number,
  geoRadiusM?: number,
): Promise<HomeResponse> {
  const distanceToHomeM = Math.round(haversineM(device.lat, device.lng, homeLat, homeLng));
  await requestJson<{ ok?: boolean }>("/update", {
    method: "POST",
    body: JSON.stringify({
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      lat: device.lat,
      lng: device.lng,
      timestamp: device.timestamp,
      homeSet: true,
      homeLat,
      homeLng,
      geoEnabled: typeof geoRadiusM === "number" && geoRadiusM > 0,
      geoRadiusM: geoRadiusM ?? device.geoRadiusM ?? 0,
      distanceToHomeM,
      insideGeofence:
        typeof geoRadiusM === "number" && geoRadiusM > 0
          ? distanceToHomeM <= geoRadiusM
          : false,
      satellites: device.satellites,
      speedKmph: device.speedKmph,
      locSource: device.locSource,
      locAccuracyM: device.locAccuracyM,
    }),
  });

  return {
    ok: true,
    deviceId: device.deviceId,
    homeSet: true,
    homeLat,
    homeLng,
    distanceToHomeM,
  };
}

async function clearHomeViaLegacyUpdate(device: TrackerDeviceSummary): Promise<HomeResponse> {
  await requestJson<{ ok?: boolean }>("/update", {
    method: "POST",
    body: JSON.stringify({
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      lat: device.lat,
      lng: device.lng,
      timestamp: device.timestamp,
      homeSet: false,
      geoEnabled: false,
      geoRadiusM: 0,
      distanceToHomeM: -1,
      insideGeofence: false,
      satellites: device.satellites,
      speedKmph: device.speedKmph,
      locSource: device.locSource,
      locAccuracyM: device.locAccuracyM,
    }),
  });

  return {
    ok: true,
    deviceId: device.deviceId,
    homeSet: false,
    homeLat: null,
    homeLng: null,
    distanceToHomeM: -1,
  };
}

export async function setDeviceHome(
  device: TrackerDeviceSummary,
  homeLat: number,
  homeLng: number,
  geoRadiusM?: number,
): Promise<HomeResponse> {
  try {
    return await requestJson<HomeResponse>("/api/device/home", {
      method: "POST",
      body: JSON.stringify({ deviceId: device.deviceId, homeLat, homeLng, geoRadiusM }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) {
      return saveHomeViaLegacyUpdate(device, homeLat, homeLng, geoRadiusM);
    }
    throw error;
  }
}

export async function clearDeviceHome(device: TrackerDeviceSummary): Promise<HomeResponse> {
  try {
    return await requestJson<HomeResponse>("/api/device/home", {
      method: "POST",
      body: JSON.stringify({ deviceId: device.deviceId, clear: true }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) {
      return clearHomeViaLegacyUpdate(device);
    }
    throw error;
  }
}
