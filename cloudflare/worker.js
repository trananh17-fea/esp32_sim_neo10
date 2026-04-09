const MAX_GEOFENCE_RADIUS_M = 100000;
const ONLINE_THRESHOLD_SECONDS = 120;
const MAX_HISTORY_LIMIT = 500;
const TRACKER_PREFIX = "TRACKER:";
const DEVICE_META_PREFIX = "DEVICE_META:";
const HISTORY_PREFIX = "HISTORY:";
const DEVICE_INDEX_KEY = "DEVICE_INDEX";

function normalizeNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeString(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

function normalizeDeviceId(value) {
  const base = normalizeString(value);
  if (!base) return null;

  const normalized = base.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  return normalized || null;
}

function normalizeDeviceName(value, fallback) {
  return normalizeString(value, fallback).slice(0, 64);
}

function isValidCoordPair(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function applyHomeOverride(snapshot, meta) {
  if (!snapshot) return snapshot;

  const override = meta?.homeOverride;
  if (!override || typeof override !== "object") return snapshot;

  const next = { ...snapshot };
  const mode = normalizeString(override.mode);

  if (mode === "cleared") {
    next.homeSet = false;
    delete next.homeLat;
    delete next.homeLng;
    next.geoEnabled = false;
    next.geoRadiusM = 0;
    next.distanceToHomeM = -1;
    next.insideGeofence = false;
    return next;
  }

  if (mode === "custom") {
    const homeLat = normalizeNumber(override.homeLat);
    const homeLng = normalizeNumber(override.homeLng);
    if (!isValidCoordPair(homeLat, homeLng)) return next;

    next.homeSet = true;
    next.homeLat = homeLat;
    next.homeLng = homeLng;

    const geoRadiusM = normalizeNumber(override.geoRadiusM);
    next.geoRadiusM = geoRadiusM !== null && geoRadiusM > 0 ? geoRadiusM : 0;
    next.geoEnabled = next.geoRadiusM > 0;

    if (isValidCoordPair(next.lat, next.lng)) {
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(homeLat - next.lat);
      const dLng = toRad(homeLng - next.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(next.lat)) *
          Math.cos(toRad(homeLat)) *
          Math.sin(dLng / 2) ** 2;
      const distanceToHomeM =
        R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      next.distanceToHomeM = Math.round(distanceToHomeM);
      next.insideGeofence =
        next.geoEnabled && next.geoRadiusM > 0
          ? distanceToHomeM <= next.geoRadiusM
          : false;
    }
  }

  return next;
}

function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function parseWifiQuery(value) {
  const raw = normalizeString(value);
  if (!raw) return [];
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [bssidRaw, rssiRaw, chRaw] = item.split("|");
      const hex = normalizeString(bssidRaw)
        .replace(/[^a-fA-F0-9]/g, "")
        .toUpperCase();
      if (hex.length !== 12) return null;
      const bssid = hex.match(/.{1,2}/g).join(":");
      const rssi = normalizeNumber(rssiRaw);
      const channel = normalizeNumber(chRaw);
      if (rssi === null || channel === null) return null;
      return { bssid, rssi, channel };
    })
    .filter(Boolean);
}

async function geolocateFromQuery(url) {
  const provider = normalizeString(
    url.searchParams.get("provider"),
    "unwiredlabs",
  ).toLowerCase();
  const apiKey = normalizeString(url.searchParams.get("key"));
  const radio = normalizeString(url.searchParams.get("radio"), "lte");
  const mcc = normalizeNumber(url.searchParams.get("mcc"));
  const mnc = normalizeNumber(url.searchParams.get("mnc"));
  const lac = normalizeNumber(url.searchParams.get("lac"));
  const cid = normalizeNumber(url.searchParams.get("cid"));
  const dbm = normalizeNumber(url.searchParams.get("dbm")) ?? -113;
  const wifi = parseWifiQuery(url.searchParams.get("wifi"));

  if (!apiKey || mcc === null || mnc === null || lac === null || cid === null) {
    return {
      ok: false,
      status: 400,
      body: { error: "Missing geolocation params" },
    };
  }

  let upstreamUrl = "";
  let payload;
  if (provider === "google") {
    upstreamUrl = `https://www.googleapis.com/geolocation/v1/geolocate?key=${encodeURIComponent(apiKey)}`;
    payload = {
      radioType: radio,
      considerIp: true,
      cellTowers: [
        {
          mobileCountryCode: mcc,
          mobileNetworkCode: mnc,
          locationAreaCode: lac,
          cellId: cid,
          signalStrength: dbm,
        },
      ],
      wifiAccessPoints: wifi.map((ap) => ({
        macAddress: ap.bssid,
        signalStrength: ap.rssi,
        channel: ap.channel,
      })),
    };
  } else {
    upstreamUrl = "https://us1.unwiredlabs.com/v2/process.php";
    payload = {
      token: apiKey,
      radio,
      mcc,
      mnc,
      cells: [{ lac, cid }],
      wifi: wifi.map((ap) => ({
        bssid: ap.bssid,
        signal: ap.rssi,
        channel: ap.channel,
      })),
      address: 1,
    };
  }

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      body: {
        error: "Upstream geolocation failed",
        provider,
        upstreamStatus: upstream.status,
        upstreamBody: parsed,
      },
    };
  }

  const location =
    parsed.location && typeof parsed.location === "object"
      ? parsed.location
      : parsed;
  const lat = normalizeNumber(location.lat);
  const lng = normalizeNumber(location.lng ?? location.lon);
  const accuracy =
    normalizeNumber(parsed.accuracy ?? location.accuracy) ?? 9999;

  if (!isValidCoordPair(lat, lng)) {
    return {
      ok: false,
      status: 502,
      body: {
        error: "Invalid upstream location",
        provider,
        upstreamBody: parsed,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: { ok: true, provider, lat, lng, accuracy },
  };
}

function parseTimestampParam(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function historyKey(deviceId, timestamp) {
  return `${HISTORY_PREFIX}${deviceId}:${String(timestamp).padStart(13, "0")}`;
}

function extractDeviceIdFromHistoryKey(key) {
  if (!key.startsWith(HISTORY_PREFIX)) return null;

  const suffix = key.slice(HISTORY_PREFIX.length);
  const separatorIndex = suffix.lastIndexOf(":");
  if (separatorIndex <= 0) return null;

  return normalizeDeviceId(suffix.slice(0, separatorIndex));
}

async function listAllKeys(kv, prefix) {
  const names = [];
  let cursor = undefined;

  do {
    const result = await kv.list({ prefix, cursor, limit: 1000 });
    names.push(...result.keys.map((entry) => entry.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return names;
}

async function getDeviceMeta(env, deviceId) {
  const raw = await env.TRACKER_KV.get(`${DEVICE_META_PREFIX}${deviceId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getDeviceIndex(env) {
  const raw = await env.TRACKER_KV.get(DEVICE_INDEX_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const ids = [];
    for (const item of parsed) {
      const deviceId = normalizeDeviceId(item);
      if (deviceId && !ids.includes(deviceId)) ids.push(deviceId);
    }
    return ids;
  } catch {
    return [];
  }
}

async function saveDeviceIndex(env, deviceIds) {
  await env.TRACKER_KV.put(DEVICE_INDEX_KEY, JSON.stringify(deviceIds));
}

async function ensureDeviceIndexed(env, deviceId) {
  const currentIndex = await getDeviceIndex(env);
  if (currentIndex.includes(deviceId)) return;

  currentIndex.push(deviceId);
  await saveDeviceIndex(env, currentIndex);
}

function normalizeSnapshot(deviceId, payload) {
  const lat = normalizeNumber(payload.lat);
  const lng = normalizeNumber(payload.lng);
  const timestamp = normalizeNumber(payload.timestamp) ?? Date.now();
  const homeSet = normalizeBoolean(payload.homeSet, false);
  const geoEnabled = normalizeBoolean(payload.geoEnabled, false);
  const geoRadiusParsed = normalizeNumber(payload.geoRadiusM);
  const geoRadiusM = Math.min(
    MAX_GEOFENCE_RADIUS_M,
    Math.max(0, geoRadiusParsed ?? 0),
  );
  const distanceParsed = normalizeNumber(payload.distanceToHomeM);
  const distanceToHomeM =
    distanceParsed === null ? -1 : Math.max(-1, distanceParsed);
  const insideGeofence = normalizeBoolean(payload.insideGeofence, false);
  const homeLat = normalizeNumber(payload.homeLat);
  const homeLng = normalizeNumber(payload.homeLng);
  const speedKmph = normalizeNumber(payload.speedKmph ?? payload.speed) ?? 0;
  const satellites = normalizeNumber(payload.satellites) ?? 0;
  const locAccuracyM = normalizeNumber(payload.locAccuracyM);
  const locAgeMs = normalizeNumber(payload.locAgeMs);
  const locSource = normalizeString(payload.locSource, "none");
  const batteryPercent = normalizeNumber(payload.batteryPercent);
  const batteryVoltageV = normalizeNumber(payload.batteryVoltageV);
  const deviceName = normalizeDeviceName(
    payload.deviceName ?? payload.name,
    deviceId,
  );

  const snapshot = {
    id: deviceId,
    deviceId,
    deviceName,
    lat,
    lng,
    speedKmph,
    satellites,
    timestamp,
    homeSet,
    geoEnabled,
    geoRadiusM,
    distanceToHomeM,
    insideGeofence,
    locSource,
  };

  if (locAccuracyM !== null) snapshot.locAccuracyM = locAccuracyM;
  if (locAgeMs !== null) snapshot.locAgeMs = locAgeMs;
  if (batteryPercent !== null) snapshot.batteryPercent = batteryPercent;
  if (batteryVoltageV !== null) snapshot.batteryVoltageV = batteryVoltageV;

  if (isValidCoordPair(homeLat, homeLng)) {
    snapshot.homeLat = homeLat;
    snapshot.homeLng = homeLng;
  }

  return snapshot;
}

function enrichSnapshot(snapshot, now = Date.now()) {
  const timestamp = normalizeNumber(snapshot.timestamp) ?? 0;
  const ageSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  return {
    ...snapshot,
    ageSeconds,
    online: ageSeconds <= ONLINE_THRESHOLD_SECONDS,
  };
}

async function getCurrentSnapshot(env, deviceId) {
  const raw = await env.TRACKER_KV.get(`${TRACKER_PREFIX}${deviceId}`);
  if (!raw) return null;

  try {
    const meta = await getDeviceMeta(env, deviceId);
    const normalized = normalizeSnapshot(deviceId, JSON.parse(raw));
    return isValidCoordPair(normalized.lat, normalized.lng)
      ? enrichSnapshot(applyHomeOverride(normalized, meta))
      : null;
  } catch {
    return null;
  }
}

async function getLatestHistorySnapshot(env, deviceId) {
  const keys = await listAllKeys(
    env.TRACKER_KV,
    `${HISTORY_PREFIX}${deviceId}:`,
  );
  const latestKey = keys.sort((a, b) => a.localeCompare(b)).at(-1);
  if (!latestKey) return null;

  const raw = await env.TRACKER_KV.get(latestKey);
  if (!raw) return null;

  try {
    const meta = await getDeviceMeta(env, deviceId);
    const normalized = normalizeSnapshot(deviceId, JSON.parse(raw));
    return isValidCoordPair(normalized.lat, normalized.lng)
      ? enrichSnapshot(applyHomeOverride(normalized, meta))
      : null;
  } catch {
    return null;
  }
}

async function getResolvedSnapshot(env, deviceId) {
  const current = await getCurrentSnapshot(env, deviceId);
  if (current) return current;
  return getLatestHistorySnapshot(env, deviceId);
}

async function listKnownDeviceIds(env) {
  const indexedIds = await getDeviceIndex(env);
  if (indexedIds.length) return indexedIds;

  const [metaKeys, trackerKeys] = await Promise.all([
    listAllKeys(env.TRACKER_KV, DEVICE_META_PREFIX),
    listAllKeys(env.TRACKER_KV, TRACKER_PREFIX),
  ]);

  const ids = new Set();

  for (const key of metaKeys) {
    const deviceId = normalizeDeviceId(key.slice(DEVICE_META_PREFIX.length));
    if (deviceId) ids.add(deviceId);
  }

  for (const key of trackerKeys) {
    const deviceId = normalizeDeviceId(key.slice(TRACKER_PREFIX.length));
    if (deviceId) ids.add(deviceId);
  }

  const resolvedIds = Array.from(ids);
  if (resolvedIds.length) {
    await saveDeviceIndex(env, resolvedIds);
  }

  return resolvedIds;
}

async function getHistoryPoints(env, deviceId, from, to, limit) {
  const keys = await listAllKeys(
    env.TRACKER_KV,
    `${HISTORY_PREFIX}${deviceId}:`,
  );
  const selectedKeys = keys
    .filter((key) => {
      const timestamp = Number(key.split(":").at(-1));
      return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
    })
    .sort((a, b) => a.localeCompare(b))
    .slice(-limit);

  const values = await Promise.all(
    selectedKeys.map(async (key) => {
      const raw = await env.TRACKER_KV.get(key);
      if (!raw) return null;

      try {
        const normalized = normalizeSnapshot(deviceId, JSON.parse(raw));
        return isValidCoordPair(normalized.lat, normalized.lng)
          ? normalized
          : null;
      } catch {
        return null;
      }
    }),
  );

  return values.filter(Boolean);
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET" && url.pathname === "/api/geolocate") {
      try {
        const result = await geolocateFromQuery(url);
        return jsonResponse(result.body, corsHeaders, result.status);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Unknown error" },
          corsHeaders,
          500,
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/api/ping") {
      return jsonResponse(
        {
          ok: true,
          pong: true,
          ts: Date.now(),
          host: url.hostname,
        },
        corsHeaders,
      );
    }

    if (request.method === "GET" && url.pathname === "/update_get") {
      try {
        const deviceId = normalizeDeviceId(
          url.searchParams.get("deviceId") || url.searchParams.get("id"),
        );
        const lat = normalizeNumber(url.searchParams.get("lat"));
        const lng = normalizeNumber(url.searchParams.get("lng"));

        if (!deviceId || lat === null || lng === null) {
          return jsonResponse(
            { error: "Missing deviceId, lat or lng" },
            corsHeaders,
            400,
          );
        }

        const existingMeta = await getDeviceMeta(env, deviceId);
        const historySample = normalizeBoolean(
          url.searchParams.get("historySample"),
          false,
        );

        const snapshot = applyHomeOverride(
          normalizeSnapshot(deviceId, {
            deviceId,
            deviceName:
              existingMeta?.preferredName ??
              url.searchParams.get("deviceName") ??
              deviceId,
            lat,
            lng,
            timestamp: Date.now(),
            locSource: url.searchParams.get("locSource"),
            locAccuracyM: url.searchParams.get("locAccuracyM"),
            locAgeMs: url.searchParams.get("locAgeMs"),
            satellites: url.searchParams.get("satellites"),
            speedKmph: url.searchParams.get("speedKmph"),
            batteryPercent: url.searchParams.get("batteryPercent"),
            batteryVoltageV: url.searchParams.get("batteryVoltageV"),
            historySample,
          }),
          existingMeta,
        );

        const meta = {
          deviceId,
          deviceName: snapshot.deviceName,
          preferredName: existingMeta?.preferredName ?? null,
          lastSeenAt: snapshot.timestamp,
          homeOverride: existingMeta?.homeOverride ?? null,
        };

        const writes = [
          env.TRACKER_KV.put(
            `${TRACKER_PREFIX}${deviceId}`,
            JSON.stringify(snapshot),
          ),
        ];

        if (!existingMeta) {
          writes.push(
            env.TRACKER_KV.put(
              `${DEVICE_META_PREFIX}${deviceId}`,
              JSON.stringify(meta),
            ),
          );
          writes.push(ensureDeviceIndexed(env, deviceId));
        }

        if (historySample) {
          writes.push(
            env.TRACKER_KV.put(
              historyKey(deviceId, snapshot.timestamp),
              JSON.stringify(snapshot),
            ),
          );
        }

        await Promise.all(writes);

        return jsonResponse(
          {
            ok: true,
            deviceId,
            historySample,
            transport: "get",
            timestamp: snapshot.timestamp,
          },
          corsHeaders,
        );
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Unknown error" },
          corsHeaders,
          500,
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/update") {
      try {
        const data = await request.json();
        const deviceId = normalizeDeviceId(data.deviceId ?? data.id);
        const lat = normalizeNumber(data.lat);
        const lng = normalizeNumber(data.lng);

        if (!deviceId || lat === null || lng === null) {
          return jsonResponse(
            { error: "Missing deviceId, lat or lng" },
            corsHeaders,
            400,
          );
        }

        const existingMeta = await getDeviceMeta(env, deviceId);
        const historySample = normalizeBoolean(data.historySample, false);
        const snapshot = applyHomeOverride(
          normalizeSnapshot(deviceId, {
            ...data,
            lat,
            lng,
            timestamp: Date.now(),
            deviceName:
              existingMeta?.preferredName ?? data.deviceName ?? data.name,
          }),
          existingMeta,
        );
        const meta = {
          deviceId,
          deviceName: snapshot.deviceName,
          preferredName: existingMeta?.preferredName ?? null,
          lastSeenAt: snapshot.timestamp,
          homeOverride: existingMeta?.homeOverride ?? null,
        };

        const writes = [
          env.TRACKER_KV.put(
            `${TRACKER_PREFIX}${deviceId}`,
            JSON.stringify(snapshot),
          ),
        ];

        if (!existingMeta) {
          writes.push(
            env.TRACKER_KV.put(
              `${DEVICE_META_PREFIX}${deviceId}`,
              JSON.stringify(meta),
            ),
          );
          writes.push(ensureDeviceIndexed(env, deviceId));
        } else if (
          !existingMeta.preferredName &&
          existingMeta.deviceName !== snapshot.deviceName
        ) {
          writes.push(
            env.TRACKER_KV.put(
              `${DEVICE_META_PREFIX}${deviceId}`,
              JSON.stringify(meta),
            ),
          );
        }

        if (historySample) {
          writes.push(
            env.TRACKER_KV.put(
              historyKey(deviceId, snapshot.timestamp),
              JSON.stringify(snapshot),
            ),
          );
        }

        await Promise.all(writes);

        return jsonResponse(
          {
            ok: true,
            deviceId,
            historySample,
            timestamp: snapshot.timestamp,
          },
          corsHeaders,
        );
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Unknown error" },
          corsHeaders,
          500,
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/device/rename") {
      try {
        const data = await request.json();
        const deviceId = normalizeDeviceId(data.deviceId);
        const deviceName = normalizeDeviceName(data.deviceName, "");

        if (!deviceId || !deviceName) {
          return jsonResponse(
            { error: "Missing deviceId or deviceName" },
            corsHeaders,
            400,
          );
        }

        const current = await getResolvedSnapshot(env, deviceId);
        const meta = {
          deviceId,
          deviceName,
          preferredName: deviceName,
          lastSeenAt: current?.timestamp ?? Date.now(),
          homeOverride:
            (await getDeviceMeta(env, deviceId))?.homeOverride ?? null,
        };

        await Promise.all([
          env.TRACKER_KV.put(
            `${DEVICE_META_PREFIX}${deviceId}`,
            JSON.stringify(meta),
          ),
          ensureDeviceIndexed(env, deviceId),
        ]);

        if (current) {
          const updatedCurrent = {
            ...current,
            deviceName,
          };
          delete updatedCurrent.ageSeconds;
          delete updatedCurrent.online;
          await env.TRACKER_KV.put(
            `${TRACKER_PREFIX}${deviceId}`,
            JSON.stringify(updatedCurrent),
          );
        }

        return jsonResponse({ ok: true, deviceId, deviceName }, corsHeaders);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Unknown error" },
          corsHeaders,
          500,
        );
      }
    }

    // POST /api/device/home — set or clear the home position for a device (from webtool)
    if (request.method === "POST" && url.pathname === "/api/device/home") {
      try {
        const data = await request.json();
        const deviceId = normalizeDeviceId(data.deviceId);
        if (!deviceId) {
          return jsonResponse({ error: "Missing deviceId" }, corsHeaders, 400);
        }

        const clear = normalizeBoolean(data.clear, false);

        const current = await getResolvedSnapshot(env, deviceId);
        if (!current) {
          return jsonResponse({ error: "Device not found" }, corsHeaders, 404);
        }

        const currentMeta = await getDeviceMeta(env, deviceId);

        let updatedSnapshot;
        let homeOverride;

        if (clear) {
          // Remove home fields
          updatedSnapshot = { ...current };
          delete updatedSnapshot.ageSeconds;
          delete updatedSnapshot.online;
          updatedSnapshot.homeSet = false;
          delete updatedSnapshot.homeLat;
          delete updatedSnapshot.homeLng;
          updatedSnapshot.geoEnabled = false;
          updatedSnapshot.geoRadiusM = 0;
          updatedSnapshot.distanceToHomeM = -1;
          updatedSnapshot.insideGeofence = false;
          homeOverride = { mode: "cleared" };
        } else {
          const homeLat = normalizeNumber(data.homeLat);
          const homeLng = normalizeNumber(data.homeLng);

          if (!isValidCoordPair(homeLat, homeLng)) {
            return jsonResponse(
              { error: "Invalid or missing homeLat / homeLng" },
              corsHeaders,
              400,
            );
          }

          // Compute straight-line distance from device to new home
          const R = 6371000; // metres
          const toRad = (d) => (d * Math.PI) / 180;
          const dLat = toRad(homeLat - current.lat);
          const dLng = toRad(homeLng - current.lng);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(current.lat)) *
              Math.cos(toRad(homeLat)) *
              Math.sin(dLng / 2) ** 2;
          const distanceToHomeM =
            R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

          const geoRadiusM = normalizeNumber(data.geoRadiusM);
          const geoEnabled =
            geoRadiusM !== null && geoRadiusM > 0
              ? true
              : normalizeBoolean(data.geoEnabled, current.geoEnabled ?? false);

          homeOverride = {
            mode: "custom",
            homeLat,
            homeLng,
            geoRadiusM:
              geoEnabled && geoRadiusM !== null && geoRadiusM > 0
                ? geoRadiusM
                : 0,
          };

          updatedSnapshot = {
            ...current,
            homeSet: true,
            homeLat,
            homeLng,
            distanceToHomeM: Math.round(distanceToHomeM),
            insideGeofence:
              geoEnabled && geoRadiusM
                ? distanceToHomeM <= geoRadiusM
                : (current.insideGeofence ?? false),
            geoEnabled,
            geoRadiusM: geoRadiusM ?? current.geoRadiusM ?? 0,
          };
          delete updatedSnapshot.ageSeconds;
          delete updatedSnapshot.online;
        }

        const meta = {
          deviceId,
          deviceName: currentMeta?.deviceName ?? current.deviceName ?? deviceId,
          preferredName: currentMeta?.preferredName ?? null,
          lastSeenAt: current.timestamp ?? Date.now(),
          homeOverride,
        };

        await Promise.all([
          env.TRACKER_KV.put(
            `${TRACKER_PREFIX}${deviceId}`,
            JSON.stringify(updatedSnapshot),
          ),
          env.TRACKER_KV.put(
            `${DEVICE_META_PREFIX}${deviceId}`,
            JSON.stringify(meta),
          ),
          ensureDeviceIndexed(env, deviceId),
        ]);

        return jsonResponse(
          {
            ok: true,
            deviceId,
            homeSet: updatedSnapshot.homeSet,
            homeLat: updatedSnapshot.homeLat ?? null,
            homeLng: updatedSnapshot.homeLng ?? null,
            distanceToHomeM: updatedSnapshot.distanceToHomeM ?? -1,
          },
          corsHeaders,
        );
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Unknown error" },
          corsHeaders,
          500,
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/api/devices") {
      const deviceIds = await listKnownDeviceIds(env);
      const devices = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const [meta, current] = await Promise.all([
            getDeviceMeta(env, deviceId),
            getCurrentSnapshot(env, deviceId),
          ]);

          if (!current) return null;

          const resolvedName =
            meta?.preferredName ??
            meta?.deviceName ??
            current?.deviceName ??
            deviceId;

          return {
            ...(current ?? {}),
            deviceId,
            deviceName: resolvedName,
            lastSeenAt: current?.timestamp ?? meta?.lastSeenAt ?? 0,
          };
        }),
      );

      return jsonResponse(
        {
          devices: devices
            .filter(Boolean)
            .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0)),
          generatedAt: Date.now(),
        },
        corsHeaders,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/location") {
      const deviceId = normalizeDeviceId(
        url.searchParams.get("deviceId") || url.searchParams.get("id"),
      );

      if (!deviceId) {
        return jsonResponse({ error: "Missing deviceId" }, corsHeaders, 400);
      }

      const current = await getResolvedSnapshot(env, deviceId);
      if (!current) {
        return jsonResponse({ error: "Device not found" }, corsHeaders, 404);
      }

      return jsonResponse(current, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/api/history") {
      const deviceId = normalizeDeviceId(
        url.searchParams.get("deviceId") || url.searchParams.get("id"),
      );

      if (!deviceId) {
        return jsonResponse({ error: "Missing deviceId" }, corsHeaders, 400);
      }

      const from = parseTimestampParam(url.searchParams.get("from")) ?? 0;
      const to = parseTimestampParam(url.searchParams.get("to")) ?? Date.now();
      const limit = Math.min(
        MAX_HISTORY_LIMIT,
        Math.max(1, Number(url.searchParams.get("limit") || 200)),
      );

      const meta = await getDeviceMeta(env, deviceId);
      const preferredName = meta?.preferredName ?? meta?.deviceName ?? null;
      const points = await getHistoryPoints(env, deviceId, from, to, limit);
      const normalizedPoints = preferredName
        ? points.map((point) => ({ ...point, deviceName: preferredName }))
        : points;

      return jsonResponse(
        { deviceId, points: normalizedPoints, from, to, limit },
        corsHeaders,
      );
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/api/health")
    ) {
      return jsonResponse(
        {
          ok: true,
          service: "gps-tracker-worker",
          endpoints: [
            "/update",
            "/update_get",
            "/api/ping",
            "/api/devices",
            "/api/location",
            "/api/history",
            "/api/device/rename",
            "/api/device/home",
          ],
        },
        corsHeaders,
      );
    }

    return jsonResponse({ ok: false, error: "Not found" }, corsHeaders, 404);
  },
};
