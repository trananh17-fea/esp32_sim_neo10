import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "../components/AppIcon";
import { DeviceDetails } from "../features/devices/DeviceDetails";
import { HistoryTimeline } from "../features/history/HistoryTimeline";
import { HomePanel, type HomePickMode } from "../features/home/HomePanel";
import {
  type MapLayerMode,
  TrackerMap,
  type RouteMode,
  type TrackerMapController,
} from "../features/map/TrackerMap";
import { formatTimestamp, translations, type Locale, type ThemeMode } from "../i18n";
import {
  fetchDeviceLocation,
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
const RANGE_OPTIONS: HistoryRange[] = ["24h", "3d", "7d"];

const STORAGE_KEYS = {
  locale: "neo10-webtool-locale",
  theme: "neo10-webtool-theme",
} as const;

type SidebarSection = "saved" | "recent" | "home";

function getInitialLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEYS.locale);
  if (saved === "en" || saved === "vi") return saved;
  return window.navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

function getInitialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "dark" || saved === "light") return saved;
  return "light";
}

function cycleRouteMode(current: RouteMode): RouteMode {
  if (current === "off") return "selected";
  if (current === "selected") return "all";
  return "off";
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
  const [showHistory, setShowHistory] = useState(false);
  const [routeMode, setRouteMode] = useState<RouteMode>("off");
  const [mapLayer, setMapLayer] = useState<MapLayerMode>("roadmap");
  const [pickMode, setPickMode] = useState<HomePickMode>("idle");
  const [pendingPick, setPendingPick] = useState<{ lat: number; lng: number } | null>(null);
  const [draftHome, setDraftHome] = useState<{ lat: number; lng: number } | null>(null);
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("saved");
  const [mapController, setMapController] = useState<TrackerMapController | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const copy = translations[locale];
  const onlineCount = devices.filter((device) => device.online).length;
  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

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
          if (current && nextDevices.some((device) => device.deviceId === current)) return current;
          return nextDevices[0]?.deviceId ?? null;
        });
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load devices.");
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
  }, []);

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
        if (!cancelled) {
          setHistory(points);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load history.");
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [historyRange, selectedDeviceId]);

  useEffect(() => {
    setPickMode("idle");
    setPendingPick(null);
  }, [selectedDeviceId]);

  const handleRename = async (deviceId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;

    const updatedName = await renameDevice(deviceId, trimmed);
    setDevices((prev) =>
      prev.map((device) =>
        device.deviceId === deviceId ? { ...device, deviceName: updatedName } : device,
      ),
    );
  };

  const handleFetchCurrentLocation = async (deviceId: string) => {
    const current = await fetchDeviceLocation(deviceId);
    setDevices((prev) =>
      prev.map((device) =>
        device.deviceId === deviceId ? { ...device, ...current } : device,
      ),
    );
    setLastUpdatedAt(Date.now());
  };

  const handleMapClick = (lat: number, lng: number) => {
    setPendingPick({ lat, lng });
    setPickMode("idle");
    setSidebarSection("home");
    setSidebarCollapsed(false);
  };

  const handleHomeSaved = (homeLat: number, homeLng: number, distanceToHomeM: number) => {
    setPendingPick(null);
    setDraftHome(null);
    setPickMode("idle");
    setDevices((prev) =>
      prev.map((device) =>
        device.deviceId === selectedDeviceId
          ? { ...device, distanceToHomeM, homeLat, homeLng, homeSet: true }
          : device,
      ),
    );
  };

  const handleHomeCleared = () => {
    setPendingPick(null);
    setDraftHome(null);
    setPickMode("idle");
    setDevices((prev) =>
      prev.map((device) =>
        device.deviceId === selectedDeviceId
          ? {
            ...device,
            distanceToHomeM: -1,
            geoEnabled: false,
            geoRadiusM: 0,
            homeLat: undefined,
            homeLng: undefined,
            homeSet: false,
            insideGeofence: false,
          }
          : device,
      ),
    );
  };

  const visibleDraftHome = useMemo(() => {
    if (!draftHome) return null;
    if (
      selectedDevice?.homeSet &&
      typeof selectedDevice.homeLat === "number" &&
      typeof selectedDevice.homeLng === "number"
    ) {
      const sameLat = Math.abs(selectedDevice.homeLat - draftHome.lat) < 0.000001;
      const sameLng = Math.abs(selectedDevice.homeLng - draftHome.lng) < 0.000001;
      if (sameLat && sameLng) return null;
    }
    return draftHome;
  }, [draftHome, selectedDevice]);

  const placeTabs = [
    { id: "overview" as const, label: "Tổng quan" },
    { id: "home" as const, label: "Nhà riêng" },
  ];

  return (
    <div className={`gmaps-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <aside className={`gmaps-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="gmaps-sidebar__top">
          <button
            className="gmaps-sidebar__icon-button"
            type="button"
            aria-label={sidebarCollapsed ? "Mở thanh bên" : "Thu gọn thanh bên"}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            <AppIcon name="menu" size={20} />
          </button>
          <button
            className={`gmaps-sidebar__menu-item ${sidebarSection === "saved" ? "is-active" : ""}`}
            onClick={() => {
              setSidebarSection("saved");
              setSidebarCollapsed(false);
            }}
            type="button"
          >
            <AppIcon name="device" size={24} />
          </button>
          <button
            className={`gmaps-sidebar__menu-item ${sidebarSection === "home" ? "is-active" : ""}`}
            onClick={() => {
              setSidebarSection("home");
              setSidebarCollapsed(false);
            }}
            type="button"
          >
            <AppIcon name="home" size={24} />
          </button>
          <button
            className={`gmaps-sidebar__menu-item ${sidebarSection === "recent" ? "is-active" : ""}`}
            onClick={() => {
              setSidebarSection("recent");
              setSidebarCollapsed(false);
            }}
            type="button"
          >
            <AppIcon name="recent" size={24} />
          </button>
        </div>

        <div className="gmaps-sidebar__list gmaps-sidebar__list--sheet">
          {!sidebarCollapsed ? (
            <section className="place-sheet place-sheet--sidebar">
              {sidebarSection === "saved" || sidebarSection === "home" ? (
                <>
                  <div className="place-sheet__header">
                    <div className="place-sheet__header-row">
                      <div>
                        <div className="place-sheet__headline">
                          {selectedDevice?.deviceName ?? "Tracker 0CDADC"}
                        </div>
                        <div className="place-sheet__subline">
                          {lastUpdatedAt
                            ? `Cập nhật ${formatTimestamp(lastUpdatedAt, locale)}`
                            : "Đại lộ Tự Do"}
                        </div>
                      </div>
                      <span className="maps-info-badge">
                        {onlineCount}/{devices.length} online
                      </span>
                    </div>

                    {devices.length > 1 ? (
                      <label className="place-sheet__device-row">
                        <span>Thiết bị</span>
                        <select
                          className="maps-select"
                          value={selectedDeviceId ?? ""}
                          onChange={(event) => setSelectedDeviceId(event.target.value || null)}
                        >
                          {devices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.deviceName || device.deviceId}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>

                  <div className="place-sheet__content">
                    {error ? <div className="maps-inline-alert maps-inline-alert--error">{error}</div> : null}

                    {sidebarSection === "saved" ? (
                      <DeviceDetails
                        copy={copy}
                        device={selectedDevice}
                        loading={loadingDevices}
                        onFetchCurrentLocation={handleFetchCurrentLocation}
                        onRename={handleRename}
                      />
                    ) : null}

                    {sidebarSection === "home" ? (
                      <HomePanel
                        copy={copy}
                        device={selectedDevice}
                        onCancelPick={() => setPickMode("idle")}
                        onDraftChange={setDraftHome}
                        onHomeCleared={handleHomeCleared}
                        onHomeSaved={handleHomeSaved}
                        onStartPick={() => setPickMode("picking")}
                        pendingPick={pendingPick}
                        pickMode={pickMode}
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="place-sheet__header">
                    <div className="place-sheet__header-row">
                      <div>
                        <div className="place-sheet__headline">Lịch sử di chuyển của {selectedDevice?.deviceName ?? "thiết bị đã chọn"}</div>
                      </div>
                      <span className="maps-info-badge">{history.length} điểm</span>
                    </div>
                  </div>

                  <div className="place-sheet__range-row place-sheet__range-row--history">
                    {RANGE_OPTIONS.map((range) => (
                      <button
                        key={range}
                        className={`place-sheet__range-chip ${historyRange === range ? "is-active" : ""}`}
                        onClick={() => setHistoryRange(range)}
                        type="button"
                      >
                        {copy.rangeLabels[range]}
                      </button>
                    ))}
                  </div>

                  <div className="place-sheet__content">
                    {error ? <div className="maps-inline-alert maps-inline-alert--error">{error}</div> : null}
                    <HistoryTimeline
                      copy={copy}
                      loading={loadingHistory}
                      locale={locale}
                      points={history}
                      selectedDeviceName={selectedDevice?.deviceName ?? null}
                    />
                  </div>
                </>
              )}
            </section>
          ) : null}
        </div>

        <div className="gmaps-sidebar__bottom">
          <div className="gmaps-sidebar__tool-row">
            <button
              className="gmaps-sidebar__tool-button"
              onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
              type="button"
            >
              {locale === "vi" ? "EN" : "VI"}
            </button>
            <button
              className="gmaps-sidebar__tool-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              type="button"
            >
              {theme === "dark" ? "Sáng" : "Tối"}
            </button>
          </div>
        </div>
      </aside>

      <main className="gmaps-main">
        <div className="gmaps-topbar">
          <div className="gmaps-search-row">
            <div className="gmaps-searchbox">
              <AppIcon name="search" size={18} />
              <input
                className="gmaps-searchbox__input"
                placeholder="Tìm kiếm trên Google Maps"
                readOnly
                value=""
              />
              <button className="gmaps-searchbox__action" type="button" aria-label="Directions">
                <AppIcon name="directions" size={18} />
              </button>
            </div>
          </div>

          <div className="gmaps-profile-row">

            <button
              className={`gmaps-map-chip ${showHistory ? "is-active" : ""}`}
              onClick={() => {
                setShowHistory((current) => !current);
                setSidebarSection("recent");
                setSidebarCollapsed(false);
              }}
              type="button"
            >
              <AppIcon name="history" size={15} />
              <span>{copy.historyToggle}</span>
            </button>
            <button
              className={`gmaps-map-chip ${routeMode !== "off" ? "is-active" : ""}`}
              onClick={() => setRouteMode((current) => cycleRouteMode(current))}
              type="button"
            >
              <AppIcon name="route" size={15} />
              <span>
                {routeMode === "off"
                  ? copy.routeModeOff
                  : routeMode === "selected"
                    ? copy.routeModeSelected
                    : copy.routeModeAll}
              </span>
            </button>

            <button className="gmaps-top-icon" type="button" aria-label="Apps">
              <AppIcon name="apps" size={18} />
            </button>
            <button className="gmaps-avatar" type="button" aria-label="Profile">
              <span className="gmaps-avatar__face" />
            </button>
          </div>
        </div>

        <section className="gmaps-map-stage">
          <TrackerMap
            devices={devices}
            draftHome={visibleDraftHome}
            draftPendingLabel={locale === "vi" ? "Chờ lưu" : "Pending save"}
            history={history}
            homeLabel={copy.homeLabel}
            locale={locale}
            onMapClick={handleMapClick}
            onControllerReady={setMapController}
            pickMode={pickMode}
            routeMode={routeMode}
            selectedDeviceId={selectedDeviceId}
            showHistory={showHistory}
            mapLayer={mapLayer}
            theme={theme}
          />


          <button
            className={`gmaps-layer-card ${mapLayer === "satellite" ? "is-satellite" : "is-roadmap"}`}
            onClick={() =>
              setMapLayer((current) => (current === "roadmap" ? "satellite" : "roadmap"))
            }
            type="button"
          >
            <div className="gmaps-layer-card__thumb" />
            <div className="gmaps-layer-card__info">
              <AppIcon name="layers" size={15} />
              <span>Lớp</span>
            </div>
          </button>

          <div className="gmaps-map-controls">
            <button
              className="gmaps-map-control"
              onClick={() => mapController?.focusSelected()}
              type="button"
              title="Location"
            >
              <AppIcon name="location" size={18} />
            </button>
            <button
              className="gmaps-map-control"
              onClick={() => mapController?.zoomIn()}
              type="button"
              title="Zoom in"
            >
              <AppIcon name="plus" size={18} />
            </button>
            <button
              className="gmaps-map-control"
              onClick={() => mapController?.zoomOut()}
              type="button"
              title="Zoom out"
            >
              <AppIcon name="minus" size={18} />
            </button>
            <button
              className="gmaps-map-control gmaps-map-control--pegman"
              type="button"
              title="Street View"
            >
              <AppIcon name="pegman" size={18} />
            </button>
            <button className="gmaps-map-control" type="button" title="3D">
              <AppIcon name="threeD" size={18} />
            </button>
            <button className="gmaps-map-control" type="button" title="Rotate">
              <AppIcon name="rotate" size={18} />
            </button>
          </div>

          <div className="gmaps-attribution">
            <div className="gmaps-attribution__brand">Google</div>
            <div className="gmaps-attribution__text">
              <span>Hình ảnh ©2026, Dữ liệu bản đồ ©2026</span>
              <span>Toàn cầu</span>
              <span>Điều khoản</span>
              <span>Quyền riêng tư</span>
              <span>Gửi ý kiến phản hồi về sản phẩm</span>
            </div>
          </div>

          <div className="gmaps-scale-bar">
            <span className="gmaps-scale-bar__line" />
            <span>10 mét</span>
          </div>
        </section>
      </main>
    </div>
  );
}
