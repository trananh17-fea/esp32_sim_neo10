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

type RenameResponse = {
  deviceName: string;
};

export async function fetchDevices() {
  const response = await requestJson<DevicesResponse>("/api/devices");
  return response.devices;
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

export async function setDeviceHome(
  deviceId: string,
  homeLat: number,
  homeLng: number,
  geoRadiusM?: number,
): Promise<HomeResponse> {
  return requestJson<HomeResponse>("/api/device/home", {
    method: "POST",
    body: JSON.stringify({ deviceId, homeLat, homeLng, geoRadiusM }),
  });
}

export async function clearDeviceHome(deviceId: string): Promise<HomeResponse> {
  return requestJson<HomeResponse>("/api/device/home", {
    method: "POST",
    body: JSON.stringify({ deviceId, clear: true }),
  });
}
