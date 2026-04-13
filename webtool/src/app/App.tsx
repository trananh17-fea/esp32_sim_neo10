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
import { getDeviceColor } from "../utils/deviceColors";

const logofullUrl = new URL("../img/logofull.png", import.meta.url).href;
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
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
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
  const [scaleBar, setScaleBar] = useState({ label: locale === "vi" ? "10 mét" : "10 m", width: 54 });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 640;
  });
  const [showTopApps, setShowTopApps] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const copy = translations[locale];
  const onlineCount = devices.filter((device) => device.online).length;
  const primarySelectedId = selectedDeviceIds[0] ?? null;
  const selectedDevice = useMemo(
    () => devices.find((device) => device.deviceId === primarySelectedId) ?? null,
    [devices, primarySelectedId],
  );
  const deviceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((device, index) => map.set(device.deviceId, getDeviceColor(index)));
    return map;
  }, [devices]);

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
        setSelectedDeviceIds((prev) => {
          if (prev.length > 0) {
            return prev.filter((id) => nextDevices.some((device) => device.deviceId === id));
          }
          return nextDevices[0] ? [nextDevices[0].deviceId] : [];
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
      if (!primarySelectedId) {
        setHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);
        const points = await fetchHistory(primarySelectedId, historyRange);
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
  }, [historyRange, primarySelectedId]);

  useEffect(() => {
    setPickMode("idle");
    setPendingPick(null);
  }, [primarySelectedId]);

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

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      const data = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;

      const results = data.map((item) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));

      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = (lat: number, lng: number, name: string) => {
    setSearchQuery(name);
    setShowSearchResults(false);
    setSearchResults([]);

    // Pan map to selected location
    if (mapController) {
      mapController.focusOnCoordinates?.(lat, lng);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(searchQuery);
    }
  };

  const handleHomeSaved = (homeLat: number, homeLng: number, distanceToHomeM: number) => {
    setPendingPick(null);
    setDraftHome(null);
    setPickMode("idle");
    setDevices((prev) =>
      prev.map((device) =>
        device.deviceId === primarySelectedId
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
        device.deviceId === primarySelectedId
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
    { id: "overview" as const, label: copy.overviewLabel },
    { id: "home" as const, label: copy.homeTabLabel },
  ];

  return (
    <div className={`gmaps-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <aside className={`gmaps-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="gmaps-sidebar__top">
          <button
            className="gmaps-sidebar__icon-button"
            type="button"
            aria-label={sidebarCollapsed ? copy.openSidebarLabel : copy.collapseSidebarLabel}
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
                          {selectedDevice?.deviceName ?? copy.noDeviceSelected}
                        </div>
                        <div className="place-sheet__subline">
                          {lastUpdatedAt
                            ? `${copy.lastUpdated} ${formatTimestamp(lastUpdatedAt, locale)}`
                            : copy.noDeviceSelected}
                        </div>
                      </div>
                      <span className="maps-info-badge">
                        {onlineCount}/{devices.length} online
                      </span>
                    </div>

                    {devices.length > 0 ? (
                      <div className="place-sheet__device-row">
                        <span>{copy.deviceLabel}</span>
                        <div className="place-sheet__device-list">
                          {devices.map((device, index) => {
                            const color =
                              deviceColorMap.get(device.deviceId) ?? getDeviceColor(index);
                            const checked = selectedDeviceIds.includes(device.deviceId);

                            return (
                              <label key={device.deviceId} className="device-picker-row">
                                <span
                                  className="device-picker-row__color"
                                  style={{ background: color }}
                                />
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedDeviceIds((prev) =>
                                      checked
                                        ? prev.filter((id) => id !== device.deviceId)
                                        : [...prev, device.deviceId],
                                    );
                                  }}
                                />
                                <span className="device-picker-row__name">
                                  {device.deviceName || device.deviceId}
                                </span>
                                <span
                                  className={`device-picker-row__status ${device.online ? "online" : "offline"}`}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
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
                        <div className="place-sheet__headline">
                          {copy.movementHistory} của {selectedDevice?.deviceName ?? copy.noDeviceSelected}
                        </div>
                      </div>
                      <span className="maps-info-badge">
                        {history.length} {copy.pointsLabel}
                      </span>
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
              {locale === "vi" ? copy.englishLabel : copy.vietnameseLabel}
            </button>

          </div>
        </div>
      </aside>

      <main className="gmaps-main">
        <div className="gmaps-topbar">
          <div className="gmaps-search-row">
            <div className="gmaps-searchbox" style={{ position: "relative" }}>
              <AppIcon name="search" size={18} />
              <input
                className="gmaps-searchbox__input"
                placeholder={copy.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              />
              <button
                className="gmaps-searchbox__action"
                type="button"
                aria-label="Search"
                onClick={() => handleSearch(searchQuery)}
              >
                <AppIcon name="directions" size={18} />
              </button>

              {showSearchResults && searchResults.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  zIndex: 1000,
                  marginTop: "4px",
                  boxShadow: "var(--shadow-1)"
                }}>
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelectSearchResult(result.lat, result.lng, result.name)}
                      style={{
                        padding: "12px 16px",
                        borderBottom: index < searchResults.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--bg-muted)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: "500" }}>{result.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>
                        {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchLoading && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "12px 16px",
                  marginTop: "4px",
                  textAlign: "center",
                  fontSize: "14px",
                  color: "var(--text-soft)",
                  boxShadow: "var(--shadow-1)"
                }}>
                  {copy.searchLoading}
                </div>
              )}
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

            <button
              className="gmaps-top-icon"
              type="button"
              aria-label="Apps"
              onClick={() => setShowTopApps((current) => !current)}
            >
              <AppIcon name="apps" size={18} />
            </button>
            {showTopApps ? (
              <div className="gmaps-top-apps">
                <button className="gmaps-top-app-button" type="button" aria-label="App 1">
                  <AppIcon name="home" size={18} />
                </button>
                <button className="gmaps-top-app-button" type="button" aria-label="App 2">
                  <AppIcon name="route" size={18} />
                </button>
                <button className="gmaps-top-app-button" type="button" aria-label="App 3">
                  <AppIcon name="location" size={18} />
                </button>
                <button className="gmaps-top-app-button" type="button" aria-label="App 4">
                  <AppIcon name="search" size={18} />
                </button>
              </div>
            ) : null}
            <button className="gmaps-avatar" type="button" aria-label="Profile">
              <span className="gmaps-avatar__face" />
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.4rem",
                marginBottom: "0.2rem",
                marginRight: 0,
              }}
            >
              <span className="theme-icon" style={{ fontSize: "1.4rem" }}>
                {theme === "dark" ? "🌙" : "☀️"}
              </span>
              <label className="theme-switch" htmlFor="checkbox">
                <input
                  type="checkbox"
                  id="checkbox"
                  onChange={toggleTheme}
                  checked={theme === "light"}
                />
                <div className="slider round" />
              </label>
            </div>
          </div>
        </div>

        <section className="gmaps-map-stage">
          <TrackerMap
            deviceColorMap={deviceColorMap}
            devices={devices}
            draftHome={visibleDraftHome}
            draftPendingLabel={copy.draftPendingLabel}
            history={history}
            homeLabel={copy.homeLabel}
            historyStartLabel={copy.historyStartLabel}
            historyLatestLabel={copy.historyLatestLabel}
            locale={locale}
            onMapClick={handleMapClick}
            onControllerReady={setMapController}
            onScaleChange={setScaleBar}
            pickMode={pickMode}
            routeMode={routeMode}
            selectedDeviceIds={selectedDeviceIds}
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
              <span>{mapLayer === "roadmap" ? copy.satelliteLabel : copy.roadmapLabel}</span>
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
          </div>

          <div className="gmaps-attribution">
            <div className="gmaps-attribution__brand">Vũ Đăng Thanh x TA Solutions</div>
            <div className="gmaps-attribution__text">
              <span>{copy.mapDataAttribution}</span>
              <span>{copy.productFeedbackLabel}</span>
            </div>
          </div>

          <div className="gmaps-scale-bar">
            <span
              className="gmaps-scale-bar__line"
              style={{ width: `${scaleBar.width}px` }}
            />
            <span>{scaleBar.label}</span>
            <img className="gmaps-scale-logo" src={logofullUrl} alt="NEO10 logo" />
          </div>
        </section>
      </main>
    </div>
  );
}
