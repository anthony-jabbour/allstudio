import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className="text-sm text-stone-600 hover:text-stone-900">
      {children}
    </a>
  );
}
