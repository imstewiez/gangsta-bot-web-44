import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getViewAsMemberId, setViewAsMemberId } from "@/lib/authed-server-fn";

export function ViewAsExitButton() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    function sync() {
      setActive(Boolean(getViewAsMemberId()));
    }
    sync();
    window.addEventListener("ballas:view-as-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ballas:view-as-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!active) return null;

  function stopViewAs() {
    setViewAsMemberId(null);
    toast.success("Voltaste à tua sessão real");
    window.location.href = "/dashboard";
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={stopViewAs}
      className="h-10 shrink-0 border-warning/35 bg-warning/10 px-3 text-warning hover:bg-warning/15 hover:text-warning"
      title="Sair do modo ver como"
    >
      <EyeOff className="mr-2 h-4 w-4" />
      Sair do modo ver como
    </Button>
  );
}
