import type { AppCopy, Locale } from "../../i18n";
import { formatRelativeAge, formatTimestamp } from "../../i18n";
import type { TrackerHistoryPoint } from "../../types/tracker";

type HistoryTimelineProps = {
  copy: AppCopy;
  locale: Locale;
  points: TrackerHistoryPoint[];
  loading: boolean;
  selectedDeviceName: string | null;
};

type EnrichedPoint = TrackerHistoryPoint & {
  segmentDistanceM: number;
  segmentDurationS: number;
  segmentSpeedKmph: number;
  statusLabel: string;
  summaryLabel: string;
};

const BOOTSTRAP_HOME_LAT = 10.901146;
const BOOTSTRAP_HOME_LNG = 106.806184;
const BOOTSTRAP_EPSILON = 0.00005;

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

function formatDistance(m: number, locale: Locale): string {
  if (m <= 0) return locale === "vi" ? "0 m" : "0 m";
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function formatDuration(seconds: number, locale: Locale): string {
  if (seconds <= 0) return locale === "vi" ? "vừa xong" : "just now";
  if (seconds < 60) return locale === "vi" ? `${seconds} giây` : `${seconds}s`;
  if (seconds < 3600) return locale === "vi" ? `${Math.round(seconds / 60)} phút` : `${Math.round(seconds / 60)}m`;
  return locale === "vi"
    ? `${(seconds / 3600).toFixed(1)} giờ`
    : `${(seconds / 3600).toFixed(1)}h`;
}

function formatSource(locSource: string | undefined, copy: AppCopy): string {
  if (!locSource) return copy.unknownSource;
  const normalized = locSource.trim().toLowerCase();
  if (!normalized) return copy.unknownSource;
  if (normalized === "gps") return "GPS";
  if (normalized === "wifi" || normalized === "wifi_geo") return "WiFi";
  if (normalized === "cell" || normalized === "cell_geo" || normalized === "clbs") return "Cell";
  if (normalized === "home") return "HOME";
  return normalized.toUpperCase();
}

function isBootstrapHistoryPoint(point: TrackerHistoryPoint): boolean {
  const source = (point.locSource || "").trim().toLowerCase();
  const looksLikeBootstrapCoord =
    Math.abs(point.lat - BOOTSTRAP_HOME_LAT) <= BOOTSTRAP_EPSILON &&
    Math.abs(point.lng - BOOTSTRAP_HOME_LNG) <= BOOTSTRAP_EPSILON;
  const isSyntheticSource =
    !source ||
    source === "home" ||
    source === "none" ||
    source === "unknown";

  return looksLikeBootstrapCoord && isSyntheticSource;
}

function enrichPoints(points: TrackerHistoryPoint[], locale: Locale): EnrichedPoint[] {
  const chronological = points
    .slice()
    .filter((point) => !isBootstrapHistoryPoint(point))
    .sort((a, b) => a.timestamp - b.timestamp);

  return chronological.map((point, index) => {
    const previous = chronological[index - 1];
    const segmentDistanceM = previous
      ? haversineM(previous.lat, previous.lng, point.lat, point.lng)
      : 0;
    const segmentDurationS = previous
      ? Math.max(0, Math.round((point.timestamp - previous.timestamp) / 1000))
      : 0;
    const segmentSpeedKmph =
      segmentDurationS > 0 ? (segmentDistanceM / segmentDurationS) * 3.6 : 0;
    const effectiveSpeed = point.speedKmph ?? segmentSpeedKmph;
    const moving = effectiveSpeed >= 3 || segmentDistanceM >= 30;
    const jumpy = segmentDurationS > 0 && segmentDurationS <= 90 && segmentDistanceM >= 1500;

    let statusLabel = locale === "vi" ? "Đứng yên" : "Stopped";
    let summaryLabel = locale === "vi" ? "Không có thay đổi đáng kể" : "No major change";

    if (index === 0) {
      statusLabel = locale === "vi" ? "Mốc đầu" : "Start point";
      summaryLabel = locale === "vi" ? "Điểm đầu tiên trong khoảng lịch sử" : "First point in range";
    } else if (jumpy) {
      statusLabel = locale === "vi" ? "Bước nhảy" : "Jump";
      summaryLabel =
        locale === "vi"
          ? `Lệch ${formatDistance(segmentDistanceM, locale)} trong ${formatDuration(segmentDurationS, locale)}`
          : `${formatDistance(segmentDistanceM, locale)} jump in ${formatDuration(segmentDurationS, locale)}`;
    } else if (moving) {
      statusLabel = locale === "vi" ? "Di chuyển" : "Moving";
      summaryLabel =
        locale === "vi"
          ? `Di ${formatDistance(segmentDistanceM, locale)} trong ${formatDuration(segmentDurationS, locale)}`
          : `${formatDistance(segmentDistanceM, locale)} in ${formatDuration(segmentDurationS, locale)}`;
    } else if (segmentDurationS > 0) {
      statusLabel = locale === "vi" ? "Đứng yên" : "Stopped";
      summaryLabel =
        locale === "vi"
          ? `Dừng tại khu vực này ${formatDuration(segmentDurationS, locale)}`
          : `Stayed here for ${formatDuration(segmentDurationS, locale)}`;
    }

    return {
      ...point,
      segmentDistanceM,
      segmentDurationS,
      segmentSpeedKmph,
      statusLabel,
      summaryLabel,
    };
  }).reverse();
}

export function HistoryTimeline({
  copy,
  locale,
  points,
  loading,
  selectedDeviceName,
}: HistoryTimelineProps) {
  const enriched = enrichPoints(points, locale);
  const totalDistanceM = enriched.reduce((sum, point) => sum + point.segmentDistanceM, 0);
  const movingPoints = enriched.filter((point) => point.statusLabel === (locale === "vi" ? "Di chuyen" : "Moving")).length;
  const latestSource = enriched[0] ? formatSource(enriched[0].locSource, copy) : copy.unknownSource;

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

      {!loading && points.length > 0 && (
        <>
          <div className="history-summary">
            <div className="history-summary__card">
              <span className="history-summary__label">
                {locale === "vi" ? "Tong quang duong" : "Total distance"}
              </span>
              <strong className="history-summary__value">{formatDistance(totalDistanceM, locale)}</strong>
            </div>
            <div className="history-summary__card">
              <span className="history-summary__label">
                {locale === "vi" ? "Lan di chuyen" : "Move events"}
              </span>
              <strong className="history-summary__value">{movingPoints}</strong>
            </div>
            <div className="history-summary__card">
              <span className="history-summary__label">
                {locale === "vi" ? "Nguon fix moi nhat" : "Latest source"}
              </span>
              <strong className="history-summary__value">{latestSource}</strong>
            </div>
          </div>

          <div className="history-list">
            {enriched.map((point) => {
              const ageSeconds = Math.max(0, Math.round((Date.now() - point.timestamp) / 1000));
              const speed = point.speedKmph ?? point.segmentSpeedKmph;

              return (
                <article
                  className="history-item history-item--rich"
                  key={`${point.deviceId}-${point.timestamp}`}
                >
                  <div className="history-item__dot" />
                  <div className="history-item__body">
                    <div className="history-item__topline">
                      <strong>{formatTimestamp(point.timestamp, locale)}</strong>
                      <span className="history-item__age">
                        {formatRelativeAge(ageSeconds, locale)}
                      </span>
                    </div>

                    <div className="history-item__headline">
                      <span className="history-badge">{point.statusLabel}</span>
                      <span className="history-item__summary">{point.summaryLabel}</span>
                    </div>

                    <div className="history-meta">
                      <span className="history-meta__pill">{formatSource(point.locSource, copy)}</span>
                      <span className="history-meta__pill">
                        {copy.speed}: {speed ? `${speed.toFixed(1)} km/h` : "0 km/h"}
                      </span>
                      <span className="history-meta__pill">
                        {copy.accuracy}: {point.locAccuracyM ? formatDistance(point.locAccuracyM, locale) : "--"}
                      </span>
                      <span className="history-meta__pill">
                        {copy.satellites}: {point.satellites ?? 0}
                      </span>
                    </div>

                    <p className="history-item__coords">
                      {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
