import { Trophy, Medal, Award } from "lucide-react";

export const MEDAL_ICONS = [
  { Cmp: Trophy, cls: "text-warning" },
  { Cmp: Medal, cls: "text-muted-foreground" },
  { Cmp: Award, cls: "text-orange-400" },
] as const;
