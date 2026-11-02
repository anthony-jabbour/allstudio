import type { SVGProps } from "react";

/** Original 16px icons for the board editor chrome. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...props }: P) {
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

export const I = {
  Pointer: (p: P) => (
    <Svg {...p}>
      <path d="M3.5 2.5 12.5 7.8l-4 1-1.8 3.9z" />
    </Svg>
  ),
  Hand: (p: P) => (
    <Svg {...p}>
      <path d="M5.2 8.3V3.6a1 1 0 0 1 2 0v4M7.2 7.4V2.8a1 1 0 0 1 2 0v4.6M9.2 7.4V3.6a1 1 0 0 1 2 0v5.6c0 2.7-1.7 4.6-4.2 4.6-1.6 0-2.6-.7-3.5-2.1L2.2 9.4a1 1 0 0 1 1.6-1.2l1.4 1.6" />
    </Svg>
  ),
  Frame: (p: P) => (
    <Svg {...p}>
      <path d="M4.5 1.8v12.4M11.5 1.8v12.4M1.8 4.5h12.4M1.8 11.5h12.4" />
    </Svg>
  ),
  Rect: (p: P) => (
    <Svg {...p}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
    </Svg>
  ),
  Ellipse: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.5" />
    </Svg>
  ),
  Text: (p: P) => (
    <Svg {...p}>
      <path d="M3 3.5h10M8 3.5v10M6 13.5h4" />
    </Svg>
  ),
  Image: (p: P) => (
    <Svg {...p}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="6" cy="6.3" r="1.2" />
      <path d="m2.5 12 3.8-3.6 2.7 2.4 2-1.8 2.5 2.4" />
    </Svg>
  ),
  Shape: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.2 14 13H2z" />
    </Svg>
  ),
  Plus: (p: P) => (
    <Svg {...p}>
      <path d="M8 3v10M3 8h10" />
    </Svg>
  ),
  Undo: (p: P) => (
    <Svg {...p}>
      <path d="M5.5 3.5 2.5 6.5l3 3" />
      <path d="M2.8 6.5h6.7a4 4 0 0 1 0 8H7" />
    </Svg>
  ),
  Redo: (p: P) => (
    <Svg {...p}>
      <path d="m10.5 3.5 3 3-3 3" />
      <path d="M13.2 6.5H6.5a4 4 0 0 0 0 8H9" />
    </Svg>
  ),
  Chevron: (p: P) => (
    <Svg {...p}>
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </Svg>
  ),
  ChevronRight: (p: P) => (
    <Svg {...p}>
      <path d="m6.5 4.5 3.5 3.5-3.5 3.5" />
    </Svg>
  ),
  Eye: (p: P) => (
    <Svg {...p}>
      <path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </Svg>
  ),
  EyeOff: (p: P) => (
    <Svg {...p}>
      <path d="M6.3 4a6.3 6.3 0 0 1 1.7-.2C12 3.8 14.2 8 14.2 8a10 10 0 0 1-1.6 2.1M4.2 5.1A10 10 0 0 0 1.8 8S4 12.2 8 12.2a6 6 0 0 0 3-.8M2.5 2.5l11 11" />
    </Svg>
  ),
  Lock: (p: P) => (
    <Svg {...p}>
      <rect x="3.2" y="7" width="9.6" height="6.8" rx="1.2" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" />
    </Svg>
  ),
  Unlock: (p: P) => (
    <Svg {...p}>
      <rect x="3.2" y="7" width="9.6" height="6.8" rx="1.2" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.4-1" />
    </Svg>
  ),
  Trash: (p: P) => (
    <Svg {...p}>
      <path d="M2.8 4.2h10.4M6.2 4.2V2.8h3.6v1.4M4 4.2l.6 9.3h6.8l.6-9.3" />
    </Svg>
  ),
  Copy: (p: P) => (
    <Svg {...p}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.2" />
      <path d="M3.5 10.8h-.3a.8.8 0 0 1-.7-.8V3.2a.8.8 0 0 1 .7-.7H10a.8.8 0 0 1 .8.7v.3" />
    </Svg>
  ),
  Page: (p: P) => (
    <Svg {...p}>
      <path d="M4 1.8h5.2L12.5 5v9.2H4z" />
      <path d="M9 1.8V5h3.5" />
    </Svg>
  ),
  Home: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 7.2 8 2.8l5.5 4.4V13a.5.5 0 0 1-.5.5H9.6V10H6.4v3.5H3a.5.5 0 0 1-.5-.5z" />
    </Svg>
  ),
  Search: (p: P) => (
    <Svg {...p}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </Svg>
  ),
  Sparkle: (p: P) => (
    <Svg {...p}>
      <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8l4.9-1.3z" />
    </Svg>
  ),
  Moon: (p: P) => (
    <Svg {...p}>
      <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" />
    </Svg>
  ),
  Sun: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.3M8 13.2v1.3M14.5 8h-1.3M2.8 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9" />
    </Svg>
  ),
  Download: (p: P) => (
    <Svg {...p}>
      <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" />
    </Svg>
  ),
  Dots: (p: P) => (
    <Svg {...p}>
      <circle cx="3.5" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r=".9" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Send: (p: P) => (
    <Svg {...p}>
      <path d="M8 13V3M4 7l4-4 4 4" />
    </Svg>
  ),
  AlignLeft: (p: P) => (
    <Svg {...p}>
      <path d="M2.5 2v12" />
      <rect x="4.5" y="4" width="8" height="3" rx=".6" />
      <rect x="4.5" y="9" width="5" height="3" rx=".6" />
    </Svg>
  ),
  AlignCenter: (p: P) => (
    <Svg {...p}>
      <path d="M8 2v12" />
      <rect x="3.5" y="4" width="9" height="3" rx=".6" />
      <rect x="5" y="9" width="6" height="3" rx=".6" />
    </Svg>
  ),
  AlignRight: (p: P) => (
    <Svg {...p}>
      <path d="M13.5 2v12" />
      <rect x="3.5" y="4" width="8" height="3" rx=".6" />
      <rect x="6.5" y="9" width="5" height="3" rx=".6" />
    </Svg>
  ),
  AlignTop: (p: P) => (
    <Svg {...p}>
      <path d="M2 2.5h12" />
      <rect x="4" y="4.5" width="3" height="8" rx=".6" />
      <rect x="9" y="4.5" width="3" height="5" rx=".6" />
    </Svg>
  ),
  AlignMiddle: (p: P) => (
    <Svg {...p}>
      <path d="M2 8h12" />
      <rect x="4" y="3.5" width="3" height="9" rx=".6" />
      <rect x="9" y="5" width="3" height="6" rx=".6" />
    </Svg>
  ),
  AlignBottom: (p: P) => (
    <Svg {...p}>
      <path d="M2 13.5h12" />
      <rect x="4" y="3.5" width="3" height="8" rx=".6" />
      <rect x="9" y="6.5" width="3" height="5" rx=".6" />
    </Svg>
  ),
  Logo: (p: P) => (
    <Svg {...p} strokeWidth={1.8}>
      <path d="M8 1.8v12.4M2.6 4.9l10.8 6.2M2.6 11.1l10.8-6.2" />
    </Svg>
  ),
};
