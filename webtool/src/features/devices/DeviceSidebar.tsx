import { formatRelativeAge } from "../../i18n";
import type { AppCopy, Locale } from "../../i18n";
import type { TrackerDeviceSummary } from "../../types/tracker";

type DeviceSidebarProps = {
  copy: AppCopy;
  devices: TrackerDeviceSummary[];
  locale: Locale;
  loading: boolean;
  onSelect: (deviceId: string) => void;
  selectedDeviceId: string | null;
};

function getPromptTitle(index: number) {
  const labels = ["Thành phố Hồ...", "Sông Gianh", "Bãi biển Xuân Yên"];
  return labels[index % labels.length];
}

export function DeviceSidebar({
  copy,
  devices,
  locale,
  loading,
  onSelect,
  selectedDeviceId,
}: DeviceSidebarProps) {
  if (loading) {
    return <div className="maps-sidebar__empty">{copy.loadingDevices}</div>;
  }

  if (!devices.length) {
    return <div className="maps-sidebar__empty">{copy.noDevices}</div>;
  }

  return (
    <div className="recent-list">
      {devices.map((device, index) => {
        const active = device.deviceId === selectedDeviceId;

        return (
          <button
            key={device.deviceId}
            className={`recent-card ${active ? "is-active" : ""}`}
            onClick={() => onSelect(device.deviceId)}
            type="button"
          >
            <span className={`recent-card__thumb recent-card__thumb--${(index % 3) + 1}`} />
            <span className="recent-card__body">
              <strong className="recent-card__title">{getPromptTitle(index)}</strong>
              <span className="recent-card__meta">
                {device.deviceName || device.locSource || copy.unknownSource}
              </span>
              <span className="recent-card__meta">
                {formatRelativeAge(device.ageSeconds, locale)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
