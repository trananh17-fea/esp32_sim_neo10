const MAX_GEOFENCE_RADIUS_M = 100000;

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

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        const url = new URL(request.url);

        // 1. Handle OPTIONS (CORS preflight)
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        // 2. Handle POST /update (from ESP32)
        if (request.method === "POST" && url.pathname === "/update") {
            try {
                const data = await request.json();

                if (!data.id || data.lat === undefined || data.lng === undefined) {
                    return new Response("Missing data", {
                        status: 400,
                        headers: corsHeaders
                    });
                }

                const key = `TRACKER:${data.id}`;
                const homeSet = normalizeBoolean(data.homeSet, false);
                const geoEnabled = normalizeBoolean(data.geoEnabled, false);
                const geoRadiusParsed = normalizeNumber(data.geoRadiusM);
                const geoRadiusM = Math.min(MAX_GEOFENCE_RADIUS_M, Math.max(0, geoRadiusParsed ?? 0));
                const distanceParsed = normalizeNumber(data.distanceToHomeM);
                const distanceToHomeM = distanceParsed === null ? -1 : Math.max(-1, distanceParsed);
                const insideGeofence = normalizeBoolean(data.insideGeofence, false);
                const homeLat = normalizeNumber(data.homeLat);
                const homeLng = normalizeNumber(data.homeLng);
                const value = JSON.stringify({
                    lat: data.lat,
                    lng: data.lng,
                    speed: data.speed || 0,
                    satellites: data.satellites || 0,
                    csq: data.csq || 0,
                    timestamp: Date.now(),
                    homeSet,
                    geoEnabled,
                    geoRadiusM,
                    distanceToHomeM,
                    insideGeofence,
                    ...(isValidCoordPair(homeLat, homeLng) ? { homeLat, homeLng } : {})
                });

                // Save to KV
                await env.TRACKER_KV.put(key, value);

                return new Response("OK", {
                    status: 200,
                    headers: corsHeaders
                });
            } catch (e) {
                return new Response("Error: " + e.message, {
                    status: 500,
                    headers: corsHeaders
                });
            }
        }

        // 3. Handle GET /api/location (from Web App)
        // Also support root / for simple check
        if (request.method === "GET") {
            if (url.pathname === "/api/location" || url.pathname === "/") {
                const deviceId = url.searchParams.get("deviceId") || url.searchParams.get("id");

                if (deviceId) {
                    const val = await env.TRACKER_KV.get(`TRACKER:${deviceId}`);
                    if (!val) {
                        return new Response(JSON.stringify({
                            error: "Device not found"
                        }), {
                            status: 404,
                            headers: {
                                "Content-Type": "application/json",
                                ...corsHeaders
                            }
                        });
                    }

                    // Compute age
                    const data = JSON.parse(val);
                    data.homeSet = normalizeBoolean(data.homeSet, false);
                    data.geoEnabled = normalizeBoolean(data.geoEnabled, false);
                    const geoRadiusParsed = normalizeNumber(data.geoRadiusM);
                    data.geoRadiusM = Math.min(MAX_GEOFENCE_RADIUS_M, Math.max(0, geoRadiusParsed ?? 0));
                    const distanceParsed = normalizeNumber(data.distanceToHomeM);
                    data.distanceToHomeM = distanceParsed === null ? -1 : Math.max(-1, distanceParsed);
                    data.insideGeofence = normalizeBoolean(data.insideGeofence, false);
                    const homeLat = normalizeNumber(data.homeLat);
                    const homeLng = normalizeNumber(data.homeLng);
                    if (isValidCoordPair(homeLat, homeLng)) {
                        data.homeLat = homeLat;
                        data.homeLng = homeLng;
                    } else {
                        delete data.homeLat;
                        delete data.homeLng;
                    }
                    data.ageSeconds = Math.floor((Date.now() - (data.timestamp || 0)) / 1000);

                    return new Response(JSON.stringify(data), {
                        headers: {
                            "Content-Type": "application/json",
                            ...corsHeaders
                        }
                    });
                }

                // If no ID provided
                if (url.pathname === "/api/location") {
                    return new Response("Missing deviceId", {
                        status: 400,
                        headers: corsHeaders
                    });
                }
            }
        }

        return new Response("Tracker Worker Active. Use /api/location?deviceId=...", {
            status: 200,
            headers: corsHeaders
        });
    },
};
