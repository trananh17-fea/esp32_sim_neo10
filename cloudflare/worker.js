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

function jsonResponse(data, corsHeaders, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
        },
    });
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
    const geoRadiusM = Math.min(MAX_GEOFENCE_RADIUS_M, Math.max(0, geoRadiusParsed ?? 0));
    const distanceParsed = normalizeNumber(payload.distanceToHomeM);
    const distanceToHomeM = distanceParsed === null ? -1 : Math.max(-1, distanceParsed);
    const insideGeofence = normalizeBoolean(payload.insideGeofence, false);
    const homeLat = normalizeNumber(payload.homeLat);
    const homeLng = normalizeNumber(payload.homeLng);
    const speedKmph = normalizeNumber(payload.speedKmph ?? payload.speed) ?? 0;
    const satellites = normalizeNumber(payload.satellites) ?? 0;
    const locAccuracyM = normalizeNumber(payload.locAccuracyM);
    const locAgeMs = normalizeNumber(payload.locAgeMs);
    const locSource = normalizeString(payload.locSource, "none");
    const deviceName = normalizeDeviceName(
        payload.deviceName ?? payload.name,
        deviceId
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
        const normalized = normalizeSnapshot(deviceId, JSON.parse(raw));
        return isValidCoordPair(normalized.lat, normalized.lng)
            ? enrichSnapshot(normalized)
            : null;
    } catch {
        return null;
    }
}

async function getLatestHistorySnapshot(env, deviceId) {
    const keys = await listAllKeys(env.TRACKER_KV, `${HISTORY_PREFIX}${deviceId}:`);
    const latestKey = keys.sort((a, b) => a.localeCompare(b)).at(-1);
    if (!latestKey) return null;

    const raw = await env.TRACKER_KV.get(latestKey);
    if (!raw) return null;

    try {
        const normalized = normalizeSnapshot(deviceId, JSON.parse(raw));
        return isValidCoordPair(normalized.lat, normalized.lng)
            ? enrichSnapshot(normalized)
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
    const keys = await listAllKeys(env.TRACKER_KV, `${HISTORY_PREFIX}${deviceId}:`);
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
                return isValidCoordPair(normalized.lat, normalized.lng) ? normalized : null;
            } catch {
                return null;
            }
        })
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
                        400
                    );
                }

                const existingMeta = await getDeviceMeta(env, deviceId);
                const historySample = normalizeBoolean(data.historySample, false);
                const snapshot = normalizeSnapshot(deviceId, {
                    ...data,
                    lat,
                    lng,
                    timestamp: Date.now(),
                    deviceName: existingMeta?.preferredName ?? data.deviceName ?? data.name,
                });
                const meta = {
                    deviceId,
                    deviceName: snapshot.deviceName,
                    preferredName: existingMeta?.preferredName ?? null,
                    lastSeenAt: snapshot.timestamp,
                };

                const writes = [
                    env.TRACKER_KV.put(`${TRACKER_PREFIX}${deviceId}`, JSON.stringify(snapshot)),
                ];

                if (!existingMeta) {
                    writes.push(
                        env.TRACKER_KV.put(
                            `${DEVICE_META_PREFIX}${deviceId}`,
                            JSON.stringify(meta)
                        )
                    );
                    writes.push(ensureDeviceIndexed(env, deviceId));
                } else if (
                    !existingMeta.preferredName &&
                    existingMeta.deviceName !== snapshot.deviceName
                ) {
                    writes.push(
                        env.TRACKER_KV.put(
                            `${DEVICE_META_PREFIX}${deviceId}`,
                            JSON.stringify(meta)
                        )
                    );
                }

                if (historySample) {
                    writes.push(
                        env.TRACKER_KV.put(
                            historyKey(deviceId, snapshot.timestamp),
                            JSON.stringify(snapshot)
                        )
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
                    corsHeaders
                );
            } catch (error) {
                return jsonResponse(
                    { error: error instanceof Error ? error.message : "Unknown error" },
                    corsHeaders,
                    500
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
                        400
                    );
                }

                const current = await getResolvedSnapshot(env, deviceId);
                const meta = {
                    deviceId,
                    deviceName,
                    preferredName: deviceName,
                    lastSeenAt: current?.timestamp ?? Date.now(),
                };

                await Promise.all([
                    env.TRACKER_KV.put(`${DEVICE_META_PREFIX}${deviceId}`, JSON.stringify(meta)),
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
                        JSON.stringify(updatedCurrent)
                    );
                }

                return jsonResponse({ ok: true, deviceId, deviceName }, corsHeaders);
            } catch (error) {
                return jsonResponse(
                    { error: error instanceof Error ? error.message : "Unknown error" },
                    corsHeaders,
                    500
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

                let updatedSnapshot;

                if (clear) {
                    // Remove home fields
                    updatedSnapshot = { ...current };
                    delete updatedSnapshot.ageSeconds;
                    delete updatedSnapshot.online;
                    updatedSnapshot.homeSet = false;
                    updatedSnapshot.homeLat = null;
                    updatedSnapshot.homeLng = null;
                    updatedSnapshot.geoEnabled = false;
                    updatedSnapshot.distanceToHomeM = -1;
                    updatedSnapshot.insideGeofence = false;
                } else {
                    const homeLat = normalizeNumber(data.homeLat);
                    const homeLng = normalizeNumber(data.homeLng);

                    if (!isValidCoordPair(homeLat, homeLng)) {
                        return jsonResponse(
                            { error: "Invalid or missing homeLat / homeLng" },
                            corsHeaders,
                            400
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
                    const distanceToHomeM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                    const geoRadiusM = normalizeNumber(data.geoRadiusM);
                    const geoEnabled =
                        geoRadiusM !== null && geoRadiusM > 0
                            ? true
                            : normalizeBoolean(data.geoEnabled, current.geoEnabled ?? false);

                    updatedSnapshot = {
                        ...current,
                        homeSet: true,
                        homeLat,
                        homeLng,
                        distanceToHomeM: Math.round(distanceToHomeM),
                        insideGeofence:
                            geoEnabled && geoRadiusM
                                ? distanceToHomeM <= geoRadiusM
                                : current.insideGeofence ?? false,
                        geoEnabled,
                        geoRadiusM: geoRadiusM ?? current.geoRadiusM ?? 0,
                    };
                    delete updatedSnapshot.ageSeconds;
                    delete updatedSnapshot.online;
                }

                await env.TRACKER_KV.put(
                    `${TRACKER_PREFIX}${deviceId}`,
                    JSON.stringify(updatedSnapshot)
                );

                return jsonResponse(
                    {
                        ok: true,
                        deviceId,
                        homeSet: updatedSnapshot.homeSet,
                        homeLat: updatedSnapshot.homeLat ?? null,
                        homeLng: updatedSnapshot.homeLng ?? null,
                        distanceToHomeM: updatedSnapshot.distanceToHomeM ?? -1,
                    },
                    corsHeaders
                );
            } catch (error) {
                return jsonResponse(
                    { error: error instanceof Error ? error.message : "Unknown error" },
                    corsHeaders,
                    500
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
                })
            );

            return jsonResponse(
                {
                    devices: devices
                        .filter(Boolean)
                        .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0)),
                    generatedAt: Date.now(),
                },
                corsHeaders
            );
        }

        if (request.method === "GET" && url.pathname === "/api/location") {
            const deviceId = normalizeDeviceId(
                url.searchParams.get("deviceId") || url.searchParams.get("id")
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
                url.searchParams.get("deviceId") || url.searchParams.get("id")
            );

            if (!deviceId) {
                return jsonResponse({ error: "Missing deviceId" }, corsHeaders, 400);
            }

            const from = parseTimestampParam(url.searchParams.get("from")) ?? 0;
            const to = parseTimestampParam(url.searchParams.get("to")) ?? Date.now();
            const limit = Math.min(
                MAX_HISTORY_LIMIT,
                Math.max(1, Number(url.searchParams.get("limit") || 200))
            );

            const meta = await getDeviceMeta(env, deviceId);
            const preferredName = meta?.preferredName ?? meta?.deviceName ?? null;
            const points = await getHistoryPoints(env, deviceId, from, to, limit);
            const normalizedPoints = preferredName
                ? points.map((point) => ({ ...point, deviceName: preferredName }))
                : points;

            return jsonResponse(
                { deviceId, points: normalizedPoints, from, to, limit },
                corsHeaders
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
                        "/api/devices",
                        "/api/location",
                        "/api/history",
                        "/api/device/rename",
                        "/api/device/home",
                    ],
                },
                corsHeaders
            );
        }

        return jsonResponse({ ok: false, error: "Not found" }, corsHeaders, 404);
    },
};
