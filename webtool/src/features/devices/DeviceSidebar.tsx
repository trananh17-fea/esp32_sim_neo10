import type { AppCopy, Locale } from "../../i18n";
import { formatRelativeAge } from "../../i18n";
import type { TrackerDeviceSummary } from "../../types/tracker";

type DeviceSidebarProps = {
  copy: AppCopy;
  devices: TrackerDeviceSummary[];
  locale: Locale;
  loading: boolean;
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
};

export function DeviceSidebar({
  copy,
  devices,
  locale,
  loading,
  selectedDeviceId,
  onSelect,
}: DeviceSidebarProps) {
  if (loading) {
    return (
      <div className="panel muted" style={{ minHeight: 72 }}>
        {copy.loadingDevices}
      </div>
    );
  }

  if (!devices.length) {
    return (
      <div className="panel muted" style={{ minHeight: 72 }}>
        {copy.noDevices}
      </div>
    );
  }

  return (
    <div className="device-list">
      {devices.map((device) => (
        <button
          key={device.deviceId}
          className={device.deviceId === selectedDeviceId ? "device-card is-selected" : "device-card"}
          onClick={() => onSelect(device.deviceId)}
          type="button"
        >
          <div className="device-card__top">
            <div style={{ minWidth: 0 }}>
              <h3>{device.deviceName}</h3>
              <p className="device-card__id">{device.deviceId}</p>
            </div>
            <span className={device.online ? "status-dot is-online" : "status-dot is-offline"}>
              {device.online ? copy.online : copy.offline}
            </span>
          </div>
          <div className="device-card__meta">
            <span>{device.locSource ?? copy.unknownSource}</span>
            <span>{formatRelativeAge(device.ageSeconds, locale)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
