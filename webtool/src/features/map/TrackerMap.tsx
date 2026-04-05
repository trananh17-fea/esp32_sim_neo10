import "leaflet/dist/leaflet.css";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import type { ThemeMode } from "../../i18n";
import type { TrackerDeviceSummary, TrackerHistoryPoint } from "../../types/tracker";

type TrackerMapProps = {
  devices: TrackerDeviceSummary[];
  history: TrackerHistoryPoint[];
  homeLabel: string;
  selectedDeviceId: string | null;
  theme: ThemeMode;
};

const DEFAULT_CENTER: [number, number] = [10.901146, 106.806184];

function isValidPair(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function TrackerMap({
  devices,
  history,
  homeLabel,
  selectedDeviceId,
  theme,
}: TrackerMapProps) {
  const visibleDevices = devices.filter((device) => isValidPair(device.lat, device.lng));
  const visibleHistory = history.filter((point) => isValidPair(point.lat, point.lng));
  const selectedDevice = visibleDevices.find((device) => device.deviceId === selectedDeviceId) ?? null;
  const center: [number, number] = selectedDevice
    ? [selectedDevice.lat, selectedDevice.lng]
    : visibleDevices[0]
      ? [visibleDevices[0].lat, visibleDevices[0].lng]
      : DEFAULT_CENTER;
  const tileUrl =
    theme === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <section className="map-panel">
      <MapContainer
        center={center}
        className="map-canvas"
        key={`${center[0]}:${center[1]}:${theme}`}
        scrollWheelZoom
        zoom={15}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          subdomains={["a", "b", "c", "d"]}
          url={tileUrl}
        />

        {visibleDevices.map((device) => (
          <CircleMarker
            key={device.deviceId}
            center={[device.lat, device.lng]}
            radius={device.deviceId === selectedDeviceId ? 11 : 8}
            pathOptions={{
              color: device.online ? "#00c8ff" : "#f97316",
              fillColor: device.deviceId === selectedDeviceId ? "#6366f1" : "#00b4ff",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div>
                <strong>{device.deviceName}</strong>
                <div>{device.deviceId}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {visibleHistory.length > 1 ? (
          <Polyline
            positions={visibleHistory.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: "#6366f1", weight: 4, opacity: 0.8 }}
          />
        ) : null}

        {visibleHistory.map((point) => (
          <CircleMarker
            key={`${point.deviceId}-${point.timestamp}`}
            center={[point.lat, point.lng]}
            radius={4}
            pathOptions={{
              color: "#818cf8",
              fillColor: "#818cf8",
              fillOpacity: 0.65,
              weight: 1,
            }}
          />
        ))}

        {selectedDevice?.homeSet &&
        typeof selectedDevice.homeLat === "number" &&
        typeof selectedDevice.homeLng === "number" ? (
          <>
            <CircleMarker
              center={[selectedDevice.homeLat, selectedDevice.homeLng]}
              radius={7}
              pathOptions={{
                color: "#38bdf8",
                fillColor: "#38bdf8",
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Tooltip direction="top">{homeLabel}</Tooltip>
            </CircleMarker>
            {selectedDevice.geoEnabled && selectedDevice.geoRadiusM ? (
              <Circle
                center={[selectedDevice.homeLat, selectedDevice.homeLng]}
                radius={selectedDevice.geoRadiusM}
                pathOptions={{
                  color: "#38bdf8",
                  opacity: 0.7,
                  fillColor: "#38bdf8",
                  fillOpacity: 0.08,
                }}
              />
            ) : null}
          </>
        ) : null}
      </MapContainer>
    </section>
  );
}
