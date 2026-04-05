import type { AppCopy, Locale } from "../../i18n";
import { formatTimestamp } from "../../i18n";
import type { TrackerHistoryPoint } from "../../types/tracker";

type HistoryTimelineProps = {
  copy: AppCopy;
  locale: Locale;
  points: TrackerHistoryPoint[];
  loading: boolean;
  selectedDeviceName: string | null;
};

export function HistoryTimeline({
  copy,
  locale,
  points,
  loading,
  selectedDeviceName,
}: HistoryTimelineProps) {
  return (
    <section className="panel history-panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">{copy.movementHistory}</p>
          <h3 className="panel__title">{selectedDeviceName ?? copy.noDeviceSelected}</h3>
        </div>
        <span className="history-count">
          {points.length} {copy.pointsLabel}
        </span>
      </div>

      {loading && <p className="muted">{copy.loadingHistory}</p>}
      {!loading && !points.length && (
        <p className="muted">{copy.noHistory}</p>
      )}

      <div className="history-list">
        {points
          .slice()
          .reverse()
          .map((point) => (
            <div
              className="history-item"
              key={`${point.deviceId}-${point.timestamp}`}
            >
              <div className="history-item__dot" />
              <div>
                <strong>{formatTimestamp(point.timestamp, locale)}</strong>
                <p>
                  {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                </p>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
