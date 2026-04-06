import { useEffect, useState } from "react";
import type { AppCopy } from "../../i18n";
import type { TrackerDeviceSummary } from "../../types/tracker";

type DeviceDetailsProps = {
  copy: AppCopy;
  device: TrackerDeviceSummary | null;
  loading: boolean;
  onRename: (deviceId: string, deviceName: string) => Promise<void>;
  onFetchCurrentLocation: (deviceId: string) => Promise<void>;
};

function formatCoordinate(value?: number) {
  return typeof value === "number" ? value.toFixed(6) : "—";
}

function formatDistance(value?: number) {
  if (typeof value !== "number" || value < 0) return "—";
  if (value > 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

export function DeviceDetails({
  copy,
  device,
  loading,
  onRename,
  onFetchCurrentLocation,
}: DeviceDetailsProps) {
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  useEffect(() => {
    setDraftName(device?.deviceName ?? "");
  }, [device?.deviceId, device?.deviceName]);

  if (loading) {
    return (
      <section className="panel muted">
        <span>{copy.loadingDevices}</span>
      </section>
    );
  }

  if (!device) {
    return (
      <section className="panel muted">
        <span>{copy.chooseDevice}</span>
      </section>
    );
  }

  return (
    <section className="panel">
      {/* Header */}
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">{copy.selectedDevice}</p>
          <h3 className="panel__title">{device.deviceName}</h3>
        </div>
        <span className={device.online ? "status-chip is-online" : "status-chip is-offline"}>
          {device.online ? copy.onlineNow : copy.offline}
        </span>
      </div>

      {/* Rename */}
      <div className="rename-row">
        <input
          className="text-input"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={copy.renamePlaceholder}
        />
        <button
          className="action-button"
          disabled={saving || !draftName.trim() || draftName.trim() === device.deviceName}
          onClick={async () => {
            setSaving(true);
            try { await onRename(device.deviceId, draftName); }
            finally { setSaving(false); }
          }}
          type="button"
        >
          {saving ? copy.saving : copy.save}
        </button>
      </div>

      <div className="rename-row">
        <button
          className="action-button"
          disabled={fetchingLocation}
          onClick={async () => {
            setFetchingLocation(true);
            try { await onFetchCurrentLocation(device.deviceId); }
            finally { setFetchingLocation(false); }
          }}
          type="button"
        >
          {fetchingLocation ? copy.fetchingLocation : copy.fetchCurrentLocation}
        </button>
      </div>

      {/* Stats grid */}
      <div className="detail-grid">
        <div className="detail-cell">
          <span className="detail-label">{copy.latitude}</span>
          <strong>{formatCoordinate(device.lat)}</strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.longitude}</span>
          <strong>{formatCoordinate(device.lng)}</strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.satellites}</span>
          <strong>{device.satellites ?? 0}</strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.speed}</span>
          <strong>
            {typeof device.speedKmph === "number" ? `${device.speedKmph.toFixed(1)} km/h` : "—"}
          </strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.accuracy}</span>
          <strong>
            {typeof device.locAccuracyM === "number" ? `${device.locAccuracyM.toFixed(0)} m` : "—"}
          </strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.geofence}</span>
          <strong>{device.geoEnabled ? copy.enabled : copy.disabled}</strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.distanceToHome}</span>
          <strong>{formatDistance(device.distanceToHomeM)}</strong>
        </div>
        <div className="detail-cell">
          <span className="detail-label">{copy.insideGeofence}</span>
          <strong>{device.insideGeofence ? copy.yes : copy.no}</strong>
        </div>
      </div>
    </section>
  );
}
