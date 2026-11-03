import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  File,
  Frame,
  Hand,
  House,
  Image,
  Lock,
  LockOpen,
  type LucideIcon,
  type LucideProps,
  Moon,
  MousePointer2,
  Plus,
  Redo2,
  Search,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from "lucide-react";

/**
 * Board editor icons come from Lucide (ISC, lucide-icons/lucide, pinned
 * lucide-react@1.58.0), the same set as the Studio dashboards. Only the
 * allstudio logo below is our own artwork. The `I.X` API is kept so the
 * editor UI doesn't depend on the library directly.
 */
type P = LucideProps & { size?: number };

function wrap(Component: LucideIcon) {
  return function EditorIcon({ size = 16, ...props }: P) {
    return (
      <Component
        size={size}
        strokeWidth={1.6}
        absoluteStrokeWidth
        aria-hidden="true"
        focusable="false"
        {...props}
      />
    );
  };
}

/** allstudio's asterisk mark (original brand artwork, not from Lucide). */
function Logo({ size = 16, ...props }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      {...(props as React.SVGProps<SVGSVGElement>)}
    >
      <path d="M8 1.8v12.4M2.6 4.9l10.8 6.2M2.6 11.1l10.8-6.2" />
    </svg>
  );
}

export const I = {
  Pointer: wrap(MousePointer2),
  Hand: wrap(Hand),
  Frame: wrap(Frame),
  Rect: wrap(Square),
  Ellipse: wrap(Circle),
  Text: wrap(Type),
  Image: wrap(Image),
  Shape: wrap(Triangle),
  Plus: wrap(Plus),
  Undo: wrap(Undo2),
  Redo: wrap(Redo2),
  Chevron: wrap(ChevronDown),
  ChevronRight: wrap(ChevronRight),
  Eye: wrap(Eye),
  EyeOff: wrap(EyeOff),
  Lock: wrap(Lock),
  Unlock: wrap(LockOpen),
  Trash: wrap(Trash2),
  Copy: wrap(Copy),
  Page: wrap(File),
  Home: wrap(House),
  Search: wrap(Search),
  Sparkle: wrap(Sparkles),
  Moon: wrap(Moon),
  Sun: wrap(Sun),
  Download: wrap(Download),
  Dots: wrap(Ellipsis),
  Send: wrap(ArrowUp),
  AlignLeft: wrap(AlignStartVertical),
  AlignCenter: wrap(AlignCenterVertical),
  AlignRight: wrap(AlignEndVertical),
  AlignTop: wrap(AlignStartHorizontal),
  AlignMiddle: wrap(AlignCenterHorizontal),
  AlignBottom: wrap(AlignEndHorizontal),
  ArrowRight: wrap(ArrowRight),
  ArrowDown: wrap(ArrowDown),
  DistributeH: wrap(AlignHorizontalDistributeCenter),
  DistributeV: wrap(AlignVerticalDistributeCenter),
  Logo,
};
