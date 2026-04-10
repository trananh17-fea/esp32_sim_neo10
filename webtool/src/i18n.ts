export type Locale = "en" | "vi";
export type ThemeMode = "dark" | "light";

export type AppCopy = {
  appEyebrow: string;
  appTitle: string;
  appDescription: string;
  liveMap: string;
  liveMapTitle: string;
  liveMapDescription: string;
  languageLabel: string;
  themeLabel: string;
  englishLabel: string;
  vietnameseLabel: string;
  darkLabel: string;
  lightLabel: string;
  loadingDevices: string;
  noDevices: string;
  noDevicesHint: string;
  online: string;
  offline: string;
  unknownSource: string;
  selectedDevice: string;
  chooseDevice: string;
  renamePlaceholder: string;
  save: string;
  saving: string;
  fetchCurrentLocation: string;
  fetchingLocation: string;
  onlineNow: string;
  latitude: string;
  longitude: string;
  satellites: string;
  speed: string;
  accuracy: string;
  geofence: string;
  enabled: string;
  disabled: string;
  distanceToHome: string;
  insideGeofence: string;
  yes: string;
  no: string;
  movementHistory: string;
  noDeviceSelected: string;
  pointsLabel: string;
  loadingHistory: string;
  noHistory: string;
  lastUpdated: string;
  homeLabel: string;
  rangeLabels: Record<"24h" | "3d" | "7d", string>;
  searchPlaceholder: string;
  searchLoading: string;
  draftPendingLabel: string;
  satelliteLabel: string;
  roadmapLabel: string;
  homeSetLabel: string;
  homeUnsetLabel: string;
  cancelPickOnMapBtn: string;
  // Home panel
  homePanel: string;
  homePanelDesc: string;
  setHomeBtn: string;
  clearHomeBtn: string;
  pickOnMapBtn: string;
  pickOnMapHint: string;
  latPlaceholder: string;
  lngPlaceholder: string;
  homeSaved: string;
  homeCleared: string;
  homeSaving: string;
  routeToHome: string;
  routeModeOff: string;
  routeModeSelected: string;
  routeModeAll: string;
  historyToggle: string;
  historyStartLabel: string;
  historyLatestLabel: string;
  deviceLabel: string;
  overviewLabel: string;
  homeTabLabel: string;
  openSidebarLabel: string;
  collapseSidebarLabel: string;
  mapDataAttribution: string;
  productFeedbackLabel: string;
  straightLine: string;
  distanceLabel: string;
  bearingLabel: string;
  useCurrentPos: string;
  geoRadiusLabel: string;
  geoRadiusHint: string;
};

export const translations: Record<Locale, AppCopy> = {
  en: {
    appEyebrow: "NEO10 Fleet",
    appTitle: "Device Locator",
    appDescription:
      "Realtime view for active ESP32 trackers, current position, and movement history.",
    liveMap: "Live map",
    liveMapTitle: "Current and historical positions",
    liveMapDescription:
      "Devices are pulled from the Cloudflare Worker API. The selected device also shows its path for the chosen time window.",
    languageLabel: "Language",
    themeLabel: "Theme",
    englishLabel: "English",
    vietnameseLabel: "VN",
    darkLabel: "Dark",
    lightLabel: "Light",
    loadingDevices: "Loading devices...",
    noDevices: "No active device data yet.",
    noDevicesHint:
      "Check that the tracker has posted to /update and the Cloudflare Worker is redeployed with the latest API code.",
    online: "online",
    offline: "offline",
    unknownSource: "unknown source",
    selectedDevice: "Selected device",
    chooseDevice: "Choose a device to inspect its current position.",
    renamePlaceholder: "Rename this tracker",
    save: "Save",
    saving: "Saving...",
    fetchCurrentLocation: "Get current location",
    fetchingLocation: "Getting location...",
    onlineNow: "online now",
    latitude: "Latitude",
    longitude: "Longitude",
    satellites: "Satellites",
    speed: "Speed",
    accuracy: "Accuracy",
    geofence: "Geofence",
    enabled: "enabled",
    disabled: "disabled",
    distanceToHome: "Distance to home",
    insideGeofence: "Inside geofence",
    yes: "yes",
    no: "no",
    movementHistory: "Movement history",
    noDeviceSelected: "No device selected",
    pointsLabel: "points",
    loadingHistory: "Loading history...",
    noHistory: "No historical positions available for this time range.",
    lastUpdated: "Last updated",
    homeLabel: "Home",
    rangeLabels: {
      "24h": "24 hours",
      "3d": "3 days", 
      "7d": "7 days",
    },
    searchPlaceholder: "Search on map",
    searchLoading: "Searching...",
    draftPendingLabel: "Pending save",
    satelliteLabel: "Satellite",
    roadmapLabel: "Map",
    homeSetLabel: "Home saved",
    homeUnsetLabel: "Home not set",
    cancelPickOnMapBtn: "Cancel map pick",
    homePanel: "Home Location",
    homePanelDesc: "Set a home point for this device. You can type coordinates or click \"Pick on map\" then click anywhere on the map.",
    setHomeBtn: "Set Home",
    clearHomeBtn: "Clear Home",
    pickOnMapBtn: "Pick on map",
    pickOnMapHint: "Click anywhere on the map to set home…",
    latPlaceholder: "Latitude (e.g. 10.9011)",
    lngPlaceholder: "Longitude (e.g. 106.8062)",
    homeSaved: "Home saved ✓",
    homeCleared: "Home cleared",
    homeSaving: "Saving…",
    routeToHome: "Route to Home",
    routeModeOff: "Route: Off",
    routeModeSelected: "Route: Selected Device",
    routeModeAll: "Route: All Devices",
    historyToggle: "History",
    historyStartLabel: "Start",
    historyLatestLabel: "Latest",
    deviceLabel: "Device",
    overviewLabel: "Overview",
    homeTabLabel: "Home",
    openSidebarLabel: "Open sidebar",
    collapseSidebarLabel: "Collapse sidebar",
    mapDataAttribution: "Map data ©2026",
    productFeedbackLabel: "Send product feedback",
    straightLine: "Straight line",
    distanceLabel: "Distance",
    bearingLabel: "Bearing",
    useCurrentPos: "Use current position",
    geoRadiusLabel: "Geofence radius (m)",
    geoRadiusHint: "Leave 0 to disable geofence",
  },
  vi: {
    appEyebrow: "NEO10 Fleet",
    appTitle: "Bản đồ thiết bị",
    appDescription:
      "Theo dõi thời gian thực các tracker ESP32 đang hoạt động, vị trí hiện tại và lịch sử di chuyển.",
    liveMap: "Bản đồ trực tiếp",
    liveMapTitle: "Vị trí hiện tại và lịch sử",
    liveMapDescription:
      "Dữ liệu được lấy từ dữ liệu trực tiếp. Thiết bị đang chọn sẽ hiển thị thêm đường đi trong khoảng thời gian đã chọn.",
    languageLabel: "Ngôn ngữ",
    themeLabel: "Giao diện",
    englishLabel: "EN",
    vietnameseLabel: "Tiếng Việt",
    darkLabel: "Tối",
    lightLabel: "Sáng",
    loadingDevices: "Đang tải danh sách thiết bị...",
    noDevices: "Chưa có dữ liệu thiết bị hoạt động.",
    noDevicesHint:
      "Kiểm tra firmware đã gửi dữ liệu lên /update và Cloudflare Worker đã được deploy lại với code mới nhất.",
    online: "đang online",
    offline: "đang offline",
    unknownSource: "không rõ nguồn",
    selectedDevice: "Thiết bị đang chọn",
    chooseDevice: "Hãy chọn một thiết bị để xem vị trí hiện tại.",
    renamePlaceholder: "Đổi tên thiết bị này",
    save: "Lưu",
    saving: "Đang lưu...",
    fetchCurrentLocation: "Lấy tọa độ hiện tại",
    fetchingLocation: "Đang lấy tọa độ...",
    onlineNow: "đang online",
    latitude: "Vĩ độ",
    longitude: "Kinh độ",
    satellites: "Số vệ tinh",
    speed: "Tốc độ",
    accuracy: "Độ chính xác",
    geofence: "Hàng rào địa lý",
    enabled: "bật",
    disabled: "tắt",
    distanceToHome: "Khoảng cách tới HOME",
    insideGeofence: "Nằm trong vùng",
    yes: "có",
    no: "không",
    movementHistory: "Lịch sử di chuyển",
    noDeviceSelected: "Chưa chọn thiết bị",
    pointsLabel: "điểm",
    loadingHistory: "Đang tải lịch sử...",
    noHistory: "Không có điểm lịch sử trong khoảng thời gian này.",
    lastUpdated: "Cập nhật lúc",
    homeLabel: "HOME",
    rangeLabels: {
      "24h": "24 giờ",
      "3d": "3 ngày",
      "7d": "7 ngày",
    },
    searchPlaceholder: "Tìm kiếm trên map",
    searchLoading: "Đang tìm kiếm...",
    draftPendingLabel: "Chờ lưu",
    satelliteLabel: "Vệ tinh",
    roadmapLabel: "Lớp",
    homeSetLabel: "Đã lưu địa chỉ nhà",
    homeUnsetLabel: "Chưa đặt địa chỉ nhà",
    cancelPickOnMapBtn: "Hủy chọn trên bản đồ",
    homePanel: "Vị trí HOME",
    homePanelDesc: "Đặt vị trí HOME cho thiết bị này. Nhập tọa độ hoặc nhấn \"Chọn trên map\" rồi click vào vị trí trên bản đồ.",
    setHomeBtn: "Đặt HOME",
    clearHomeBtn: "Xóa HOME",
    pickOnMapBtn: "Chọn trên map",
    pickOnMapHint: "Nhấn vào bản đồ để chọn vị trí HOME…",
    latPlaceholder: "Vĩ độ (vd: 10.9011)",
    lngPlaceholder: "Kinh độ (vd: 106.8062)",
    homeSaved: "Đã lưu HOME ✓",
    homeCleared: "Đã xóa HOME",
    homeSaving: "Đang lưu…",
    routeToHome: "Đường về HOME",
    routeModeOff: "Chỉ đường: Tắt",
    routeModeSelected: "Chỉ đường: Thiết bị chọn",
    routeModeAll: "Chỉ đường: Tất cả",
    historyToggle: "Lịch sử",
    historyStartLabel: "Bắt đầu",
    historyLatestLabel: "Mới nhất",
    deviceLabel: "Thiết bị",
    overviewLabel: "Tổng quan",
    homeTabLabel: "Nhà riêng",
    openSidebarLabel: "Mở thanh bên",
    collapseSidebarLabel: "Thu gọn thanh bên",
    mapDataAttribution: "Dữ liệu bản đồ ©2026",
    productFeedbackLabel: "Gửi ý kiến phản hồi về sản phẩm",
    straightLine: "Đường thẳng",
    distanceLabel: "Khoảng cách",
    bearingLabel: "Hướng",
    useCurrentPos: "Dùng vị trí hiện tại",
    geoRadiusLabel: "Bán kính hàng rào (m)",
    geoRadiusHint: "Để 0 để tắt hàng rào địa lý",
  },
};

export function formatRelativeAge(ageSeconds: number, locale: Locale) {
  if (ageSeconds < 60) {
    return locale === "vi" ? `${ageSeconds} giây trước` : `${ageSeconds}s ago`;
  }
  if (ageSeconds < 3600) {
    const minutes = Math.floor(ageSeconds / 60);
    return locale === "vi" ? `${minutes} phút trước` : `${minutes}m ago`;
  }
  if (ageSeconds < 86400) {
    const hours = Math.floor(ageSeconds / 3600);
    return locale === "vi" ? `${hours} giờ trước` : `${hours}h ago`;
  }
  const days = Math.floor(ageSeconds / 86400);
  return locale === "vi" ? `${days} ngày trước` : `${days}d ago`;
}

export function formatTimestamp(timestamp: number, locale: Locale, withDate = true) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
  }).format(timestamp);
}
