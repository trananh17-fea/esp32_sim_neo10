import "leaflet/dist/leaflet.css";
import { divIcon, point } from "leaflet";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import { formatTimestamp, type Locale, type ThemeMode } from "../../i18n";
import type { TrackerDeviceSummary, TrackerHistoryPoint } from "../../types/tracker";
import type { HomePickMode } from "../home/HomePanel";

export type RouteMode = "off" | "selected" | "all";
export type MapLayerMode = "roadmap" | "satellite";
export type TrackerMapController = {
  focusSelected: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusOnCoordinates?: (lat: number, lng: number) => void;
};

type TrackerMapProps = {
  devices: TrackerDeviceSummary[];
  history: TrackerHistoryPoint[];
  homeLabel: string;
  draftPendingLabel: string;
  historyStartLabel: string;
  historyLatestLabel: string;
  locale: Locale;
  selectedDeviceIds: string[];
  deviceColorMap: Map<string, string>;
  theme: ThemeMode;
  mapLayer: MapLayerMode;
  pickMode: HomePickMode;
  routeMode: RouteMode;
  showHistory: boolean;
  draftHome: { lat: number; lng: number } | null;
  onControllerReady?: (controller: TrackerMapController | null) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onScaleChange?: (details: { label: string; width: number }) => void;
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
const BOOTSTRAP_EPSILON = 0.00005;

function isValidPair(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function isBootstrapHistoryPoint(point: TrackerHistoryPoint): boolean {
  const source = (point.locSource || "").trim().toLowerCase();
  const looksLikeBootstrapCoord =
    Math.abs(point.lat - DEFAULT_CENTER[0]) <= BOOTSTRAP_EPSILON &&
    Math.abs(point.lng - DEFAULT_CENTER[1]) <= BOOTSTRAP_EPSILON;
  const isSyntheticSource =
    !source ||
    source === "home" ||
    source === "none" ||
    source === "unknown";

  return looksLikeBootstrapCoord && isSyntheticSource;
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

function formatHistoryPointTooltip(point: TrackerHistoryPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function formatScaleLabel(distanceM: number, locale: Locale): string {
  if (distanceM >= 1000) {
    const km = (distanceM / 1000).toFixed(1).replace(/\.0$/, "");
    return `${km} km`;
  }
  return `${Math.round(distanceM)} ${locale === "vi" ? "mét" : "m"}`;
}

function computeScaleDetails(map: any, locale: Locale) {
  const size = map.getSize();
  const y = Math.round(size.y / 2);
  const left = map.containerPointToLatLng(point(16, y));
  const right = map.containerPointToLatLng(point(96, y));
  const meters = map.distance(left, right);

  const candidates = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const target = Math.max(5, meters);
  const distanceM = candidates.find((candidate) => candidate >= target * 0.6) ?? candidates[candidates.length - 1];
  const width = Math.round((distanceM / meters) * 80);

  return {
    label: formatScaleLabel(distanceM, locale),
    width: Math.max(32, Math.min(width, 120)),
  };
}

function ScaleObserver({
  locale,
  onScaleChange,
}: {
  locale: Locale;
  onScaleChange?: (details: { label: string; width: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!onScaleChange) return;

    const update = () => {
      const details = computeScaleDetails(map, locale);
      onScaleChange(details);
    };

    update();
    map.on("zoomend moveend resize", update);

    return () => {
      map.off("zoomend moveend resize", update);
    };
  }, [map, onScaleChange, locale]);

  return null;
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

function MapControllerBridge({
  center,
  onControllerReady,
}: {
  center: [number, number];
  onControllerReady?: (controller: TrackerMapController | null) => void;
}) {
  const map = useMap();
  const centerRef = useRef(center);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    if (!onControllerReady) return;

    onControllerReady({
      focusSelected: () => {
        map.flyTo(centerRef.current, Math.max(map.getZoom(), 17), { duration: 0.5 });
      },
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      focusOnCoordinates: (lat: number, lng: number) => {
        map.flyTo([lat, lng], 17, { duration: 0.5 });
      },
    });

    return () => onControllerReady(null);
  }, [map, onControllerReady]);

  return null;
}

export function TrackerMap({
  devices,
  history,
  homeLabel,
  draftPendingLabel,
  historyStartLabel,
  historyLatestLabel,
  locale,
  selectedDeviceIds,
  deviceColorMap,
  theme,
  mapLayer,
  pickMode,
  routeMode,
  showHistory,
  draftHome,
  onControllerReady,
  onMapClick,
  onScaleChange,
}: TrackerMapProps) {
  const [roadRoutes, setRoadRoutes] = useState<RoadRoute[]>([]);

  const visibleDevices = useMemo(
    () => devices.filter((d) => isValidPair(d.lat, d.lng)),
    [devices]
  );
  const selectedDeviceIdSet = useMemo(
    () => new Set(selectedDeviceIds),
    [selectedDeviceIds]
  );
  const primarySelectedId = selectedDeviceIds[0] ?? null;
  const visibleHistory = useMemo(
    () =>
      history.filter(
        (p) => isValidPair(p.lat, p.lng) && !isBootstrapHistoryPoint(p)
      ).sort((a, b) => a.timestamp - b.timestamp),
    [history]
  );
  const historyStart = visibleHistory[0] ?? null;
  const historyLatest = visibleHistory[visibleHistory.length - 1] ?? null;
  const intermediateHistory =
    visibleHistory.length > 2 ? visibleHistory.slice(1, -1) : [];
  const shouldShowHistoryStart =
    historyStart !== null &&
    historyLatest !== null &&
    historyStart !== historyLatest &&
    (Math.abs(historyStart.lat - historyLatest.lat) > BOOTSTRAP_EPSILON ||
      Math.abs(historyStart.lng - historyLatest.lng) > BOOTSTRAP_EPSILON);
  const selectedDevice =
    visibleDevices.find((d) => d.deviceId === primarySelectedId) ?? null;
  const selectedVisibleDevices = useMemo(
    () => visibleDevices.filter((device) => selectedDeviceIdSet.has(device.deviceId)),
    [selectedDeviceIdSet, visibleDevices]
  );
  const unselectedVisibleDevices = useMemo(
    () => visibleDevices.filter((device) => !selectedDeviceIdSet.has(device.deviceId)),
    [selectedDeviceIdSet, visibleDevices]
  );
  const primaryColor =
    (primarySelectedId ? deviceColorMap.get(primarySelectedId) : undefined) ?? "#2563eb";

  const center = useMemo<[number, number]>(() => {
    if (selectedVisibleDevices.length === 0) {
      return visibleDevices[0]
        ? [visibleDevices[0].lat, visibleDevices[0].lng]
        : DEFAULT_CENTER;
    }
    if (selectedVisibleDevices.length === 1) {
      return [selectedVisibleDevices[0].lat, selectedVisibleDevices[0].lng];
    }

    const avgLat =
      selectedVisibleDevices.reduce((sum, device) => sum + device.lat, 0) /
      selectedVisibleDevices.length;
    const avgLng =
      selectedVisibleDevices.reduce((sum, device) => sum + device.lng, 0) /
      selectedVisibleDevices.length;
    return [avgLat, avgLng];
  }, [selectedVisibleDevices, visibleDevices]);

  const tileConfig = useMemo(
    () =>
      mapLayer === "satellite"
        ? {
          attribution: "&copy; Esri & contributors",
          subdomains: [],
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        }
        : {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          subdomains: ["a", "b", "c", "d"],
          url:
            theme === "light"
              ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        },
    [mapLayer, theme],
  );

  const routeRequests = useMemo<RouteRequest[]>(() => {
    if (routeMode === "off") return [];

    return visibleDevices
      .filter(
        (device) =>
          isValidPair(device.homeLat, device.homeLng) &&
          device.homeSet &&
          (routeMode === "all" || selectedDeviceIdSet.has(device.deviceId))
      )
      .map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        selected: selectedDeviceIdSet.has(device.deviceId),
        startLat: device.lat,
        startLng: device.lng,
        endLat: device.homeLat!,
        endLng: device.homeLng!,
      }));
  }, [routeMode, selectedDeviceIdSet, visibleDevices]);

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
        key={`${center[0]}:${center[1]}:${theme}:${mapLayer}`}
        scrollWheelZoom
        zoom={15}
        zoomControl={false}
      >
        <TileLayer
          attribution={tileConfig.attribution}
          subdomains={tileConfig.subdomains}
          url={tileConfig.url}
        />

        <MapClickListener
          active={pickMode === "picking"}
          onMapClick={onMapClick ?? (() => { })}
        />
        <MapControllerBridge center={center} onControllerReady={onControllerReady} />
        <ScaleObserver locale={locale} onScaleChange={onScaleChange} />

        {unselectedVisibleDevices.map((device) => (
          <CircleMarker
            key={device.deviceId}
            center={[device.lat, device.lng]}
            radius={5}
            pathOptions={{
              color: "#5f6368",
              fillColor: "#9aa0a6",
              fillOpacity: 0.5,
              weight: 1.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div>
                <strong>{device.deviceName || device.deviceId}</strong>
                <div style={{ opacity: 0.7, fontSize: "0.8em" }}>{device.deviceId}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {selectedVisibleDevices.map((device) => {
          const color = deviceColorMap.get(device.deviceId) ?? "#9aa0a6";

          return (
            <CircleMarker
              key={device.deviceId}
              center={[device.lat, device.lng]}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                fillColor: color,
                fillOpacity: 0.95,
                weight: 3,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                permanent={selectedDeviceIds.length > 1}
              >
                <div>
                  <strong style={{ color }}>{device.deviceName || device.deviceId}</strong>
                  <div style={{ opacity: 0.7, fontSize: "0.8em" }}>{device.deviceId}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {showHistory && visibleHistory.length > 1 && (
          <>
            <Polyline
              positions={visibleHistory.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.88)",
                weight: 8,
                opacity: 0.95,
              }}
            />
            <Polyline
              positions={visibleHistory.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: primaryColor, weight: 4.5, opacity: 0.92 }}
            />
          </>
        )}

        {showHistory &&
          intermediateHistory.map((point) => (
            <CircleMarker
              key={`${point.deviceId}-${point.timestamp}`}
              center={[point.lat, point.lng]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                fillColor: primaryColor,
                fillOpacity: 0.96,
                weight: 2.5,
              }}
            >
              <Tooltip className="history-point-tooltip" direction="top" offset={[0, -8]}>
                <div className="history-point-tooltip__body">
                  <strong>{formatTimestamp(point.timestamp, locale)}</strong>
                  <div>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

        {showHistory && shouldShowHistoryStart && historyStart && (
          <CircleMarker
            center={[historyStart.lat, historyStart.lng]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#16a34a",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip
              className="history-point-tooltip history-point-tooltip--key"
              direction="top"
              offset={[0, -10]}
              permanent
            >
              <div className="history-point-tooltip__body">
                <span className="history-point-tooltip__tag">
                  {historyStartLabel}
                </span>
                <strong>{formatTimestamp(historyStart.timestamp, locale)}</strong>
                <div>{formatHistoryPointTooltip(historyStart)}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        )}

        {showHistory && historyLatest && (
          <CircleMarker
            center={[historyLatest.lat, historyLatest.lng]}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#ef4444",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip
              className="history-point-tooltip history-point-tooltip--key"
              direction="top"
              offset={[0, -10]}
              permanent
            >
              <div className="history-point-tooltip__body">
                <span className="history-point-tooltip__tag">
                  {historyLatestLabel}
                </span>
                <strong>{formatTimestamp(historyLatest.timestamp, locale)}</strong>
                <div>{formatHistoryPointTooltip(historyLatest)}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        )}

        {roadRoutes.map((route) => (
          <Polyline
            key={`route-${route.deviceId}`}
            positions={route.positions}
            pathOptions={{
              color: deviceColorMap.get(route.deviceId) ?? "#9aa0a6",
              weight: route.selected ? 4 : 2.5,
              opacity: route.selected ? 0.88 : 0.4,
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
                color: primaryColor,
                fillColor: primaryColor,
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
                  color: primaryColor,
                  opacity: 0.6,
                  fillColor: primaryColor,
                  fillOpacity: 0.08,
                  dashArray: "6 4",
                }}
              />
            )}
          </>
        )}

        {visibleDevices
          .filter(
            (d) =>
              d.deviceId !== primarySelectedId &&
              d.homeSet &&
              isValidPair(d.homeLat, d.homeLng)
          )
          .map((d) => {
            const isSelected = selectedDeviceIdSet.has(d.deviceId);
            const color = deviceColorMap.get(d.deviceId) ?? "#64748b";

            return (
              <CircleMarker
                key={`home-${d.deviceId}`}
                center={[d.homeLat!, d.homeLng!]}
                radius={isSelected ? 6 : 5}
                pathOptions={{
                  color: isSelected ? color : "#64748b",
                  fillColor: isSelected ? color : "#64748b",
                  fillOpacity: isSelected ? 0.72 : 0.5,
                  weight: isSelected ? 1.5 : 1,
                }}
              >
                <Tooltip direction="top">{d.deviceName || d.deviceId}</Tooltip>
              </CircleMarker>
            );
          })}

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
