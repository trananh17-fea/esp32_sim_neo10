import { useEffect, useState } from "react";
import { AppIcon } from "../../components/AppIcon";
import type { AppCopy } from "../../i18n";
import { clearDeviceHome, setDeviceHome } from "../../services/api/trackerApi";
import type { TrackerDeviceSummary } from "../../types/tracker";

export type HomePickMode = "idle" | "picking";

type HomePanelProps = {
  copy: AppCopy;
  device: TrackerDeviceSummary | null;
  onCancelPick: () => void;
  onDraftChange: (pos: { lat: number; lng: number } | null) => void;
  onHomeCleared: () => void;
  onHomeSaved: (homeLat: number, homeLng: number, distanceToHomeM: number) => void;
  onStartPick: () => void;
  pendingPick: { lat: number; lng: number } | null;
  pickMode: HomePickMode;
};

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

function formatDistance(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

function formatCoordPair(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return "Chưa đặt địa chỉ nhà";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function HomePanel({
  copy,
  device,
  onCancelPick,
  onDraftChange,
  onHomeCleared,
  onHomeSaved,
  onStartPick,
  pendingPick,
  pickMode,
}: HomePanelProps) {
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "cleared" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (pendingPick) {
      setLatStr(pendingPick.lat.toFixed(6));
      setLngStr(pendingPick.lng.toFixed(6));
      setStatus("idle");
    }
  }, [pendingPick]);

  useEffect(() => {
    if (device?.homeLat !== undefined && device.homeLat !== null) {
      setLatStr(device.homeLat.toFixed(6));
      setLngStr((device.homeLng ?? 0).toFixed(6));
    } else {
      setLatStr("");
      setLngStr("");
    }

    setStatus("idle");
    setErrMsg("");
  }, [device?.deviceId]);

  const parsedLat = parseFloat(latStr.replace(",", "."));
  const parsedLng = parseFloat(lngStr.replace(",", "."));
  const isValidCoords =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    Math.abs(parsedLat) <= 90 &&
    Math.abs(parsedLng) <= 180 &&
    !(parsedLat === 0 && parsedLng === 0);

  useEffect(() => {
    if (isValidCoords) {
      onDraftChange({ lat: parsedLat, lng: parsedLng });
    } else {
      onDraftChange(null);
    }
  }, [isValidCoords, onDraftChange, parsedLat, parsedLng]);

  if (!device) {
    return <div className="place-sheet__empty">{copy.chooseDevice}</div>;
  }

  const previewDistance =
    isValidCoords && Number.isFinite(device.lat) && Number.isFinite(device.lng)
      ? haversineM(device.lat, device.lng, parsedLat, parsedLng)
      : null;

  const selectedAddress = isValidCoords
    ? formatCoordPair(parsedLat, parsedLng)
    : formatCoordPair(device.homeLat, device.homeLng);

  const handleUseCurrentPos = () => {
    setLatStr(device.lat.toFixed(6));
    setLngStr(device.lng.toFixed(6));
    setStatus("idle");
  };

  const handleSave = async () => {
    if (!isValidCoords) return;

    try {
      setStatus("saving");
      setErrMsg("");
      const result = await setDeviceHome(device, parsedLat, parsedLng, undefined);
      onHomeSaved(result.homeLat!, result.homeLng!, result.distanceToHomeM);
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrMsg(err instanceof Error ? err.message : "Failed to save home");
    }
  };

  const handleClear = async () => {
    try {
      setStatus("saving");
      setErrMsg("");
      await clearDeviceHome(device);
      onHomeCleared();
      setLatStr("");
      setLngStr("");
      setStatus("cleared");
    } catch (err) {
      setStatus("error");
      setErrMsg(err instanceof Error ? err.message : "Failed to clear home");
    }
  };

  return (
    <div className="place-pane">
      <div className="maps-home-card">
        <div className="maps-home-card__icon">
          <AppIcon name="home" size={18} />
        </div>
        <div className="maps-home-card__body">
          <p className="maps-home-card__eyebrow">Nhà riêng</p>
          <strong className="maps-home-card__title">
            {device.homeSet ? "Đã lưu địa chỉ nhà" : "Chưa đặt địa chỉ nhà"}
          </strong>
          <p className="maps-home-card__address">{selectedAddress}</p>
        </div>
      </div>

      {pickMode === "picking" ? (
        <div className="maps-inline-alert">
          <AppIcon name="location" size={15} />
          <span>{copy.pickOnMapHint}</span>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="maps-inline-alert maps-inline-alert--error">{errMsg}</div>
      ) : null}

      {status === "ok" ? (
        <div className="maps-inline-alert maps-inline-alert--success">{copy.homeSaved}</div>
      ) : null}

      {status === "cleared" ? (
        <div className="maps-inline-alert maps-inline-alert--success">{copy.homeCleared}</div>
      ) : null}

      <div className="place-detail-grid">
        <div className="place-detail-row">
          <span>Khoảng cách từ thiết bị</span>
          <strong>{formatDistance(previewDistance ?? device.distanceToHomeM ?? null)}</strong>
        </div>
      </div>

      <div className="maps-home-actions">
        <button
          className="maps-home-action maps-home-action--primary"
          onClick={pickMode === "picking" ? onCancelPick : onStartPick}
          type="button"
        >
          <AppIcon name="location" size={16} />
          <span>{pickMode === "picking" ? "Hủy chọn trên bản đồ" : "Chọn trên bản đồ"}</span>
        </button>
        <button className="maps-home-action" onClick={handleUseCurrentPos} type="button">
          <AppIcon name="refresh" size={16} />
          <span>{copy.useCurrentPos}</span>
        </button>
        <button
          className="maps-home-action"
          disabled={!isValidCoords || status === "saving"}
          onClick={handleSave}
          type="button"
        >
          <AppIcon name="saved" size={16} />
          <span>{status === "saving" ? copy.homeSaving : "Lưu nhà riêng"}</span>
        </button>
        {device.homeSet ? (
          <button
            className="maps-home-action"
            disabled={status === "saving"}
            onClick={handleClear}
            type="button"
          >
            <AppIcon name="close" size={16} />
            <span>{copy.clearHomeBtn}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
