import { useEffect, useState } from "react";
import type { AppCopy } from "../../i18n";
import type { TrackerDeviceSummary } from "../../types/tracker";
import { AppIcon } from "../../components/AppIcon";

type DeviceDetailsProps = {
  copy: AppCopy;
  device: TrackerDeviceSummary | null;
  loading: boolean;
  onFetchCurrentLocation: (deviceId: string) => Promise<void>;
  onRename: (deviceId: string, deviceName: string) => Promise<void>;
};

function formatCoordinate(value?: number) {
  return typeof value === "number" ? value.toFixed(6) : "--";
}

function formatDistance(value?: number) {
  if (typeof value !== "number" || value < 0) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

export function DeviceDetails({
  copy,
  device,
  loading,
  onFetchCurrentLocation,
  onRename,
}: DeviceDetailsProps) {
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setDraftName(device?.deviceName ?? "");
  }, [device?.deviceId, device?.deviceName]);

  if (loading) {
    return <div className="place-sheet__empty">{copy.loadingDevices}</div>;
  }

  if (!device) {
    return <div className="place-sheet__empty">{copy.chooseDevice}</div>;
  }

  return (
    <div className="place-pane">
      <div className="place-summary-card">
        <div className="place-summary-card__main">
          <p className="place-summary-card__label">{copy.selectedDevice}</p>
          <strong className="place-summary-card__value">{device.deviceId}</strong>
        </div>
        <span className={`maps-status-pill ${device.online ? "is-online" : "is-offline"}`}>
          <span className="maps-status-pill__dot" />
        </span>
      </div>

      <div className="place-action-row">
        <button
          className="maps-action-button maps-action-button--primary"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            try {
              await onFetchCurrentLocation(device.deviceId);
            } finally {
              setRefreshing(false);
            }
          }}
          type="button"
        >
          <AppIcon name="refresh" size={16} />
          <span style={{ fontSize: 14 }}>{refreshing ? copy.fetchingLocation : copy.fetchCurrentLocation}</span>
        </button>
      </div>

      <label className="maps-field">
        <span>{copy.renamePlaceholder}</span>
        <div className="maps-rename-row">
          <input
            className="maps-text-input"
            onChange={(event) => setDraftName(event.target.value)}
            placeholder={copy.renamePlaceholder}
            value={draftName}
          />
          <button
            className="maps-action-button"
            disabled={saving || !draftName.trim() || draftName.trim() === device.deviceName}
            onClick={async () => {
              setSaving(true);
              try {
                await onRename(device.deviceId, draftName.trim());
              } finally {
                setSaving(false);
              }
            }}
            type="button"
          >
            <AppIcon name="edit" size={16} />
            <span>{saving ? copy.saving : copy.save}</span>
          </button>
        </div>
      </label>

      <div className="place-detail-grid">
        <div className="place-detail-row">
          <span className="place-metric__label">
            <AppIcon name="accuracy" size={15} />
            {copy.accuracy}
          </span>
          <strong>{formatDistance(device.locAccuracyM)}</strong>
        </div>
        <div className="place-detail-row">
          <span style={{ fontSize: '14px' }}>{copy.latitude}</span>
          <strong>{formatCoordinate(device.lat)}</strong>
        </div>
        <div className="place-detail-row">
          <span style={{ fontSize: '14px' }}  >{copy.longitude}</span>
          <strong>{formatCoordinate(device.lng)}</strong>
        </div>
        <div className="place-detail-row">
          <span className="place-metric__label">
            <AppIcon name="home" size={15} />
            {copy.distanceToHome}
          </span>
          <strong>{formatDistance(device.distanceToHomeM)}</strong>
        </div>
      </div>
    </div>
  );
}
