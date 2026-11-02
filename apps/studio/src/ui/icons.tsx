import {
  Archive,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Diamond,
  Download,
  Ellipsis,
  File,
  Folder,
  House,
  Image,
  LayoutGrid,
  LayoutTemplate,
  List,
  type LucideIcon,
  type LucideProps,
  MessageCircle,
  Monitor,
  Moon,
  PanelsTopLeft,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";

/**
 * Studio chrome icons come from Lucide (ISC, lucide-icons/lucide, pinned
 * lucide-react@1.58.0): thin, rounded line icons that match the Paper /
 * Framer-style chrome. Only the allstudio logo below is our own artwork.
 * The `Icon.X` API is kept so call sites don't depend on the library.
 */
type IconProps = LucideProps & { size?: number };

const STROKE = 1.6;

function wrap(Component: LucideIcon) {
  return function StudioIcon({ size = 16, ...props }: IconProps) {
    return (
      <Component
        size={size}
        strokeWidth={STROKE}
        absoluteStrokeWidth
        aria-hidden="true"
        focusable="false"
        {...props}
      />
    );
  };
}

/** allstudio's asterisk mark (original brand artwork, not from Lucide). */
function Logo({ size = 16, ...props }: IconProps) {
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

export const Icon = {
  Search: wrap(Search),
  Clock: wrap(Clock),
  Grid: wrap(LayoutGrid),
  List: wrap(List),
  Archive: wrap(Archive),
  Settings: wrap(Settings),
  Plus: wrap(Plus),
  Pencil: wrap(PencilLine),
  Dots: wrap(Ellipsis),
  Chevron: wrap(ChevronDown),
  ChevronRight: wrap(ChevronRight),
  Arrow: wrap(ArrowRight),
  Download: wrap(Download),
  Upload: wrap(Upload),
  Home: wrap(House),
  Chat: wrap(MessageCircle),
  Studio: wrap(PanelsTopLeft),
  Template: wrap(LayoutTemplate),
  Brand: wrap(Diamond),
  Image: wrap(Image),
  File: wrap(File),
  Sparkle: wrap(Sparkles),
  Folder: wrap(Folder),
  Sun: wrap(Sun),
  Moon: wrap(Moon),
  Monitor: wrap(Monitor),
  Close: wrap(X),
  Trash: wrap(Trash2),
  Copy: wrap(Copy),
  Restore: wrap(RotateCcw),
  Logo,
};
