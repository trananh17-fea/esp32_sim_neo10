import { AppIcon } from "../../components/AppIcon";
import type { AppCopy, Locale } from "../../i18n";
import { formatRelativeAge, formatTimestamp } from "../../i18n";
import type { TrackerHistoryPoint } from "../../types/tracker";

type HistoryTimelineProps = {
  copy: AppCopy;
  loading: boolean;
  locale: Locale;
  points: TrackerHistoryPoint[];
  selectedDeviceName: string | null;
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

function formatDistance(distanceM: number) {
  if (distanceM >= 1000) return `${(distanceM / 1000).toFixed(2)} km`;
  return `${Math.round(distanceM)} m`;
}

export function HistoryTimeline({
  copy,
  loading,
  locale,
  points,
  selectedDeviceName,
}: HistoryTimelineProps) {
  if (loading) {
    return <div className="place-sheet__empty">{copy.loadingHistory}</div>;
  }

  if (!points.length) {
    return <div className="place-sheet__empty">{copy.noHistory}</div>;
  }

  const ordered = points.slice().sort((a, b) => b.timestamp - a.timestamp);
  const totalDistance = ordered.reduce((sum, point, index) => {
    const next = ordered[index + 1];
    if (!next) return sum;
    return sum + haversineM(point.lat, point.lng, next.lat, next.lng);
  }, 0);

  return (
    <div className="place-pane">
      <div className="place-metrics place-metrics--compact">
        <div className="place-metric">
          <span className="place-metric__label">
            <AppIcon name="route" size={15} />
            Distance
          </span>
          <strong>{formatDistance(totalDistance)}</strong>
        </div>
        <div className="place-metric">
          <span className="place-metric__label">
            <AppIcon name="history" size={15} />
            Events
          </span>
          <strong>{points.length}</strong>
        </div>
      </div>

      <div className="maps-timeline">
        {ordered.map((point) => {
          const ageSeconds = Math.max(0, Math.round((Date.now() - point.timestamp) / 1000));

          return (
            <article className="maps-timeline__item" key={`${point.deviceId}-${point.timestamp}`}>
              <span className="maps-timeline__dot" />
              <div className="maps-timeline__content">
                <div className="maps-timeline__top">
                  <strong>{formatTimestamp(point.timestamp, locale)}</strong>
                  <span>{formatRelativeAge(ageSeconds, locale)}</span>
                </div>
                <p className="maps-timeline__coords">
                  {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
