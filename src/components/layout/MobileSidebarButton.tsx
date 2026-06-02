import { Menu } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";

export function MobileSidebarButton() {
  const { setOpenMobile } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setOpenMobile(true)}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/15 md:hidden"
      title="Abrir menu"
      aria-label="Abrir menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
