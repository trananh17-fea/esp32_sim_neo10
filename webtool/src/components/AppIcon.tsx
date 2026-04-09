export type IconName =
  | "menu"
  | "saved"
  | "recent"
  | "phone"
  | "device"
  | "search"
  | "directions"
  | "restaurant"
  | "hotel"
  | "attraction"
  | "museum"
  | "transit"
  | "chevron"
  | "apps"
  | "location"
  | "plus"
  | "minus"
  | "pegman"
  | "layers"
  | "threeD"
  | "rotate"
  | "battery"
  | "signal"
  | "speed"
  | "satellite"
  | "history"
  | "home"
  | "edit"
  | "refresh"
  | "close"
  | "route"
  | "accuracy";

type AppIconProps = {
  className?: string;
  name: IconName;
  size?: number;
};

export function AppIcon({ className, name, size = 18 }: AppIconProps) {
  const props = {
    className,
    fill: "none",
    height: size,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
    width: size,
  };

  switch (name) {
    case "menu":
      return (
        <svg {...props}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );
    case "saved":
      return (
        <svg {...props}>
          <path d="M7 4h10a2 2 0 0 1 2 2v14l-7-3-7 3V6a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "recent":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case "phone":
      return (
        <svg {...props}>
          <rect x="7" y="3.5" width="10" height="17" rx="2.5" />
          <path d="M11 17.5h2" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case "directions":
      return (
        <svg {...props}>
          <path d="m9 5 3-2 3 2" />
          <path d="M12 3v8" />
          <path d="M8 10h8l-2 4H10z" />
          <path d="m9 19 3 2 3-2" />
        </svg>
      );
    case "restaurant":
      return (
        <svg {...props}>
          <path d="M7 4v7" />
          <path d="M10 4v7" />
          <path d="M7 8h3" />
          <path d="M8.5 11v9" />
          <path d="M15 4c1.5 2.2 1.5 4.8 0 7v9" />
        </svg>
      );
    case "hotel":
      return (
        <svg {...props}>
          <path d="M5 20V6" />
          <path d="M5 11h14a2 2 0 0 1 2 2v7" />
          <path d="M9 9V6" />
          <path d="M9 14h4" />
        </svg>
      );
    case "attraction":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="m12 7 1.5 3 3.5.5-2.5 2.4.6 3.6-3.1-1.7-3.1 1.7.6-3.6-2.5-2.4 3.5-.5z" />
        </svg>
      );
    case "museum":
      return (
        <svg {...props}>
          <path d="m4 9 8-5 8 5" />
          <path d="M5 9h14" />
          <path d="M7 9v8" />
          <path d="M12 9v8" />
          <path d="M17 9v8" />
          <path d="M4 17h16" />
        </svg>
      );
    case "transit":
      return (
        <svg {...props}>
          <rect x="6" y="4.5" width="12" height="13" rx="3" />
          <path d="M9 17.5 7 20" />
          <path d="M15 17.5 17 20" />
          <path d="M8.5 8h7" />
          <path d="M8 13h.01" />
          <path d="M16 13h.01" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="m8 10 4 4 4-4" />
        </svg>
      );
    case "apps":
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="12" cy="7" r="1.2" />
          <circle cx="17" cy="7" r="1.2" />
          <circle cx="7" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="17" cy="12" r="1.2" />
          <circle cx="7" cy="17" r="1.2" />
          <circle cx="12" cy="17" r="1.2" />
          <circle cx="17" cy="17" r="1.2" />
        </svg>
      );
    case "location":
      return (
        <svg {...props}>
          <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...props}>
          <path d="M5 12h14" />
        </svg>
      );
    case "pegman":
      return (
        <svg {...props}>
          <circle cx="12" cy="5.5" r="2.5" fill="currentColor" stroke="none" />
          <path d="M12 8.5v4.5" />
          <path d="m8.5 11 3.5 2 3.5-2" />
          <path d="m10 20 2-4 2 4" />
          <path d="m8.5 17 1.5-4" />
          <path d="m15.5 17-1.5-4" />
        </svg>
      );
    case "layers":
      return (
        <svg {...props}>
          <path d="m12 5 8 4-8 4-8-4 8-4Z" />
          <path d="m4 13 8 4 8-4" />
        </svg>
      );
    case "threeD":
      return (
        <svg {...props}>
          <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" />
          <path d="M12 4v16" />
          <path d="m4 7.5 8 4 8-4" />
        </svg>
      );
    case "rotate":
      return (
        <svg {...props}>
          <path d="M7 7h5V2" />
          <path d="M17 17h-5v5" />
          <path d="M7.5 16.5a6.5 6.5 0 0 1 0-9" />
          <path d="M16.5 7.5a6.5 6.5 0 0 1 0 9" />
        </svg>
      );
    case "battery":
      return (
        <svg {...props}>
          <rect x="4" y="8" width="14" height="8" rx="2" />
          <path d="M18 10h2v4h-2" />
          <path d="M7 12h6" />
        </svg>
      );
    case "signal":
      return (
        <svg {...props}>
          <path d="M6 18h1" />
          <path d="M10 15h1" />
          <path d="M14 12h1" />
          <path d="M18 9h1" />
        </svg>
      );
    case "speed":
      return (
        <svg {...props}>
          <path d="M5 16a7 7 0 1 1 14 0" />
          <path d="m12 12 4-2" />
        </svg>
      );
    case "satellite":
      return (
        <svg {...props}>
          <rect x="9" y="9" width="6" height="6" rx="1.5" />
          <path d="m6.5 6.5 2.5 2.5" />
          <path d="m17.5 6.5-2.5 2.5" />
          <path d="m6.5 17.5 2.5-2.5" />
          <path d="m17.5 17.5-2.5-2.5" />
        </svg>
      );
    case "history":
      return (
        <svg {...props}>
          <path d="M4.5 12A7.5 7.5 0 1 0 7 6.4" />
          <path d="M4.5 5.5v4H8" />
          <path d="M12 8.5V12l2.5 1.5" />
        </svg>
      );
    case "home":
      return (
        <svg {...props}>
          <path d="m4.5 10 7.5-6 7.5 6" />
          <path d="M6.5 9.5V19h11V9.5" />
          <path d="M10 19v-5h4v5" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9Z" />
          <path d="m13.5 6.5 3.5 3.5" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
    case "route":
      return (
        <svg {...props}>
          <circle cx="7" cy="17" r="2.2" />
          <circle cx="17" cy="7" r="2.2" />
          <path d="M9 16c3-1.2 4.7-2.9 6-6" />
        </svg>
      );
    case "accuracy":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 3v2" />
          <path d="M12 19v2" />
          <path d="M3 12h2" />
          <path d="M19 12h2" />
        </svg>
      );
    case "device":
      return (
        <svg {...props}>
          <rect x="7" y="3.5" width="10" height="17" rx="2.5" />
          <path d="M11 17.5h2" />
        </svg>
      );
    default:
      return null;
  }
}
