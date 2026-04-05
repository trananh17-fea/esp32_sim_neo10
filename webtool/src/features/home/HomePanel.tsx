import { useEffect, useState } from "react";
import type { AppCopy } from "../../i18n";
import type { TrackerDeviceSummary } from "../../types/tracker";
import { clearDeviceHome, setDeviceHome } from "../../services/api/trackerApi";

export type HomePickMode = "idle" | "picking";

type HomePanelProps = {
  copy: AppCopy;
  device: TrackerDeviceSummary | null;
  pickMode: HomePickMode;
  pendingPick: { lat: number; lng: number } | null;
  onStartPick: () => void;
  onCancelPick: () => void;
  onHomeSaved: (homeLat: number, homeLng: number, distanceToHomeM: number) => void;
  onHomeCleared: () => void;
  onDraftChange: (pos: { lat: number; lng: number } | null) => void;
};

/** Haversine distance in metres (client-side preview before server confirms) */
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

/** Compass bearing in degrees 0–360 */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function formatBearing(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${Math.round(deg)}° ${dirs[Math.round(deg / 45) % 8]}`;
}

export function HomePanel({
  copy,
  device,
  pickMode,
  pendingPick,
  onStartPick,
  onCancelPick,
  onHomeSaved,
  onHomeCleared,
  onDraftChange,
}: HomePanelProps) {
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [geoRadius, setGeoRadius] = useState("0");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "cleared" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  // When a map pick comes in, fill the inputs
  useEffect(() => {
    if (pendingPick) {
      setLatStr(pendingPick.lat.toFixed(6));
      setLngStr(pendingPick.lng.toFixed(6));
      setStatus("idle");
    }
  }, [pendingPick]);

  // Reset when device changes
  useEffect(() => {
    if (device?.homeLat !== undefined && device.homeLat !== null) {
      setLatStr(device.homeLat.toFixed(6));
      setLngStr((device.homeLng ?? 0).toFixed(6));
      setGeoRadius(String(device.geoRadiusM ?? 0));
    } else {
      setLatStr("");
      setLngStr("");
      setGeoRadius("0");
    }
    setStatus("idle");
  }, [device?.deviceId]);

  const parsedLat = parseFloat(latStr.replace(",", "."));
  const parsedLng = parseFloat(lngStr.replace(",", "."));
  const isValidCoords =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    Math.abs(parsedLat) <= 90 &&
    Math.abs(parsedLng) <= 180 &&
    !(parsedLat === 0 && parsedLng === 0);

  // Sync draft position to App map
  useEffect(() => {
    if (isValidCoords) {
      onDraftChange({ lat: parsedLat, lng: parsedLng });
    } else {
      onDraftChange(null);
    }
  }, [isValidCoords, parsedLat, parsedLng, onDraftChange]);

  if (!device) return null;

  // Preview computation (uses device's current position)
  const previewDist =
    isValidCoords && Number.isFinite(device.lat) && Number.isFinite(device.lng)
      ? haversineM(device.lat, device.lng, parsedLat, parsedLng)
      : null;

  const previewBearing =
    isValidCoords && Number.isFinite(device.lat) && Number.isFinite(device.lng)
      ? bearingDeg(device.lat, device.lng, parsedLat, parsedLng)
      : null;

  const handleUseCurrentPos = () => {
    if (Number.isFinite(device.lat) && Number.isFinite(device.lng)) {
      setLatStr(device.lat.toFixed(6));
      setLngStr(device.lng.toFixed(6));
      setStatus("idle");
    }
  };

  const handleSave = async () => {
    if (!isValidCoords) return;
    setStatus("saving");
    setErrMsg("");
    try {
      const geoR = parseFloat(geoRadius) || 0;
      const result = await setDeviceHome(
        device.deviceId,
        parsedLat,
        parsedLng,
        geoR > 0 ? geoR : undefined
      );
      onHomeSaved(result.homeLat!, result.homeLng!, result.distanceToHomeM);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Error");
      setStatus("error");
    }
  };

  const handleClear = async () => {
    setStatus("saving");
    try {
      await clearDeviceHome(device.deviceId);
      onHomeCleared();
      setLatStr("");
      setLngStr("");
      setGeoRadius("0");
      setStatus("cleared");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Error");
      setStatus("error");
    }
  };

  return (
    <section className="panel home-panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">📍 {copy.homePanel}</p>
          <h3 className="panel__title">{device.deviceName}</h3>
        </div>
        {device.homeSet && (
          <span className="home-set-badge">
            ✓ HOME
          </span>
        )}
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>{copy.homePanelDesc}</p>

      {/* Pick mode hint */}
      {pickMode === "picking" && (
        <div className="pick-hint">
          <span className="pick-hint__dot" />
          {copy.pickOnMapHint}
          <button className="pick-cancel-btn" type="button" onClick={onCancelPick}>✕</button>
        </div>
      )}

      {/* Coordinate inputs */}
      <div className="home-coords-row">
        <input
          className="text-input"
          value={latStr}
          onChange={(e) => { setLatStr(e.target.value); setStatus("idle"); }}
          placeholder={copy.latPlaceholder}
          type="text"
        />
        <input
          className="text-input"
          value={lngStr}
          onChange={(e) => { setLngStr(e.target.value); setStatus("idle"); }}
          placeholder={copy.lngPlaceholder}
          type="text"
        />
      </div>

      {/* Geofence radius */}
      <div className="home-geo-row">
        <label className="detail-label">{copy.geoRadiusLabel}</label>
        <input
          className="text-input geo-input"
          value={geoRadius}
          onChange={(e) => setGeoRadius(e.target.value)}
          placeholder={copy.geoRadiusHint}
          type="number"
          min="0"
          max="100000"
        />
      </div>

      {/* Preview — live haversine estimate */}
      {previewDist !== null && (
        <div className="home-preview">
          <div className="home-preview__item">
            <span className="detail-label">{copy.distanceLabel}</span>
            <strong className="home-preview__value">{formatDistance(previewDist)}</strong>
          </div>
          {previewBearing !== null && (
            <div className="home-preview__item">
              <span className="detail-label">{copy.bearingLabel}</span>
              <strong className="home-preview__value">{formatBearing(previewBearing)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="home-actions">
        <button
          className="home-btn home-btn--pick"
          type="button"
          onClick={pickMode === "picking" ? onCancelPick : onStartPick}
        >
          {pickMode === "picking" ? "✕ Cancel" : `🗺 ${copy.pickOnMapBtn}`}
        </button>
        <button
          className="home-btn home-btn--current"
          type="button"
          onClick={handleUseCurrentPos}
        >
          ◎ {copy.useCurrentPos}
        </button>
        <button
          className="action-button"
          type="button"
          disabled={!isValidCoords || status === "saving"}
          onClick={handleSave}
          style={{ flex: 1 }}
        >
          {status === "saving" ? copy.homeSaving : copy.setHomeBtn}
        </button>
        {device.homeSet && (
          <button
            className="home-btn home-btn--clear"
            type="button"
            disabled={status === "saving"}
            onClick={handleClear}
          >
            🗑 {copy.clearHomeBtn}
          </button>
        )}
      </div>

      {/* Feedback */}
      {status === "ok" && (
        <div className="home-feedback home-feedback--ok">{copy.homeSaved}</div>
      )}
      {status === "cleared" && (
        <div className="home-feedback home-feedback--ok">{copy.homeCleared}</div>
      )}
      {status === "error" && (
        <div className="home-feedback home-feedback--err">{errMsg || "Error"}</div>
      )}
    </section>
  );
}
