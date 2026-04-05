import { useEffect, useMemo, useState } from "react";
import { DeviceDetails } from "../features/devices/DeviceDetails";
import { DeviceSidebar } from "../features/devices/DeviceSidebar";
import { HistoryTimeline } from "../features/history/HistoryTimeline";
import { TrackerMap } from "../features/map/TrackerMap";
import {
  formatTimestamp,
  translations,
  type Locale,
  type ThemeMode,
} from "../i18n";
import {
  fetchDevices,
  fetchHistory,
  renameDevice,
} from "../services/api/trackerApi";
import type {
  HistoryRange,
  TrackerDeviceSummary,
  TrackerHistoryPoint,
} from "../types/tracker";

const REFRESH_INTERVAL_MS = 60000;

const rangeOptions: HistoryRange[] = ["30m", "6h", "24h", "7d"];
const STORAGE_KEYS = {
  locale: "neo10-webtool-locale",
  theme: "neo10-webtool-theme",
} as const;

function getInitialLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEYS.locale);
  if (saved === "en" || saved === "vi") return saved;
  return window.navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

function getInitialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function App() {
  const [devices, setDevices] = useState<TrackerDeviceSummary[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("24h");
  const [history, setHistory] = useState<TrackerHistoryPoint[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const copy = translations[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    window.localStorage.setItem(STORAGE_KEYS.locale, locale);
  }, [locale, theme]);

  useEffect(() => {
    let cancelled = false;

    const loadDevices = async () => {
      try {
        if (!cancelled) setLoadingDevices(true);
        const nextDevices = await fetchDevices();
        if (cancelled) return;

        setDevices(nextDevices);
        setLastUpdatedAt(Date.now());
        setSelectedDeviceId((current) => {
          if (current && nextDevices.some((device) => device.deviceId === current)) {
            return current;
          }
          return nextDevices[0]?.deviceId ?? null;
        });
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : locale === "vi"
                ? "Không tải được danh sách thiết bị."
                : "Failed to load devices."
          );
        }
      } finally {
        if (!cancelled) setLoadingDevices(false);
      }
    };

    loadDevices();
    const timer = window.setInterval(loadDevices, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [locale]);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  );

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (!selectedDeviceId) {
        setHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);
        const points = await fetchHistory(selectedDeviceId, historyRange);
        if (!cancelled) setHistory(points);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : locale === "vi"
                ? "Không tải được lịch sử."
                : "Failed to load history."
          );
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [locale, selectedDeviceId, historyRange]);

  const handleRename = async (deviceId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;

    const updatedName = await renameDevice(deviceId, trimmed);
    setDevices((current) =>
      current.map((device) =>
        device.deviceId === deviceId ? { ...device, deviceName: updatedName } : device
      )
    );
  };

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="brand">
          <p className="eyebrow">{copy.appEyebrow}</p>
          <h1>{copy.appTitle}</h1>
          <p className="muted">{copy.appDescription}</p>
        </div>

        <div className="panel control-panel">
          <div className="control-group">
            <span className="detail-label">{copy.languageLabel}</span>
            <div className="toggle-group">
              <button
                className={locale === "en" ? "toggle-button is-active" : "toggle-button"}
                onClick={() => setLocale("en")}
                type="button"
              >
                {copy.englishLabel}
              </button>
              <button
                className={locale === "vi" ? "toggle-button is-active" : "toggle-button"}
                onClick={() => setLocale("vi")}
                type="button"
              >
                {copy.vietnameseLabel}
              </button>
            </div>
          </div>

          <div className="control-group">
            <span className="detail-label">{copy.themeLabel}</span>
            <div className="toggle-group">
              <button
                className={theme === "dark" ? "toggle-button is-active" : "toggle-button"}
                onClick={() => setTheme("dark")}
                type="button"
              >
                {copy.darkLabel}
              </button>
              <button
                className={theme === "light" ? "toggle-button is-active" : "toggle-button"}
                onClick={() => setTheme("light")}
                type="button"
              >
                {copy.lightLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="range-picker">
          {rangeOptions.map((option) => (
            <button
              key={option}
              className={option === historyRange ? "range-pill is-active" : "range-pill"}
              onClick={() => setHistoryRange(option)}
              type="button"
            >
              {copy.rangeLabels[option]}
            </button>
          ))}
        </div>

        <DeviceSidebar
          copy={copy}
          devices={devices}
          locale={locale}
          loading={loadingDevices}
          selectedDeviceId={selectedDeviceId}
          onSelect={setSelectedDeviceId}
        />
        {!loadingDevices && !error && !devices.length ? (
          <p className="panel-note">{copy.noDevicesHint}</p>
        ) : null}
      </aside>

      <main className="shell__main">
        <section className="hero-card">
          <div className="hero-card__top">
            <div>
              <p className="eyebrow">{copy.liveMap}</p>
              <h2>{copy.liveMapTitle}</h2>
            </div>
            {lastUpdatedAt ? (
              <div className="hero-meta">
                <span className="hero-meta__pill">
                  {copy.lastUpdated}: {formatTimestamp(lastUpdatedAt, locale)}
                </span>
              </div>
            ) : null}
          </div>
          <p className="muted">{copy.liveMapDescription}</p>
        </section>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="dashboard-grid">
          <TrackerMap
            devices={devices}
            history={history}
            homeLabel={copy.homeLabel}
            selectedDeviceId={selectedDeviceId}
            theme={theme}
          />
          <div className="dashboard-stack">
            <DeviceDetails
              copy={copy}
              device={selectedDevice}
              loading={loadingDevices}
              onRename={handleRename}
            />
            <HistoryTimeline
              copy={copy}
              locale={locale}
              points={history}
              loading={loadingHistory}
              selectedDeviceName={selectedDevice?.deviceName ?? null}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
