export const DEVICE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
];

export function getDeviceColor(index: number): string {
  return DEVICE_COLORS[index % DEVICE_COLORS.length];
}
