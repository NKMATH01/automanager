import type { ReactNode } from "react";

interface SidebarSectionProps {
  label: string;
  children: ReactNode;
}

export function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/75">
        {label}
      </div>
      <div className="flex flex-col gap-1 mt-1">{children}</div>
    </div>
  );
}
