import "leaflet/dist/leaflet.css";
import { divIcon } from "leaflet";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useMapEvents } from "react-leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import type { ThemeMode } from "../../i18n";
import type { TrackerDeviceSummary, TrackerHistoryPoint } from "../../types/tracker";
import type { HomePickMode } from "../home/HomePanel";

export type RouteMode = "off" | "selected" | "all";

type TrackerMapProps = {
  devices: TrackerDeviceSummary[];
  history: TrackerHistoryPoint[];
  homeLabel: string;
  draftPendingLabel: string;
  selectedDeviceId: string | null;
  theme: ThemeMode;
  pickMode: HomePickMode;
  routeMode: RouteMode;
  showHistory: boolean;
  draftHome: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
};

type RouteRequest = {
  deviceId: string;
  deviceName: string;
  selected: boolean;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

type RoadRoute = {
  deviceId: string;
  deviceName: string;
  selected: boolean;
  positions: [number, number][];
  distanceM: number;
  durationS: number;
  source: "osrm" | "fallback";
};

type CachedRoute = {
  positions: [number, number][];
  distanceM: number;
  durationS: number;
  source: "osrm" | "fallback";
};

const draftIcon = divIcon({
  html: '<div class="draft-pin__glyph">&#128205;</div>',
  className: "draft-pin",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  tooltipAnchor: [0, -28],
});

const DEFAULT_CENTER: [number, number] = [10.901146, 106.806184];
const OSRM_BASE = "https://router.project-osrm.org";
const MAX_ROUTE_CONCURRENCY = 2;
const MAX_ROUTE_POINTS = 120;
const roadRouteCache = new Map<string, CachedRoute>();

function isValidPair(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

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

function formatDistance(distanceM: number): string {
  if (distanceM >= 1000) return `${(distanceM / 1000).toFixed(2)} km`;
  return `${Math.round(distanceM)} m`;
}

function formatDuration(durationS: number): string {
  if (durationS < 60) return `${Math.max(1, Math.round(durationS))} s`;
  if (durationS < 3600) return `${Math.round(durationS / 60)} min`;
  return `${(durationS / 3600).toFixed(1)} h`;
}

function downsamplePositions(
  positions: [number, number][],
  maxPoints = MAX_ROUTE_POINTS
): [number, number][] {
  if (positions.length <= maxPoints) return positions;

  const sampled: [number, number][] = [];
  const lastIndex = positions.length - 1;

  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i / (maxPoints - 1)) * lastIndex);
    sampled.push(positions[index]);
  }

  return sampled;
}

function buildRouteKey(request: RouteRequest): string {
  return [
    request.deviceId,
    request.startLat.toFixed(6),
    request.startLng.toFixed(6),
    request.endLat.toFixed(6),
    request.endLng.toFixed(6),
  ].join(":");
}

function fallbackRoute(request: RouteRequest): CachedRoute {
  return {
    positions: [
      [request.startLat, request.startLng],
      [request.endLat, request.endLng],
    ],
    distanceM: haversineM(
      request.startLat,
      request.startLng,
      request.endLat,
      request.endLng
    ),
    durationS: 0,
    source: "fallback",
  };
}

async function fetchRoadRoute(
  request: RouteRequest,
  signal: AbortSignal
): Promise<CachedRoute> {
  const key = buildRouteKey(request);
  const cached = roadRouteCache.get(key);
  if (cached) return cached;

  const url =
    `${OSRM_BASE}/route/v1/driving/` +
    `${request.startLng},${request.startLat};${request.endLng},${request.endLat}` +
    `?overview=simplified&geometries=geojson&steps=false&alternatives=false`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`OSRM ${response.status}`);

    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };

    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !route || !coords || coords.length < 2) {
      throw new Error(data.code || "NoRoute");
    }

    const mapped: CachedRoute = {
      positions: downsamplePositions(coords.map(([lng, lat]) => [lat, lng])),
      distanceM: route.distance ?? 0,
      durationS: route.duration ?? 0,
      source: "osrm",
    };
    roadRouteCache.set(key, mapped);
    return mapped;
  } catch {
    const fallback = fallbackRoute(request);
    roadRouteCache.set(key, fallback);
    return fallback;
  }
}

function MapClickListener({
  active,
  onMapClick,
}: {
  active: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function TrackerMap({
  devices,
  history,
  homeLabel,
  draftPendingLabel,
  selectedDeviceId,
  theme,
  pickMode,
  routeMode,
  showHistory,
  draftHome,
  onMapClick,
}: TrackerMapProps) {
  const [roadRoutes, setRoadRoutes] = useState<RoadRoute[]>([]);

  const visibleDevices = useMemo(
    () => devices.filter((d) => isValidPair(d.lat, d.lng)),
    [devices]
  );
  const visibleHistory = useMemo(
    () => history.filter((p) => isValidPair(p.lat, p.lng)),
    [history]
  );
  const selectedDevice =
    visibleDevices.find((d) => d.deviceId === selectedDeviceId) ?? null;

  const center: [number, number] = selectedDevice
    ? [selectedDevice.lat, selectedDevice.lng]
    : visibleDevices[0]
      ? [visibleDevices[0].lat, visibleDevices[0].lng]
      : DEFAULT_CENTER;

  const tileUrl =
    theme === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  const routeRequests = useMemo<RouteRequest[]>(() => {
    if (routeMode === "off") return [];

    return visibleDevices
      .filter(
        (device) =>
          isValidPair(device.homeLat, device.homeLng) &&
          device.homeSet &&
          (routeMode === "all" || device.deviceId === selectedDeviceId)
      )
      .map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        selected: device.deviceId === selectedDeviceId,
        startLat: device.lat,
        startLng: device.lng,
        endLat: device.homeLat!,
        endLng: device.homeLng!,
      }));
  }, [routeMode, selectedDeviceId, visibleDevices]);

  const routeRequestKey = useMemo(
    () => routeRequests.map(buildRouteKey).join("|"),
    [routeRequests]
  );

  useEffect(() => {
    if (!routeRequests.length) {
      setRoadRoutes([]);
      return;
    }

    const controller = new AbortController();
    const loadRoutes = async () => {
      const routes: RoadRoute[] = [];

      for (let i = 0; i < routeRequests.length; i += MAX_ROUTE_CONCURRENCY) {
        const chunk = routeRequests.slice(i, i + MAX_ROUTE_CONCURRENCY);
        const chunkRoutes = await Promise.all(
          chunk.map(async (request) => {
            const route = await fetchRoadRoute(request, controller.signal);
            return {
              deviceId: request.deviceId,
              deviceName: request.deviceName,
              selected: request.selected,
              ...route,
            } satisfies RoadRoute;
          })
        );

        if (controller.signal.aborted) return;
        routes.push(...chunkRoutes);
      }

      if (!controller.signal.aborted) {
        startTransition(() => {
          setRoadRoutes(routes);
        });
      }
    };

    loadRoutes().catch(() => {
      if (!controller.signal.aborted) {
        startTransition(() => {
          setRoadRoutes([]);
        });
      }
    });

    return () => controller.abort();
  }, [routeRequestKey, routeRequests]);

  return (
    <section
      className="map-panel"
      style={{ cursor: pickMode === "picking" ? "crosshair" : undefined }}
    >
      <MapContainer
        center={center}
        className="map-canvas"
        key={`${center[0]}:${center[1]}:${theme}`}
        scrollWheelZoom
        zoom={15}
        zoomControl
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          subdomains={["a", "b", "c", "d"]}
          url={tileUrl}
        />

        <MapClickListener
          active={pickMode === "picking"}
          onMapClick={onMapClick ?? (() => {})}
        />

        {visibleDevices.map((device) => (
          <CircleMarker
            key={device.deviceId}
            center={[device.lat, device.lng]}
            radius={device.deviceId === selectedDeviceId ? 12 : 8}
            pathOptions={{
              color: device.online ? "#00c8ff" : "#f97316",
              fillColor: device.deviceId === selectedDeviceId ? "#6366f1" : "#00b4ff",
              fillOpacity: 0.92,
              weight: 2.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div>
                <strong>{device.deviceName}</strong>
                <div style={{ opacity: 0.7, fontSize: "0.8em" }}>{device.deviceId}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {showHistory && visibleHistory.length > 1 && (
          <Polyline
            positions={visibleHistory.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#6366f1", weight: 3.5, opacity: 0.75 }}
          />
        )}

        {showHistory &&
          visibleHistory.map((point) => (
            <CircleMarker
              key={`${point.deviceId}-${point.timestamp}`}
              center={[point.lat, point.lng]}
              radius={3.5}
              pathOptions={{
                color: "#818cf8",
                fillColor: "#818cf8",
                fillOpacity: 0.6,
                weight: 1,
              }}
            />
          ))}

        {roadRoutes.map((route) => (
          <Polyline
            key={`route-${route.deviceId}`}
            positions={route.positions}
            pathOptions={{
              color: route.selected ? "#facc15" : "#94a3b8",
              weight: route.selected ? 4 : 2.5,
              opacity: route.selected ? 0.95 : 0.72,
              dashArray: route.source === "fallback" ? "8 6" : undefined,
            }}
          >
            <Tooltip direction="top" sticky>
              <div>
                <strong>{route.deviceName}</strong>
                <div>{formatDistance(route.distanceM)}</div>
                <div>{route.durationS > 0 ? formatDuration(route.durationS) : "Fallback line"}</div>
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {selectedDevice?.homeSet && isValidPair(selectedDevice.homeLat, selectedDevice.homeLng) && (
          <>
            <CircleMarker
              center={[selectedDevice.homeLat!, selectedDevice.homeLng!]}
              radius={9}
              pathOptions={{
                color: "#38bdf8",
                fillColor: "#0ea5e9",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip direction="top">{homeLabel}</Tooltip>
            </CircleMarker>

            {selectedDevice.geoEnabled && (selectedDevice.geoRadiusM ?? 0) > 0 && (
              <Circle
                center={[selectedDevice.homeLat!, selectedDevice.homeLng!]}
                radius={selectedDevice.geoRadiusM!}
                pathOptions={{
                  color: "#38bdf8",
                  opacity: 0.6,
                  fillColor: "#38bdf8",
                  fillOpacity: 0.07,
                  dashArray: "6 4",
                }}
              />
            )}
          </>
        )}

        {visibleDevices
          .filter(
            (d) =>
              d.deviceId !== selectedDeviceId &&
              d.homeSet &&
              isValidPair(d.homeLat, d.homeLng)
          )
          .map((d) => (
            <CircleMarker
              key={`home-${d.deviceId}`}
              center={[d.homeLat!, d.homeLng!]}
              radius={5}
              pathOptions={{
                color: "#64748b",
                fillColor: "#64748b",
                fillOpacity: 0.5,
                weight: 1,
              }}
            >
              <Tooltip direction="top">{d.deviceName}</Tooltip>
            </CircleMarker>
          ))}

        {draftHome && (
          <Marker position={[draftHome.lat, draftHome.lng]} icon={draftIcon} zIndexOffset={1000}>
            <Tooltip
              direction="top"
              permanent
              offset={[0, -28]}
              className="draft-home-tooltip"
            >
              {homeLabel} ({draftPendingLabel})
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </section>
  );
}
