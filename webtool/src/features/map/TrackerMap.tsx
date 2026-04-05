import "leaflet/dist/leaflet.css";
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
import { divIcon } from "leaflet";
import type { ThemeMode } from "../../i18n";
import type { TrackerDeviceSummary, TrackerHistoryPoint } from "../../types/tracker";
import type { HomePickMode } from "../home/HomePanel";

export type RouteMode = "off" | "selected" | "all";

type TrackerMapProps = {
  devices: TrackerDeviceSummary[];
  history: TrackerHistoryPoint[];
  homeLabel: string;
  selectedDeviceId: string | null;
  theme: ThemeMode;
  pickMode: HomePickMode;
  routeMode: RouteMode;
  showHistory: boolean;
  draftHome: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
};

const draftIcon = divIcon({
  html: '<div style="font-size: 32px; filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.6)); line-height: 1; transform: translate(-50%, -100%);">📍</div>',
  className: "draft-pin",
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const DEFAULT_CENTER: [number, number] = [10.901146, 106.806184];

function isValidPair(lat?: number | null, lng?: number | null): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

/** Invisible component that listens for map clicks during pick mode */
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
  selectedDeviceId,
  theme,
  pickMode,
  routeMode,
  showHistory,
  draftHome,
  onMapClick,
}: TrackerMapProps) {
  const visibleDevices = devices.filter(
    (d) => isValidPair(d.lat, d.lng)
  );
  const visibleHistory = history.filter(
    (p) => isValidPair(p.lat, p.lng)
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

  // Route-to-home lines
  const visibleRoutes = visibleDevices.filter(d => 
    d.homeSet && isValidPair(d.homeLat, d.homeLng) && 
    (routeMode === "all" || (routeMode === "selected" && d.deviceId === selectedDeviceId))
  );

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

        {/* Map click handler for home picking */}
        <MapClickListener
          active={pickMode === "picking"}
          onMapClick={onMapClick ?? (() => {})}
        />

        {/* Device markers */}
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

        {/* History trail (only when showHistory is true) */}
        {showHistory && visibleHistory.length > 1 && (
          <Polyline
            positions={visibleHistory.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: "#6366f1", weight: 3.5, opacity: 0.75, dashArray: undefined }}
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

        {/* Route-to-home lines (dashed) */}
        {visibleRoutes.map((d) => (
          <Polyline
            key={`route-${d.deviceId}`}
            positions={[
              [d.lat, d.lng],
              [d.homeLat!, d.homeLng!],
            ]}
            pathOptions={{
              color: d.deviceId === selectedDeviceId ? "#facc15" : "#94a3b8",
              weight: d.deviceId === selectedDeviceId ? 2.5 : 1.5,
              opacity: d.deviceId === selectedDeviceId ? 0.9 : 0.6,
              dashArray: d.deviceId === selectedDeviceId ? "8 6" : "4 4",
            }}
          />
        ))}

        {/* Home marker + geofence circle for selected device */}
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
              <Tooltip direction="top" permanent={false}>
                🏠 {homeLabel}
              </Tooltip>
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

        {/* All other devices' home markers (faint) */}
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
              <Tooltip direction="top">🏠 {d.deviceName}</Tooltip>
            </CircleMarker>
          ))}

        {/* Draft pick home marker */}
        {draftHome && (
          <Marker position={[draftHome.lat, draftHome.lng]} icon={draftIcon}>
            <Tooltip direction="top" permanent>
              {homeLabel} (Chờ lưu)
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </section>
  );
}
