import { cn } from "@/lib/cn";

export function ServiceBadge({
  label,
  isNew,
}: {
  label: string;
  isNew: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        isNew ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}
