import type { SVGProps } from "react";

/** Original 16px stroke icons for the Studio chrome (no icon dependency). */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.2 1.4" />
    </Svg>
  ),
  Grid: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Svg>
  ),
  List: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5.5 4h8M5.5 8h8M5.5 12h8" />
      <circle cx="2.8" cy="4" r=".4" fill="currentColor" />
      <circle cx="2.8" cy="8" r=".4" fill="currentColor" />
      <circle cx="2.8" cy="12" r=".4" fill="currentColor" />
    </Svg>
  ),
  Archive: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 9h3" />
    </Svg>
  ),
  Settings: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 3v10M3 8h10" />
    </Svg>
  ),
  Pencil: (p: IconProps) => (
    <Svg {...p}>
      <path d="m10.5 2.8 2.7 2.7-7.4 7.4-3.3.6.6-3.3z" />
      <path d="m9.2 4.1 2.7 2.7" />
    </Svg>
  ),
  Dots: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r=".9" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </Svg>
  ),
  ChevronRight: (p: IconProps) => (
    <Svg {...p}>
      <path d="m6.5 4.5 3.5 3.5-3.5 3.5" />
    </Svg>
  ),
  Arrow: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" />
    </Svg>
  ),
  Upload: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 10.5v-8M4.8 5.7 8 2.5l3.2 3.2M3 13.5h10" />
    </Svg>
  ),
  Home: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 7.2 8 2.8l5.5 4.4V13a.5.5 0 0 1-.5.5H9.6V10H6.4v3.5H3a.5.5 0 0 1-.5-.5z" />
    </Svg>
  ),
  Chat: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5.5A1.5 1.5 0 0 1 12 11H6.5l-3 2.5V11h0a1 1 0 0 1-1-1z" />
    </Svg>
  ),
  Studio: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M5.5 2.5v11M5.5 6.5H14" />
    </Svg>
  ),
  Template: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2" y="2" width="12" height="4" rx="1" />
      <rect x="2" y="8" width="5" height="6" rx="1" />
      <rect x="9" y="8" width="5" height="6" rx="1" />
    </Svg>
  ),
  Brand: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 2 13.5 8 8 14 2.5 8z" />
    </Svg>
  ),
  Image: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="6" cy="6.3" r="1.2" />
      <path d="m2.5 12 3.8-3.6 2.7 2.4 2-1.8 2.5 2.4" />
    </Svg>
  ),
  File: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 1.8h5.2L12.5 5v9.2H4z" />
      <path d="M9 1.8V5h3.5" />
    </Svg>
  ),
  Sparkle: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8l4.9-1.3z" />
    </Svg>
  ),
  Folder: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 4.2a1 1 0 0 1 1-1h3.2l1.4 1.6H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.3M8 13.2v1.3M14.5 8h-1.3M2.8 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" />
    </Svg>
  ),
  Monitor: (p: IconProps) => (
    <Svg {...p}>
      <rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.2" />
      <path d="M5.5 13.5h5M8 11v2.5" />
    </Svg>
  ),
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Svg>
  ),
  Trash: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.8 4.2h10.4M6.2 4.2V2.8h3.6v1.4M4 4.2l.6 9.3h6.8l.6-9.3" />
    </Svg>
  ),
  Copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.2" />
      <path d="M3.5 10.8h-.3a.8.8 0 0 1-.7-.8V3.2a.8.8 0 0 1 .7-.7H10a.8.8 0 0 1 .8.7v.3" />
    </Svg>
  ),
  Restore: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 7.5A5 5 0 1 1 4.7 11.4" />
      <path d="M2.8 3.8v3.7h3.7" />
    </Svg>
  ),
  Logo: (p: IconProps) => (
    <Svg {...p} strokeWidth={1.8}>
      <path d="M8 1.8v12.4M2.6 4.9l10.8 6.2M2.6 11.1l10.8-6.2" />
    </Svg>
  ),
};
